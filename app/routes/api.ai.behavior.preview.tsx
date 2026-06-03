import { AIBehaviorPreviewStatus } from "@prisma/client";
import type { ActionFunctionArgs } from "react-router";

import { AIBehaviorPreviewRequestSchema } from "../lib/ai/schemas";
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

  const previewRun = await createAIBehaviorPreviewRun({
    shop: session.shop,
    status: AIBehaviorPreviewStatus.RUNNING,
    inputSnapshot: parsed.data.draft,
    scenarioSet: parsed.data.scenarios,
    requestedBy: session.shop,
  });

  return Response.json(
    {
      ok: true,
      status: "RUNNING",
      previewRunId: previewRun.id,
    },
    { status: 202 },
  );
};
