import type {
  CartToolAction,
  CartToolActionPayload,
  StorefrontCartLine,
} from "../../app/lib/ai/schemas";
import type {
  StorefrontCartSnapshot,
  StorefrontCartSnapshotItem,
} from "../../app/lib/shopify/storefront-cart";

export const CART_CHAT_TEST_SHOP = "test.myshopify.com";
export const CART_CHAT_TEST_SESSION_KEY = "session-cart-chat-test";
export const CART_CHAT_TEST_CART_ID = "gid://shopify/Cart/fixture";

export function makeCartSnapshotItem(
  overrides: Partial<StorefrontCartSnapshotItem> = {},
): StorefrontCartSnapshotItem {
  return {
    lineId: "line-1",
    productId: "gid://shopify/Product/1",
    variantId: "gid://shopify/ProductVariant/11",
    quantity: 1,
    ...overrides,
  };
}

export function makeStorefrontCartSnapshot(
  overrides: Partial<StorefrontCartSnapshot> = {},
): StorefrontCartSnapshot {
  return {
    cartId: CART_CHAT_TEST_CART_ID,
    currencyCode: "USD",
    items: [makeCartSnapshotItem()],
    subtotal: "49.99",
    ...overrides,
  };
}

export function makeStorefrontCartLine(
  overrides: Partial<StorefrontCartLine> = {},
): StorefrontCartLine {
  return {
    lineId: "line-1",
    productId: "gid://shopify/Product/1",
    productTitle: "Core Training Gloves",
    variantId: "gid://shopify/ProductVariant/11",
    variantTitle: "12 oz / Black",
    quantity: 1,
    ...overrides,
  };
}

export function makeAddPayload(
  overrides: Partial<Extract<CartToolActionPayload, { actionType: "add" }>> = {},
): Extract<CartToolActionPayload, { actionType: "add" }> {
  return {
    actionType: "add",
    merchandiseId: "gid://shopify/ProductVariant/11",
    quantity: 1,
    ...overrides,
  };
}

export function makeRemovePayload(
  overrides: Partial<Extract<CartToolActionPayload, { actionType: "remove" }>> = {},
): Extract<CartToolActionPayload, { actionType: "remove" }> {
  return {
    actionType: "remove",
    lineId: "line-1",
    ...overrides,
  };
}

export function makeChangeQuantityPayload(
  overrides: Partial<Extract<CartToolActionPayload, { actionType: "change_quantity" }>> = {},
): Extract<CartToolActionPayload, { actionType: "change_quantity" }> {
  return {
    actionType: "change_quantity",
    lineId: "line-1",
    quantity: 2,
    ...overrides,
  };
}

export function makeSwapVariantPayload(
  overrides: Partial<Extract<CartToolActionPayload, { actionType: "swap_variant" }>> = {},
): Extract<CartToolActionPayload, { actionType: "swap_variant" }> {
  return {
    actionType: "swap_variant",
    lineId: "line-1",
    newMerchandiseId: "gid://shopify/ProductVariant/12",
    quantity: 1,
    ...overrides,
  };
}

export function makeCartToolAction(
  overrides: Partial<CartToolAction> = {},
): CartToolAction {
  return {
    actionId: "action-1",
    toolName: "changeQuantity",
    shop: CART_CHAT_TEST_SHOP,
    sessionKey: CART_CHAT_TEST_SESSION_KEY,
    cartId: CART_CHAT_TEST_CART_ID,
    payload: makeChangeQuantityPayload(),
    confirmationToken: "confirmation-token",
    expiresAt: "2030-01-01T00:00:00.000Z",
    ...overrides,
  };
}

export interface ConfirmCartActionRequestFixture {
  shop: string;
  sessionKey: string;
  actionId: string;
  confirmationToken: string;
  decision: "approve" | "decline";
  actionType: "cart_tool";
  cart?: {
    cartId?: string;
    currencyCode: string;
    items: Array<{
      lineId?: string;
      productId: string;
      variantId?: string;
      quantity: number;
    }>;
    subtotal?: string;
  };
}

export function makeConfirmCartActionRequestFixture(
  overrides: Partial<ConfirmCartActionRequestFixture> = {},
): ConfirmCartActionRequestFixture {
  return {
    shop: CART_CHAT_TEST_SHOP,
    sessionKey: CART_CHAT_TEST_SESSION_KEY,
    actionId: "action-1",
    confirmationToken: "confirmation-token",
    decision: "approve",
    actionType: "cart_tool",
    cart: {
      cartId: CART_CHAT_TEST_CART_ID,
      currencyCode: "USD",
      items: [
        {
          lineId: "line-1",
          productId: "gid://shopify/Product/1",
          variantId: "gid://shopify/ProductVariant/11",
          quantity: 1,
        },
      ],
      subtotal: "49.99",
    },
    ...overrides,
  };
}
