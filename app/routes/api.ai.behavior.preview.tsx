import { AIBehaviorPreviewStatus } from "@prisma/client";
import type { ActionFunctionArgs } from "react-router";

import { AIBehaviorPreviewRequestSchema } from "../lib/ai/schemas";
import { runAIBehaviorPreviewScenarios } from "../lib/ai/behavior-preview";
import { createAIBehaviorPreviewRun } from "../lib/db/queries";
import { authenticate } from "../shopify.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  const body = await request.json().catch(() => null);
  const parsed = AIBehaviorPreviewRequestSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json(
      {
        ok: false,
        error: {
          code: "INVALID_PREVIEW_REQUEST",
          message: "Invalid AI behavior preview payload.",
          details: parsed.error.flatten(),
        },
      },
      { status: 400 },
    );
  }

  let results: ReturnType<typeof runAIBehaviorPreviewScenarios>;

  try {
    results = runAIBehaviorPreviewScenarios({
      draft: parsed.data.draft,
      scenarios: parsed.data.scenarios,
    });
  } catch (error) {
    console.error("[ai-behavior-preview] scenario runner failed", {
      shop: session.shop,
      error: error instanceof Error ? error.message : error,
    });

    await createAIBehaviorPreviewRun({
      shop: session.shop,
      status: AIBehaviorPreviewStatus.FAILED,
      inputSnapshot: parsed.data.draft,
      scenarioSet: parsed.data.scenarios,
      requestedBy: session.shop,
    }).catch(() => undefined);

    return Response.json(
      {
        ok: false,
        error: {
          code: "PREVIEW_RUNNER_FAILED",
          message: "Preview could not be generated for this draft. Please try again.",
          retryable: true,
        },
      },
      { status: 500 },
    );
  }

  try {
    const previewRun = await createAIBehaviorPreviewRun({
      shop: session.shop,
      status: AIBehaviorPreviewStatus.READY,
      inputSnapshot: parsed.data.draft,
      scenarioSet: parsed.data.scenarios,
      resultPayload: results,
      requestedBy: session.shop,
    });

    return Response.json(
      {
        ok: true,
        status: "READY",
        previewRunId: previewRun.id,
        results,
      },
      { status: 200 },
    );
  } catch (error) {
    // Preview computation already succeeded above; only the audit-trail write failed.
    console.error("[ai-behavior-preview] failed to persist preview run", {
      shop: session.shop,
      error: error instanceof Error ? error.message : error,
    });

    return Response.json(
      {
        ok: true,
        status: "READY",
        previewRunId: "unpersisted",
        results,
      },
      { status: 200 },
    );
  }
};
