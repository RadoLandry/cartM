import type { ActionFunctionArgs } from "react-router";
import { z } from "zod";

import { composeKitPreview } from "../lib/visual/compositor";
import { resolveLayoutProfile } from "../lib/visual/templates";
import { normalizeStorefrontCartForPreview } from "../lib/shopify/storefront-cart";

export const runtime = "nodejs";

const PreviewLineSchema = z.object({
  lineId: z.string().min(1).optional(),
  productId: z.string().min(1).optional(),
  variantId: z.string().min(1).optional(),
  productTitle: z.string().min(1).optional(),
  variantTitle: z.string().min(1).optional(),
  quantity: z.coerce.number().int().min(1).default(1),
  imageUrl: z.string().url().optional(),
  discipline: z.string().min(1).optional(),
});

const KitPreviewRequestSchema = z.object({
  shop: z.string().min(1),
  sessionId: z.string().min(1),
  cartId: z.string().min(1),
  surface: z.enum(["cart_drawer", "cart_page", "chat"]),
  viewportHint: z.enum(["mobile", "desktop", "unknown"]).optional(),
  currencyCode: z.string().min(3).max(3).default("USD"),
  forceRegenerate: z.boolean().optional(),
  cart: z.object({
    items: z.array(PreviewLineSchema).default([]),
  }),
});

export const action = async ({ request }: ActionFunctionArgs) => {
  const requestId = crypto.randomUUID();
  const body = await request.json().catch(() => null);
  const parsed = KitPreviewRequestSchema.safeParse(body);

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

  const snapshot = normalizeStorefrontCartForPreview({
    cartId: parsed.data.cartId,
    currencyCode: parsed.data.currencyCode,
    items: parsed.data.cart.items,
  });

  const layoutProfile = resolveLayoutProfile(
    snapshot.inferredDiscipline,
    snapshot.items.length,
  );

  const composition = composeKitPreview({
    snapshot,
    layoutProfile,
    forceRegenerate: parsed.data.forceRegenerate,
  });

  return Response.json({
    ok: composition.status !== "error",
    status: composition.status,
    requestId,
    preview: composition.preview,
    context: composition.context,
    omissions: composition.omissions,
    diagnostics: {
      generationMs: composition.diagnostics.generationMs,
    },
  });
};
