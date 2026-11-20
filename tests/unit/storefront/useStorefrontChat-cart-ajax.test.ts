import { describe, expect, it, vi } from "vitest";

import { applyStorefrontCartAction, normalizeAjaxMerchandiseId } from "../../../storefront-widget/src/hooks/useStorefrontChat";
import type { StorefrontCartSnapshot } from "../../../storefront-widget/src/types";
import { makeCartToolAction, makeStorefrontCartSnapshot as makeServerCartSnapshot } from "../../helpers/storefront-chat-cart-fixtures";

function makeStorefrontCartSnapshot(overrides: Parameters<typeof makeServerCartSnapshot>[0] = {}): StorefrontCartSnapshot {
  const cart = makeServerCartSnapshot(overrides);
  return { ...cart, items: cart.items.map((item) => {
    if (!item.productId) throw new Error("Widget fixtures require a productId.");
    return { ...item, productId: item.productId };
  }) };
}

describe("storefront cart ajax action application", () => {
  it.each(["success", "wrong-quantity", "stale"])("verifies budget plan application: %s", async (outcome) => {
    const currentCart: StorefrontCartSnapshot = { currencyCode: "EUR", subtotal: "114.99", items: [
      { lineId: "wraps", productId: "1", variantId: "11", quantity: 1, finalLinePrice: 14.99 },
      { lineId: "rashguard", productId: "2", variantId: "22", quantity: 2, finalLinePrice: 60 },
      { lineId: "gloves", productId: "3", variantId: "33", quantity: 1, finalLinePrice: 40 },
    ] };
    const action = makeCartToolAction({ toolName: "optimizeBudget", payload: {
      actionType: "budget_optimization_select", optimizationContextId: "budget", candidateIds: ["rashguard"],
      baselineCart: structuredClone(currentCart), changes: [{ lineId: "rashguard", quantity: 1 }],
    } });
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce(new Response("{}"))
      .mockResolvedValueOnce(new Response(JSON.stringify({ currency: "EUR", total_price: 8499,
        items: currentCart.items.map((item) => ({ key: item.lineId, product_id: Number(item.productId), variant_id: Number(item.variantId),
          quantity: item.lineId === "rashguard" && outcome === "success" ? 1 : item.quantity,
          final_line_price: item.lineId === "rashguard" ? 3000 : item.finalLinePrice! * 100,
        })),
      })));
    if (outcome === "stale") currentCart.items[1].quantity = 3;
    const result = applyStorefrontCartAction(action, currentCart, fetchMock);
    if (outcome === "success") {
      expect((await result).subtotal).toBe("84.99");
      expect(fetchMock).toHaveBeenNthCalledWith(1, "/cart/update.js", expect.objectContaining({ body: JSON.stringify({ updates: { rashguard: 1 } }) }));
    } else {
      await expect(result).rejects.toThrow(outcome === "stale" ? "cart changed" : "verification failed");
    }
    expect(fetchMock).toHaveBeenCalledTimes(outcome === "stale" ? 0 : 2);
  });

  it("normalizes Shopify variant gids for ajax cart endpoints", () => {
    expect(normalizeAjaxMerchandiseId("gid://shopify/ProductVariant/123456")).toBe("123456");
    expect(normalizeAjaxMerchandiseId("  987654  ")).toBe("987654");
  });

  it.each([11, 1])("verifies the actual swapped quantity (%s)", async (quantity) => {
    const action = makeCartToolAction({ payload: {
      actionType: "swap_variant", lineId: "pants-xs", newMerchandiseId: "442", quantity: 11,
    } });
    const currentCart = makeStorefrontCartSnapshot({ items: [{
      lineId: "pants-xs", productId: "44", variantId: "441", quantity: 11,
    }] });
    const fetchMock = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response("{}"))
      .mockResolvedValueOnce(new Response("{}"))
      .mockResolvedValueOnce(new Response(JSON.stringify({ currency: "EUR", items: [{
        key: "pants-s", product_id: 44, variant_id: 442, quantity,
      }] })));
    const result = applyStorefrontCartAction(action, currentCart, fetchMock);
    if (quantity === 11) {
      expect((await result).items[0].quantity).toBe(11);
    } else {
      await expect(result).rejects.toThrow("verification failed");
    }
    expect(JSON.parse(fetchMock.mock.calls[1][1]?.body as string).quantity).toBe(11);
  });

  it("rejects failed Shopify HTTP responses", async () => {
    const action = makeCartToolAction({ payload: { actionType: "remove", lineId: "line-1" } });
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce(new Response("{}", { status: 422 }));
    await expect(applyStorefrontCartAction(action, makeStorefrontCartSnapshot(), fetchMock)).rejects.toThrow("mutation failed");
    expect(fetchMock).toHaveBeenCalledTimes(1);
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