import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";

import {
  AIBehaviorDraftUpdateRequestSchema,
  AIBehaviorPublishRequestSchema,
  AIBehaviorRollbackRequestSchema,
} from "../lib/ai/schemas";
import { resolveAndValidateAIBehaviorDraft } from "../lib/ai/behavior-config";
import {
  AIBehaviorVersionConflictError,
  getAIBehaviorDraft,
  getAIBehaviorVersionHistory,
  getActiveAIBehaviorConfigWithFallback,
  publishAIBehaviorDraft,
  rollbackAIBehaviorVersion,
  saveAIBehaviorDraft,
  writeAIBehaviorDraftSavedAudit,
} from "../lib/db/queries";
import { authenticate } from "../shopify.server";

// Plan budgets: config read <= 50ms p95, publish/rollback <= 2s p95 (specs/024-ai-behavior-configuration/plan.md)
const CONFIG_READ_BUDGET_MS = 50;
const PUBLISH_ROLLBACK_BUDGET_MS = 2000;

function warnIfOverBudget(label: string, startedAt: number, budgetMs: number) {
  const durationMs = Date.now() - startedAt;
  if (durationMs > budgetMs) {
    console.warn(`[ai-behavior-config] ${label} took ${durationMs}ms (budget ${budgetMs}ms)`);
  }
  return durationMs;
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const startedAt = Date.now();
  const { session } = await authenticate.admin(request);

  const [draft, active, history] = await Promise.all([
    getAIBehaviorDraft(session.shop),
    getActiveAIBehaviorConfigWithFallback(session.shop),
    getAIBehaviorVersionHistory(session.shop),
  ]);

  warnIfOverBudget("config read", startedAt, CONFIG_READ_BUDGET_MS);

  return Response.json({
    ok: true,
    draft: draft?.config ?? active.config,
    active: active.config,
    versionToken: draft?.versionToken ?? "initial",
    history: history.map((entry) => ({
      id: entry.id,
      versionNumber: entry.versionNumber,
      status: entry.status,
      publishedAt: entry.publishedAt.toISOString(),
      publishedBy: entry.publishedBy,
    })),
  });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const startedAt = Date.now();
  const { session } = await authenticate.admin(request);

  if (request.method === "POST") {
    const body = await request.json().catch(() => null);

    if (body && typeof body === "object" && (body as { intent?: string }).intent === "rollback") {
      const parsedRollback = AIBehaviorRollbackRequestSchema.safeParse(body);

      if (!parsedRollback.success) {
        return Response.json(
          {
            ok: false,
            error: {
              code: "INVALID_ROLLBACK_REQUEST",
              message: "Invalid AI behavior rollback payload.",
              details: parsedRollback.error.flatten(),
            },
          },
          { status: 400 },
        );
      }

      const activeVersion = await rollbackAIBehaviorVersion({
        shop: session.shop,
        actorId: session.shop,
        targetVersionId: parsedRollback.data.targetVersionId,
        reason: parsedRollback.data.reason,
      });

      warnIfOverBudget("rollback", startedAt, PUBLISH_ROLLBACK_BUDGET_MS);

      return Response.json({ ok: true, activeVersion });
    }

    const parsedPublish = AIBehaviorPublishRequestSchema.safeParse(body ?? {});

    if (!parsedPublish.success) {
      return Response.json(
        {
          ok: false,
          error: {
            code: "INVALID_PUBLISH_REQUEST",
            message: "Invalid AI behavior publish payload.",
            details: parsedPublish.error.flatten(),
          },
        },
        { status: 400 },
      );
    }

    try {
      const activeVersion = await publishAIBehaviorDraft({
        shop: session.shop,
        actorId: session.shop,
        reason: parsedPublish.data.reason,
      });

      warnIfOverBudget("publish", startedAt, PUBLISH_ROLLBACK_BUDGET_MS);

      return Response.json({ ok: true, activeVersion });
    } catch (error) {
      return Response.json(
        {
          ok: false,
          error: {
            code: "PUBLISH_FAILED",
            message: error instanceof Error ? error.message : "Unable to publish AI behavior draft.",
          },
        },
        { status: 422 },
      );
    }
  }

  if (request.method !== "PUT") {
    return Response.json(
      {
        ok: false,
        error: {
          code: "METHOD_NOT_ALLOWED",
          message: "Only PUT and POST are supported by this route.",
        },
      },
      { status: 405 },
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = AIBehaviorDraftUpdateRequestSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json(
      {
        ok: false,
        error: {
          code: "INVALID_CONFIG_REQUEST",
          message: "Invalid AI behavior draft payload.",
          details: parsed.error.flatten(),
        },
      },
      { status: 400 },
    );
  }

  try {
    const existingDraft = await getAIBehaviorDraft(session.shop);
    const resolved = resolveAndValidateAIBehaviorDraft(parsed.data.draft);

    if (!resolved.ok) {
      return Response.json(
        {
          ok: false,
          error: {
            code: "INVALID_CONFIG_REQUEST",
            message: "Draft payload violates behavior policy constraints.",
            details: resolved.issues,
          },
        },
        { status: 400 },
      );
    }

    const saved = await saveAIBehaviorDraft({
      shop: session.shop,
      actorId: session.shop,
      config: resolved.adjusted,
      expectedVersionToken: parsed.data.versionToken,
    });

    await writeAIBehaviorDraftSavedAudit({
      shop: session.shop,
      actorId: session.shop,
      draftId: saved.id,
      ...(existingDraft ? { beforeSnapshot: existingDraft.config } : {}),
      afterSnapshot: saved.config,
    });

    return Response.json({
      ok: true,
      draft: saved.config,
      versionToken: saved.versionToken,
      conflicts: resolved.conflicts,
    });
  } catch (error) {
    if (error instanceof AIBehaviorVersionConflictError) {
      return Response.json(
        {
          ok: false,
          error: {
            code: "VERSION_CONFLICT",
            message: "Draft was updated elsewhere. Refresh and try again.",
          },
        },
        { status: 409 },
      );
    }

    throw error;
  }
};
