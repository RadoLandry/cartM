import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { z } from "zod";

import { buildVisualRecommendations } from "../lib/cart-intelligence/recommendations";
import { scoreStyleCoherence } from "../lib/cart-intelligence/style-coherence";
import {
  getColorCompatibilityRulesForKeys,
  listCartVisualItems,
  listStyleCandidateProducts,
} from "../lib/db/queries";

const CartLineSchema = z.object({
  productId: z.string().min(1),
  variantId: z.string().optional(),
  quantity: z.coerce.number().int().min(1).default(1),
});

const RecommendationRequestSchema = z.object({
  shop: z.string().min(1),
  cartId: z.string().optional(),
  currencyCode: z.string().min(3).max(3).default("USD"),
  cart: z.array(CartLineSchema).default([]),
});

function parseUrlRequest(request: Request) {
  const url = new URL(request.url);
  const productIds = url.searchParams.getAll("productId").filter(Boolean);
  const variantIds = url.searchParams.getAll("variantId");
  const quantities = url.searchParams.getAll("quantity");
  const cart = productIds.map((productId, index) => ({
    productId,
    variantId: variantIds[index] || undefined,
    quantity: quantities[index] ? Number(quantities[index]) : 1,
  }));

  return RecommendationRequestSchema.safeParse({
    shop: url.searchParams.get("shop") ?? "",
    cartId: url.searchParams.get("cartId") ?? undefined,
    currencyCode: url.searchParams.get("currencyCode") ?? "USD",
    cart,
  });
}

async function parseBodyRequest(request: Request) {
  const body = await request.json().catch(() => null);

  return RecommendationRequestSchema.safeParse({
    shop: body?.shop ?? "",
    cartId: body?.cartId ?? undefined,
    currencyCode: body?.currencyCode ?? "USD",
    cart: Array.isArray(body?.cart) ? body.cart : [],
  });
}

async function buildStyleResponse(input: z.infer<typeof RecommendationRequestSchema>) {
  const cartItems = await listCartVisualItems(input.shop, input.cart);

  if (cartItems.length === 0) {
    return {
      ok: true,
      request: input,
      style: {
        summary: {
          status: "hidden",
          coherenceScore: "0.00",
          reason: "No supported visual items were found in the cart.",
        },
        opportunities: [],
      },
    };
  }

  const candidateProducts = await listStyleCandidateProducts(input.shop, {
    categoryTags: Array.from(new Set(cartItems.flatMap((item) => item.categoryTags))),
    excludeProductIds: cartItems.map((item) => item.productId),
    swapProductSelections: cartItems.map((item) => ({
      productId: item.productId,
      variantId: item.selectedVariantId,
    })),
    take: 24,
  });

  const colorwayKeys = Array.from(new Set(
    [...cartItems, ...candidateProducts].flatMap((item) => item.visualProfile.effectiveColorwayKeys),
  ));
  const compatibilityRules = colorwayKeys.length > 0
    ? await getColorCompatibilityRulesForKeys(input.shop, colorwayKeys)
    : [];

  const result = scoreStyleCoherence({
    shop: input.shop,
    items: cartItems,
    compatibilityRules,
    candidateProducts,
  });

  return {
    ok: true,
    request: input,
    style: buildVisualRecommendations(result, candidateProducts, cartItems),
  };
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const parsed = parseUrlRequest(request);

  if (!parsed.success) {
    return Response.json(
      {
        ok: false,
        error: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  return Response.json(await buildStyleResponse(parsed.data));
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const parsed = await parseBodyRequest(request);

  if (!parsed.success) {
    return Response.json(
      {
        ok: false,
        error: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  return Response.json(await buildStyleResponse(parsed.data));
};