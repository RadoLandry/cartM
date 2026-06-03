import type {
  StorefrontCartLine,
  StorefrontGuidancePayload,
  StorefrontWidgetMountConfig,
} from "../../app/lib/ai/schemas";

export const STOREFRONT_INTEGRATION_TEST_SHOP = "test.myshopify.com";

export function makeStorefrontIntegrationCartLine(
  overrides: Partial<StorefrontCartLine> = {},
): StorefrontCartLine {
  return {
    lineId: "cart-line-1",
    productId: "gid://shopify/Product/1",
    productTitle: "Core Training Gloves",
    variantId: "gid://shopify/ProductVariant/11",
    variantTitle: "12 oz / Black",
    quantity: 1,
    ...overrides,
  };
}

export function makeStorefrontWidgetMountConfig(
  overrides: Partial<StorefrontWidgetMountConfig> = {},
): StorefrontWidgetMountConfig {
  return {
    shop: STOREFRONT_INTEGRATION_TEST_SHOP,
    surface: "cart_drawer",
    placementId: "cartmind-cart-drawer",
    appBaseUrl: "https://app.cartmind.test",
    bootstrapPath: "/apps/cartmind-chat/chat-bootstrap",
    recommendationsPath: "/api/ai/recommendations",
    cart: {
      currencyCode: "USD",
      items: [makeStorefrontIntegrationCartLine()],
    },
    labels: {
      launcherLabel: "Ask CartMind",
      panelTitle: "CartMind",
      fallbackMessage: "CartMind is temporarily unavailable.",
    },
    features: {
      showRecommendations: true,
      showKitCompleteness: true,
      showSizeWarnings: true,
      showChatEntry: true,
    },
    ...overrides,
  };
}

export function makeStorefrontGuidancePayload(
  overrides: Partial<StorefrontGuidancePayload> = {},
): StorefrontGuidancePayload {
  return {
    payloadId: "payload-1",
    generatedAt: "2026-06-03T00:00:00.000Z",
    recommendations: [
      {
        guidanceId: "recommendation-1",
        title: "Add hand wraps",
        message: "Hand wraps help protect your hands with these gloves.",
        priority: 1,
        action: "add",
        productId: "gid://shopify/Product/2",
      },
    ],
    kitCompleteness: {
      discipline: "Boxing",
      score: 0.5,
      missingCount: 2,
      summary: "Your boxing kit is halfway complete.",
    },
    sizeWarnings: [
      {
        warningId: "size-1",
        severity: "warning",
        title: "Check glove size",
        message: "This glove size may be light for sparring.",
        relatedLineIds: ["cart-line-1"],
      },
    ],
    chatEntry: {
      available: true,
      bootstrapPath: "/apps/cartmind-chat/chat-bootstrap",
    },
    ...overrides,
  };
}