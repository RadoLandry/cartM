import { beforeEach, describe, expect, it, vi } from "vitest";

import { action, loader } from "../../../app/routes/api.ai.cart-analysis";
import db from "../../../app/db.server";

vi.mock("../../../app/db.server", () => ({
  default: {
    product: {
      findMany: vi.fn(),
    },
  },
}));

describe("cart analysis route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.product.findMany).mockResolvedValue([
      {
        id: "product-1",
        shopifyProductId: "gid://shopify/Product/1",
        title: "Gants de boxe debutant",
        tags: ["entrainement", "debutant"],
        disciplineTags: ["Boxe"],
        categoryTags: ["gants"],
        collectionIds: ["boxing-starter-kit"],
        variants: [{ shopifyVariantId: "gid://shopify/ProductVariant/11" }],
        visualProfile: {
          detectedCollections: [{ label: "Kit boxe debutant" }],
          overrideCollections: null,
        },
      },
      {
        id: "product-2",
        shopifyProductId: "gid://shopify/Product/2",
        title: "Short de boxe",
        tags: ["training"],
        disciplineTags: ["Boxe"],
        categoryTags: ["short"],
        collectionIds: [],
        variants: [],
        visualProfile: null,
      },
      {
        id: "product-3",
        shopifyProductId: "gid://shopify/Product/3",
        title: "Bandages boxe",
        tags: ["protection"],
        disciplineTags: ["Boxe"],
        categoryTags: ["bandages"],
        collectionIds: [],
        variants: [],
        visualProfile: null,
      },
    ] as never);
  });

  it("returns generated cart context from the action body", async () => {
    const response = await action({
      request: new Request("http://localhost/api/ai/cart-analysis", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          shop: "test.myshopify.com",
          cart: [
            { productId: "1", variantId: "11", quantity: 1 },
            { productId: "2", quantity: 1 },
            { productId: "3", quantity: 1 },
          ],
        }),
      }),
      params: {},
      context: {},
    } as never);
    const payload = await response.json();

    expect(db.product.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ shop: "test.myshopify.com" }),
    }));
    expect(payload.ok).toBe(true);
    expect(payload.context).toMatchObject({
      sport: "Boxe",
      level: "Debutant",
      objective: "Entrainement",
    });
    expect(payload.context.products).toHaveLength(3);
    expect(payload.context.collections).toContain("boxing-starter-kit");
    expect(payload.context.collections).toContain("Kit boxe debutant");
    expect(payload.context.aiSummary).toContain("Sport : Boxe");
  });

  it("supports the loader query-string contract", async () => {
    const response = await loader({
      request: new Request("http://localhost/api/ai/cart-analysis?shop=test.myshopify.com&productId=1&productId=2&quantity=2&quantity=1"),
      params: {},
      context: {},
    } as never);
    const payload = await response.json();

    expect(payload.ok).toBe(true);
    expect(payload.request.cart).toEqual([
      { productId: "1", quantity: 2 },
      { productId: "2", quantity: 1 },
    ]);
  });

  it("rejects invalid input", async () => {
    const response = await action({
      request: new Request("http://localhost/api/ai/cart-analysis", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ shop: "", cart: [{ productId: "" }] }),
      }),
      params: {},
      context: {},
    } as never);
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.ok).toBe(false);
  });
});