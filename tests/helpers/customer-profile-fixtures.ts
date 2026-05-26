export const TEST_SHOP = "test.myshopify.com";
export const TEST_CUSTOMER_ID = "gid://shopify/Customer/123";
export const TEST_SESSION_ID = "session-123";

export interface CustomerProfileCartLineFixture {
  productId: string;
  variantId?: string;
  quantity: number;
}

export interface CustomerProfileRequestFixture {
  shop: string;
  cartId?: string;
  currencyCode: string;
  shopifyCustomerId?: string;
  sessionId?: string;
  profileInput?: {
    discipline?: string;
    experienceLevel?: string;
    weightClass?: string;
    knownSizes?: Record<string, string>;
  };
  cart: CustomerProfileCartLineFixture[];
}

export interface StoredCustomerProfileFixture {
  shop: string;
  shopifyCustomerId?: string;
  sessionId?: string;
  sizeProfile: Record<string, string>;
  disciplineProfile: Record<string, unknown>;
  explicitProfile: Record<string, unknown>;
  purchaseSummary: Record<string, unknown>;
  behaviorSummary: Record<string, unknown>;
  confidenceSummary: Record<string, unknown>;
  lastActiveAt: Date | null;
}

export function makeCustomerProfileCartLine(
  overrides: Partial<CustomerProfileCartLineFixture> = {},
): CustomerProfileCartLineFixture {
  return {
    productId: "prod-gloves-black-gold",
    variantId: "var-gloves-black-gold",
    quantity: 1,
    ...overrides,
  };
}

export function makeCustomerProfileRecommendationRequest(
  overrides: Partial<CustomerProfileRequestFixture> = {},
): CustomerProfileRequestFixture {
  return {
    shop: TEST_SHOP,
    cartId: "cart-123",
    currencyCode: "USD",
    shopifyCustomerId: TEST_CUSTOMER_ID,
    sessionId: TEST_SESSION_ID,
    profileInput: {
      discipline: "boxing",
      experienceLevel: "advanced",
      weightClass: "welterweight",
      knownSizes: {
        gloves_oz: "14oz",
      },
    },
    cart: [
      makeCustomerProfileCartLine(),
      makeCustomerProfileCartLine({
        productId: "prod-headgear-black-gold",
        variantId: "var-headgear-black-gold",
      }),
    ],
    ...overrides,
  };
}

export function makeStoredCustomerProfileFixture(
  overrides: Partial<StoredCustomerProfileFixture> = {},
): StoredCustomerProfileFixture {
  return {
    shop: TEST_SHOP,
    shopifyCustomerId: TEST_CUSTOMER_ID,
    sessionId: undefined,
    sizeProfile: {
      gloves_oz: "14oz",
      apparel_alpha: "M",
    },
    disciplineProfile: {
      primaryDiscipline: "boxing",
      weights: {
        boxing: 0.91,
      },
    },
    explicitProfile: {
      experienceLevel: "advanced",
    },
    purchaseSummary: {
      totalOrders: 4,
      repeatCategoryTags: ["gloves", "headgear"],
    },
    behaviorSummary: {
      recentCategoryTags: ["gloves", "boxing-gloves"],
    },
    confidenceSummary: {
      overall: 0.87,
      sizeProfile: 0.93,
    },
    lastActiveAt: new Date("2026-05-26T12:00:00.000Z"),
    ...overrides,
  };
}