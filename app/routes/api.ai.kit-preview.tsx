import type { ActionFunctionArgs } from "react-router";
import { resolveColorwayPreviewLine } from "../lib/shopify/cart";
import {
  ColorwayPreviewRequestSchema,
  parseColorwayPreviewRequestInput,
} from "../lib/visual/colorway-preview.types";
import { generateColorwayPreview } from "../lib/visual/colorway-preview";

export const runtime = "nodejs";

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
    cart: {
      currencyCode: parsed.data.currencyCode,
      items: parsed.data.cart.items,
    },
  });

  if (!lineResolution.valid) {
    return Response.json(
      {
        ok: false,
        status: "invalid",
        requestId,
        error: lineResolution.reason,
      },
      { status: lineResolution.reason === "line_not_found" ? 404 : 422 },
    );
  }

  try {
    const preview = await generateColorwayPreview(
      parseColorwayPreviewRequestInput(parsed.data),
    );

    return Response.json({
      ok: preview.status !== "error",
      status: preview.status,
      requestId,
      comparison: preview.comparison,
      change: preview.change,
      context: preview.context,
      omissions: preview.omissions,
      diagnostics: {
        generationMs: preview.diagnostics.generationMs,
      },
    });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        status: "error",
        requestId,
        error: error instanceof Error ? error.message : "Unexpected preview failure",
      },
      { status: 500 },
    );
  }
};
