export const TEST_SHOP = "test.myshopify.com";
export const TEST_CUSTOMER_ID = "gid://shopify/Customer/123";

export interface ReplenishmentLifecycleRuleFixture {
  categoryTag: string;
  label: string;
  windowMinDays: number;
  windowMaxDays: number;
  priority: number;
  defaultAction: "reorder" | "upgrade_optional";
}

export interface CustomerPurchaseSnapshotFixture {
  shop: string;
  shopifyCustomerId: string;
  productId: string;
  variantId?: string;
  categoryTag: string;
  firstPurchasedAt: string | Date;
  lastPurchasedAt: string | Date;
  orderCount: number;
  totalQuantity: number;
  latestTitle: string;
  latestVariantTitle?: string;
  inferredCadenceDays?: number;
  preferredAction: "reorder" | "upgrade";
}

export interface ReplenishmentRequestFixture {
  shop: string;
  currencyCode: string;
  shopifyCustomerId?: string;
  sessionId?: string;
  cart: Array<{
    productId: string;
    variantId?: string;
    quantity: number;
  }>;
}

export function makeLifecycleRuleFixture(
  overrides: Partial<ReplenishmentLifecycleRuleFixture> = {},
): ReplenishmentLifecycleRuleFixture {
  return {
    categoryTag: "hand-wraps",
    label: "Hand Wraps",
    windowMinDays: 90,
    windowMaxDays: 180,
    priority: 1,
    defaultAction: "reorder",
    ...overrides,
  };
}

export function makePurchaseSnapshotFixture(
  overrides: Partial<CustomerPurchaseSnapshotFixture> = {},
): CustomerPurchaseSnapshotFixture {
  return {
    shop: TEST_SHOP,
    shopifyCustomerId: TEST_CUSTOMER_ID,
    productId: "prod-hand-wraps-black",
    variantId: "var-hand-wraps-black",
    categoryTag: "hand-wraps",
    firstPurchasedAt: "2026-01-01T00:00:00.000Z",
    lastPurchasedAt: "2026-02-01T00:00:00.000Z",
    orderCount: 2,
    totalQuantity: 2,
    latestTitle: "Hand Wraps",
    latestVariantTitle: "Black",
    inferredCadenceDays: 120,
    preferredAction: "reorder",
    ...overrides,
  };
}

export function makeReplenishmentRecommendationRequest(
  overrides: Partial<ReplenishmentRequestFixture> = {},
): ReplenishmentRequestFixture {
  return {
    shop: TEST_SHOP,
    currencyCode: "USD",
    shopifyCustomerId: TEST_CUSTOMER_ID,
    sessionId: "session-123",
    cart: [],
    ...overrides,
  };
}

export function makeOrderWebhookPayload() {
  return {
    id: "order-123",
    processed_at: "2026-05-28T12:00:00.000Z",
    current_total_price: "79.99",
    currency: "USD",
    customer: {
      admin_graphql_api_id: TEST_CUSTOMER_ID,
    },
    line_items: [
      {
        title: "Hand Wraps",
      },
      {
        title: "Mouthguard",
      },
    ],
  };
}