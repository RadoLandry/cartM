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

  it("applies batched change_quantity updates through Shopify ajax", async () => {
    const action = makeCartToolAction({
      payload: {
        actionType: "change_quantity",
        lineId: "line-shorts",
        quantity: 5,
        changes: [
          { lineId: "line-shorts", quantity: 5 },
          { lineId: "line-jacket", quantity: 3 },
        ],
      },
    });
    const currentCart = makeStorefrontCartSnapshot({
      items: [
        {
          lineId: "line-shorts",
          productId: "gid://shopify/Product/20",
          variantId: "gid://shopify/ProductVariant/201",
          quantity: 7,
        },
        {
          lineId: "line-jacket",
          productId: "gid://shopify/Product/10",
          variantId: "gid://shopify/ProductVariant/101",
          quantity: 6,
        },
      ],
    });

    const fetchMock = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        token: currentCart.cartId,
        currency: currentCart.currencyCode,
        items: [
          {
            key: "line-shorts",
            product_id: 20,
            product_title: "Short Venum Gladiator",
            variant_id: 201,
            variant_title: "M / Black",
            quantity: 5,
          },
          {
            key: "line-jacket",
            product_id: 10,
            product_title: "Veste Venum Elite",
            variant_id: 101,
            variant_title: "M / Black",
            quantity: 3,
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
      body: JSON.stringify({ id: "line-shorts", quantity: 5 }),
    }));
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/cart/change.js", expect.objectContaining({
      method: "POST",
      credentials: "same-origin",
      body: JSON.stringify({ id: "line-jacket", quantity: 3 }),
    }));
    expect(fetchMock).toHaveBeenNthCalledWith(3, "/cart.js", expect.objectContaining({
      method: "GET",
      credentials: "same-origin",
    }));
    expect(nextCart.items.find((item) => item.lineId === "line-shorts")?.quantity).toBe(5);
    expect(nextCart.items.find((item) => item.lineId === "line-jacket")?.quantity).toBe(3);
  });
});