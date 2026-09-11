import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { z } from "zod";

import {
  buildRecommendationPersonalization,
  buildReplenishmentRecommendations,
  buildVisualRecommendations,
} from "../lib/cart-intelligence/recommendations";
import {
  buildProfileKey,
  resolveCustomerProfile,
} from "../lib/cart-intelligence/customer-profile";
import { evaluateReplenishmentCandidates } from "../lib/cart-intelligence/replenishment";
import { scoreStyleCoherence } from "../lib/cart-intelligence/style-coherence";
import {
  listActiveReplenishmentLifecycleRules,
  getCustomerProfile,
  getColorCompatibilityRulesForKeys,
  getReplenishmentActionTargets,
  getSessionCustomerProfile,
  listCustomerPurchaseSnapshots,
  listCartVisualItems,
  listStyleCandidateProducts,
} from "../lib/db/queries";

const CartLineSchema = z.object({
  productId: z.string().min(1),
  variantId: z.string().optional(),
  quantity: z.coerce.number().int().min(1).default(1),
});

const ProfileInputSchema = z.object({
  discipline: z.string().min(1).optional(),
  disciplines: z.array(z.string().min(1)).optional(),
  experienceLevel: z.string().min(1).optional(),
  weightClass: z.string().min(1).optional(),
  priceSensitivity: z.string().min(1).optional(),
  knownSizes: z.record(z.string(), z.string().min(1)).optional(),
});

const RecommendationRequestSchema = z.object({
  shop: z.string().min(1),
  cartId: z.string().optional(),
  currencyCode: z.string().min(3).max(3).default("USD"),
  shopifyCustomerId: z.string().min(1).optional(),
  sessionId: z.string().min(1).optional(),
  profileInput: ProfileInputSchema.optional(),
  cart: z.array(CartLineSchema).default([]),
});

function parseProfileInputSearchParam(value: string | null) {
  if (!value) {
    return undefined;
  }

  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}

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
    shopifyCustomerId: url.searchParams.get("shopifyCustomerId") ?? undefined,
    sessionId: url.searchParams.get("sessionId") ?? undefined,
    profileInput: parseProfileInputSearchParam(url.searchParams.get("profileInput")),
    cart,
  });
}

async function parseBodyRequest(request: Request) {
  const body = await request.json().catch(() => null);

  return RecommendationRequestSchema.safeParse({
    shop: body?.shop ?? "",
    cartId: body?.cartId ?? undefined,
    currencyCode: body?.currencyCode ?? "USD",
    shopifyCustomerId: body?.shopifyCustomerId ?? undefined,
    sessionId: body?.sessionId ?? undefined,
    profileInput: body?.profileInput ?? undefined,
    cart: Array.isArray(body?.cart) ? body.cart : [],
  });
}

async function buildStyleResponse(input: z.infer<typeof RecommendationRequestSchema>) {
  const cartItems = await listCartVisualItems(input.shop, input.cart);
  const storedProfile = input.shopifyCustomerId
    ? await getCustomerProfile(input.shop, input.shopifyCustomerId, input.sessionId)
    : input.sessionId
      ? await getSessionCustomerProfile(input.shop, input.sessionId)
      : null;
  const resolvedProfile = (storedProfile || input.profileInput || input.shopifyCustomerId || input.sessionId)
    ? resolveCustomerProfile({
        shop: input.shop,
        shopifyCustomerId: input.shopifyCustomerId,
        sessionId: input.sessionId,
        explicitInput: input.profileInput,
        storedProfile: storedProfile
          ? {
              profileKey: buildProfileKey(input.shop, storedProfile.shopifyCustomerId, storedProfile.sessionId),
              shop: storedProfile.shop,
              shopifyCustomerId: storedProfile.shopifyCustomerId,
              sessionId: storedProfile.sessionId,
              sizeProfile: storedProfile.sizeProfile,
              disciplineProfile: storedProfile.disciplineProfile,
              explicitProfile: storedProfile.explicitProfile,
              purchaseSummary: storedProfile.purchaseSummary,
              behaviorSummary: storedProfile.behaviorSummary,
              confidenceSummary: storedProfile.confidenceSummary,
              lastActiveAt: storedProfile.lastActiveAt,
            }
          : null,
      })
    : null;
  const replenishment = input.shopifyCustomerId
    ? await buildReplenishmentResponse(input.shop, input.shopifyCustomerId, storedProfile)
    : undefined;

  if (cartItems.length === 0) {
    return {
      ok: true,
      request: input,
      ...(resolvedProfile
        ? { personalization: buildRecommendationPersonalization(resolvedProfile) }
        : {}),
      ...(replenishment ? { replenishment } : {}),
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
    ...(resolvedProfile
      ? { personalization: buildRecommendationPersonalization(resolvedProfile) }
      : {}),
    ...(replenishment ? { replenishment } : {}),
    style: buildVisualRecommendations(result, candidateProducts, cartItems),
  };
}

async function buildReplenishmentResponse(
  shop: string,
  shopifyCustomerId: string,
  storedProfile: Awaited<ReturnType<typeof getCustomerProfile>>,
) {
  const purchaseSnapshots = await listCustomerPurchaseSnapshots(shop, shopifyCustomerId);

  if (purchaseSnapshots.length === 0) {
    return undefined;
  }

  const lifecycleRules = await listActiveReplenishmentLifecycleRules(
    shop,
    Array.from(new Set(purchaseSnapshots.map((snapshot) => snapshot.categoryTag))),
  );

  if (lifecycleRules.length === 0) {
    return undefined;
  }

  const reorderTargets = await getReplenishmentActionTargets(
    shop,
    purchaseSnapshots.map((snapshot) => snapshot.productId),
  );

  return buildReplenishmentRecommendations(
    evaluateReplenishmentCandidates({
      shop,
      shopifyCustomerId,
      profile: storedProfile,
      purchaseSnapshots,
      lifecycleRules,
      reorderTargets,
    }),
  );
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