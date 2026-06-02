import type { ActionFunctionArgs } from "react-router";
import { resolveColorwayPreviewLine } from "../lib/shopify/cart";
import {
  ColorwayPreviewRequestSchema,
  parseColorwayPreviewRequestInput,
} from "../lib/visual/colorway-preview.types";
import { generateColorwayPreview } from "../lib/visual/colorway-preview";

export const runtime = "nodejs";

function buildOutcomeTelemetry(input: {
  status: "ok" | "partial" | "invalid" | "fallback" | "error";
  reused: boolean;
  omissionCount: number;
  generationMs: number | null;
  forceRegenerate: boolean;
  surface: "cart_drawer" | "cart_page" | "chat";
}) {
  return {
    status: input.status,
    reused: input.reused,
    omissionCount: input.omissionCount,
    generationMs: input.generationMs,
    forceRegenerate: input.forceRegenerate,
    surface: input.surface,
  };
}

function logPreviewOutcome(input: {
  requestId: string;
  status: "ok" | "partial" | "invalid" | "fallback" | "error";
  telemetry: ReturnType<typeof buildOutcomeTelemetry>;
}) {
  const event = {
    event: "colorway_preview_outcome",
    requestId: input.requestId,
    ...input.telemetry,
  };

  if (input.status === "error") {
    console.error("[ColorwayPreview]", event);
    return;
  }

  if (input.status === "invalid" || input.status === "fallback") {
    console.warn("[ColorwayPreview]", event);
    return;
  }

  console.info("[ColorwayPreview]", event);
}

export const action = async ({ request }: ActionFunctionArgs) => {
  const requestId = crypto.randomUUID();
  const body = await request.json().catch(() => null);
  const normalizedBody = {
    ...(body && typeof body === "object" ? body : {}),
    shopDomain:
      body && typeof body === "object" && "shopDomain" in body
        ? body.shopDomain
        : body && typeof body === "object" && "shop" in body
          ? body.shop
          : undefined,
    selectedLineId:
      body && typeof body === "object" && "selectedLineId" in body
        ? body.selectedLineId
        : body && typeof body === "object" && "lineId" in body
          ? body.lineId
          : undefined,
    proposedVariantId:
      body && typeof body === "object" && "proposedVariantId" in body
        ? body.proposedVariantId
        : body && typeof body === "object" && "variantId" in body
          ? body.variantId
          : undefined,
  };

  const parsed = ColorwayPreviewRequestSchema.safeParse(normalizedBody);

  if (!parsed.success) {
    return Response.json(
      {
        ok: false,
        status: "error",
        requestId,
        error: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  const lineResolution = resolveColorwayPreviewLine({
    selectedLineId: parsed.data.selectedLineId,
    proposedVariantId: parsed.data.proposedVariantId,
    availableVariantIds: parsed.data.availableVariantIds,
    cart: {
      currencyCode: parsed.data.currencyCode,
      items: parsed.data.cart.items,
    },
  });

  if (!lineResolution.valid) {
    const telemetry = buildOutcomeTelemetry({
      status: "invalid",
      reused: false,
      omissionCount: 0,
      generationMs: null,
      forceRegenerate: Boolean(parsed.data.forceRegenerate),
      surface: parsed.data.surface,
    });

    logPreviewOutcome({
      requestId,
      status: "invalid",
      telemetry,
    });

    return Response.json(
      {
        ok: false,
        status: "invalid",
        requestId,
        error: lineResolution.reason,
        diagnostics: {
          reused: false,
          generationMs: null,
          telemetry,
        },
      },
      { status: lineResolution.reason === "line_not_found" ? 404 : 422 },
    );
  }

  try {
    const preview = await generateColorwayPreview(
      parseColorwayPreviewRequestInput(parsed.data),
    );

    const telemetry = buildOutcomeTelemetry({
      status: preview.status,
      reused: preview.comparison.reused,
      omissionCount: preview.omissions.length,
      generationMs: preview.diagnostics.generationMs,
      forceRegenerate: Boolean(parsed.data.forceRegenerate),
      surface: parsed.data.surface,
    });

    logPreviewOutcome({
      requestId,
      status: preview.status,
      telemetry,
    });

    return Response.json({
      ok: preview.status !== "error",
      status: preview.status,
      requestId,
      comparison: preview.comparison,
      change: preview.change,
      context: preview.context,
      omissions: preview.omissions,
      diagnostics: {
        reused: preview.comparison.reused,
        generationMs: preview.diagnostics.generationMs,
        telemetry,
      },
    });
  } catch (error) {
    const telemetry = buildOutcomeTelemetry({
      status: "error",
      reused: false,
      omissionCount: 0,
      generationMs: null,
      forceRegenerate: Boolean(parsed.data.forceRegenerate),
      surface: parsed.data.surface,
    });

    logPreviewOutcome({
      requestId,
      status: "error",
      telemetry,
    });

    return Response.json(
      {
        ok: false,
        status: "error",
        requestId,
        error: error instanceof Error ? error.message : "Unexpected preview failure",
        diagnostics: {
          reused: false,
          generationMs: null,
          telemetry,
        },
      },
      { status: 500 },
    );
  }
};
