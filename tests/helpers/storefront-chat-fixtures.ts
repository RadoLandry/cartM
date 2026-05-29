import type {
  StorefrontChatSurface,
  StorefrontChatBootstrapRequest,
  StorefrontChatRequest,
  StructuredGuidanceBlock,
} from "../../app/lib/ai/schemas";
import { issueStorefrontChatToken } from "../../app/lib/shopify/app-proxy";
import type { ChatSessionState } from "../../storefront-widget/src/hooks/useChatSessionState";

export const TEST_SHOP = "test.myshopify.com";
export const TEST_SESSION_ID = "browser-session-123";

export function makeStorefrontChatBootstrapRequest(
  overrides: Partial<StorefrontChatBootstrapRequest> = {},
): StorefrontChatBootstrapRequest {
  return {
    shop: TEST_SHOP,
    cartId: "gid://shopify/Cart/123",
    surface: "cart_drawer",
    sessionId: TEST_SESSION_ID,
    currencyCode: "USD",
    ...overrides,
  };
}

export function makeStorefrontChatRequest(
  overrides: Partial<StorefrontChatRequest> = {},
): StorefrontChatRequest {
  const bootstrap = makeStorefrontChatBootstrapRequest();
  const token = issueStorefrontChatToken(bootstrap);

  return {
    shop: bootstrap.shop,
    sessionKey: token.sessionKey,
    streamToken: token.streamToken,
    cart: {
      cartId: bootstrap.cartId,
      currencyCode: bootstrap.currencyCode,
      items: [
        {
          productId: "gid://shopify/Product/1",
          productTitle: "Core Training Gloves",
          variantId: "gid://shopify/ProductVariant/11",
          variantTitle: "12 oz / Black",
          quantity: 1,
        },
      ],
    },
    messages: [
      {
        role: "user",
        content: "Do I need wraps with these gloves?",
      },
    ],
    ...overrides,
  };
}

export function makeRecommendationListBlock(
  overrides: Partial<Extract<StructuredGuidanceBlock, { type: "recommendation_list" }>> = {},
): Extract<StructuredGuidanceBlock, { type: "recommendation_list" }> {
  return {
    blockId: "recommendation-1",
    type: "recommendation_list",
    title: "Recommended add-ons",
    summary: "These items complement the current cart.",
    priority: 1,
    items: [
      {
        productId: "gid://shopify/Product/42",
        productTitle: "Hand Wraps",
        variantId: "gid://shopify/ProductVariant/42",
        variantTitle: "180 in / Red",
        title: "Hand Wraps",
        action: "add",
        priorityLabel: "high",
        reason: "Useful add-on for the gloves already in the cart.",
        shopperOutcome: "Improves hand protection during training.",
        safetyCritical: true,
        priceLabel: "$14.99",
        availability: "available",
      },
    ],
    ...overrides,
  };
}

export function makeComparisonTableBlock(
  overrides: Partial<Extract<StructuredGuidanceBlock, { type: "comparison_table" }>> = {},
): Extract<StructuredGuidanceBlock, { type: "comparison_table" }> {
  return {
    blockId: "comparison-1",
    type: "comparison_table",
    title: "Quick comparison",
    summary: "A side-by-side look at the current options.",
    priority: 1,
    columns: [
      { key: "option-a", title: "Option A" },
      { key: "option-b", title: "Option B" },
    ],
    rows: [
      { label: "Weight", values: ["12 oz", "14 oz"] },
      { label: "Use", values: ["Bag work", "Sparring"] },
    ],
    ...overrides,
  };
}

export function makeSizeSummaryBlock(
  overrides: Partial<Extract<StructuredGuidanceBlock, { type: "size_summary" }>> = {},
): Extract<StructuredGuidanceBlock, { type: "size_summary" }> {
  return {
    blockId: "size-1",
    type: "size_summary",
    title: "Sizing summary",
    summary: "The current selection looks close to the intended fit.",
    priority: 1,
    confidence: 0.84,
    highlights: ["Runs true to size.", "Consider one size up for layering."],
    ...overrides,
  };
}

export function makeFallbackNoticeBlock(
  overrides: Partial<Extract<StructuredGuidanceBlock, { type: "fallback_notice" }>> = {},
): Extract<StructuredGuidanceBlock, { type: "fallback_notice" }> {
  return {
    blockId: "fallback-1",
    type: "fallback_notice",
    title: "Need more context",
    summary: "Share a bit more about fit or intended use for a stronger recommendation.",
    priority: 1,
    ...overrides,
  };
}

export function makeStorefrontChatSessionState(
  overrides: Partial<ChatSessionState> = {},
): ChatSessionState {
  const surface = (overrides.surface as StorefrontChatSurface | undefined) ?? "cart_drawer";

  return {
    shop: TEST_SHOP,
    surface,
    sessionId: TEST_SESSION_ID,
    cartId: "gid://shopify/Cart/123",
    currencyCode: "USD",
    isOpen: false,
    isCollapsed: false,
    status: "idle",
    draft: "",
    messages: [],
    lastError: undefined,
    retryableMessage: undefined,
    sessionKey: undefined,
    streamToken: undefined,
    streamTokenExpiresAt: undefined,
    chatUrl: undefined,
    ...overrides,
  };
}