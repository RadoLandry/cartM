import { describe, expect, it, vi } from "vitest";

import { applyStorefrontCartAction, normalizeAjaxMerchandiseId } from "../../../storefront-widget/src/hooks/useStorefrontChat";
import { makeCartToolAction, makeStorefrontCartSnapshot } from "../../helpers/storefront-chat-cart-fixtures";

describe("storefront cart ajax action application", () => {
  it("normalizes Shopify variant gids for ajax cart endpoints", () => {
    expect(normalizeAjaxMerchandiseId("gid://shopify/ProductVariant/123456")).toBe("123456");
    expect(normalizeAjaxMerchandiseId("  987654  ")).toBe("987654");
  });

  it("applies change_quantity through Shopify ajax and returns the refreshed cart", async () => {
    const action = makeCartToolAction({
      payload: {
        actionType: "change_quantity",
        lineId: "line-1",
        quantity: 5,
      },
    });
    const currentCart = makeStorefrontCartSnapshot({
      items: [
        {
          lineId: "line-1",
          productId: "gid://shopify/Product/1",
          variantId: "gid://shopify/ProductVariant/11",
          quantity: 2,
        },
      ],
    });

    const fetchMock = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        token: currentCart.cartId,
        currency: currentCart.currencyCode,
        items: [
          {
            key: "line-1",
            product_id: 1,
            product_title: "Fightshort Venum Gladiator 3.0 - Noir/Blanc",
            variant_id: 11,
            variant_title: "Noir/Blanc",
            quantity: 5,
          },
        ],
      }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }));

    const nextCart = await applyStorefrontCartAction(action, currentCart, fetchMock);

    expect(fetchMock).toHaveBeenNthCalledWith(1, "/cart/change.js", expect.objectContaining({
      method: "POST",
      credentials: "same-origin",
      body: JSON.stringify({ id: "line-1", quantity: 5 }),
    }));
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/cart.js", expect.objectContaining({
      method: "GET",
      credentials: "same-origin",
    }));
    expect(nextCart.items[0]?.quantity).toBe(5);
  });
});