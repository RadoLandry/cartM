import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";

import {
  AIBehaviorDraftUpdateRequestSchema,
} from "../lib/ai/schemas";
import { resolveAndValidateAIBehaviorDraft } from "../lib/ai/behavior-config";
import {
  AIBehaviorVersionConflictError,
  getAIBehaviorDraft,
  getAIBehaviorVersionHistory,
  getActiveAIBehaviorConfigWithFallback,
  saveAIBehaviorDraft,
  writeAIBehaviorDraftSavedAudit,
} from "../lib/db/queries";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  const [draft, active, history] = await Promise.all([
    getAIBehaviorDraft(session.shop),
    getActiveAIBehaviorConfigWithFallback(session.shop),
    getAIBehaviorVersionHistory(session.shop),
  ]);

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
  const { session } = await authenticate.admin(request);

  if (request.method !== "PUT") {
    return Response.json(
      {
        ok: false,
        error: {
          code: "METHOD_NOT_ALLOWED",
          message: "Only PUT is supported by this route.",
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
