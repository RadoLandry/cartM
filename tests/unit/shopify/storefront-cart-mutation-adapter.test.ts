import { describe, expect, it } from "vitest";

import { storefrontCartMutationAdapter } from "../../../app/lib/shopify/storefront-cart";
import {
  makeStorefrontCartSnapshot,
  makeCartSnapshotItem,
} from "../../helpers/storefront-chat-cart-fixtures";

describe("storefront cart mutation adapter", () => {
  it("returns MUTATION_ERROR when cart id is missing for add operations", async () => {
    const outcome = await storefrontCartMutationAdapter.addLine({
      cartId: "",
      merchandiseId: "gid://shopify/ProductVariant/11",
      quantity: 1,
      idempotencyKey: "add-missing-cart-id",
      cart: makeStorefrontCartSnapshot(),
    });

    expect(outcome.ok).toBe(false);
    expect(outcome.code).toBe("MUTATION_ERROR");
  });

  it("restores original variant when swap replacement fails", async () => {
    const originalVariantId = "gid://shopify/ProductVariant/original";
    const cart = makeStorefrontCartSnapshot({
      items: [
        makeCartSnapshotItem({
          lineId: "line-1",
          variantId: originalVariantId,
          quantity: 2,
        }),
      ],
    });

    const outcome = await storefrontCartMutationAdapter.swapLineVariant({
      cartId: "gid://shopify/Cart/fixture",
      lineId: "line-1",
      newMerchandiseId: "gid://shopify/ProductVariant/unavailable",
      quantity: 2,
      idempotencyKey: "swap-with-rollback",
      cart,
    });

    expect(outcome.ok).toBe(false);
    expect(outcome.code).toBe("CART_CONFLICT");
    expect(outcome.cart.items.some((item) => item.variantId === originalVariantId)).toBe(true);
    expect(outcome.cart.items.some((item) => item.variantId?.includes("unavailable"))).toBe(false);
  });

  it("returns QUANTITY_INVALID when updating quantity below minimum", async () => {
    const outcome = await storefrontCartMutationAdapter.updateLineQuantity({
      cartId: "gid://shopify/Cart/fixture",
      lineId: "line-1",
      quantity: 0,
      idempotencyKey: "qty-invalid",
      cart: makeStorefrontCartSnapshot(),
    });

    expect(outcome.ok).toBe(false);
    expect(outcome.code).toBe("QUANTITY_INVALID");
  });
});
