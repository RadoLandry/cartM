import { beforeEach, describe, expect, it, vi } from "vitest";

import { action, loader } from "../../../app/routes/api.ai.recommendations";
import * as dbQueries from "../../../app/lib/db/queries";
import {
  makeCoordinatedCart,
  makeClashingCart,
  makeSwapCandidates,
} from "../../helpers/style-fixtures";

vi.mock("../../../app/lib/db/queries", () => ({
  getColorCompatibilityRulesForKeys: vi.fn(),
  listCartVisualItems: vi.fn(),
  listStyleCandidateProducts: vi.fn(),
}));

describe("style recommendations route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(dbQueries.getColorCompatibilityRulesForKeys).mockResolvedValue([
      {
        id: "rule-1",
        shop: "test.myshopify.com",
        sourceColorwayKey: "black-gold",
        targetColorwayKey: "red",
        compatibility: "AVOID",
        source: "MERCHANT",
        rationale: "Avoid clashing red against the black/gold line.",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ] as never);
  });

  it("returns shopper-facing swap opportunities from the loader", async () => {
    vi.mocked(dbQueries.listCartVisualItems).mockResolvedValue(makeClashingCart() as never);
    vi.mocked(dbQueries.listStyleCandidateProducts).mockResolvedValue(makeSwapCandidates() as never);

    const response = await loader({
      request: new Request("http://localhost/api/ai/recommendations?shop=test.myshopify.com&productId=prod-gloves-black-gold&productId=prod-headgear-red"),
      params: {},
      context: {},
    } as never);
    const payload = await response.json();

    expect(dbQueries.listCartVisualItems).toHaveBeenCalledWith("test.myshopify.com", [
      { productId: "prod-gloves-black-gold", variantId: undefined, quantity: 1 },
      { productId: "prod-headgear-red", variantId: undefined, quantity: 1 },
    ]);
    expect(payload.style.summary.status).toBe("clashing");
    expect(payload.style.opportunities).toEqual([
      expect.objectContaining({
        type: "swap",
        productId: "prod-headgear-black-gold",
        title: "Replacement Headgear",
        rank: 1,
      }),
    ]);
  });

  it("returns shopper-facing swap opportunities from the action body contract", async () => {
    vi.mocked(dbQueries.listCartVisualItems).mockResolvedValue(makeClashingCart() as never);
    vi.mocked(dbQueries.listStyleCandidateProducts).mockResolvedValue(makeSwapCandidates() as never);

    const response = await action({
      request: new Request("http://localhost/api/ai/recommendations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          shop: "test.myshopify.com",
          cart: [
            { productId: "prod-gloves-black-gold", quantity: 1 },
            { productId: "prod-headgear-red", quantity: 1 },
          ],
        }),
      }),
      params: {},
      context: {},
    } as never);
    const payload = await response.json();

    expect(payload.style.summary.status).toBe("clashing");
    expect(payload.style.opportunities[0]).toMatchObject({
      type: "swap",
      productId: "prod-headgear-black-gold",
      title: "Replacement Headgear",
    });
  });

  it("returns a hidden payload when the cart is already visually cohesive", async () => {
    vi.mocked(dbQueries.listCartVisualItems).mockResolvedValue(makeCoordinatedCart() as never);
    vi.mocked(dbQueries.listStyleCandidateProducts).mockResolvedValue(makeSwapCandidates() as never);

    const response = await loader({
      request: new Request("http://localhost/api/ai/recommendations?shop=test.myshopify.com&productId=prod-gloves-black-gold&productId=prod-headgear-black-gold"),
      params: {},
      context: {},
    } as never);
    const payload = await response.json();

    expect(payload.style.summary).toEqual({
      status: "hidden",
      coherenceScore: "0.90",
      reason: "The cart is already visually coordinated.",
    });
    expect(payload.style.opportunities).toEqual([]);
  });

  it("propagates merchant-approved colorway keys into the compatibility-rule lookup", async () => {
    vi.mocked(dbQueries.listCartVisualItems).mockResolvedValue([
      {
        productId: "prod-gloves-override",
        title: "Merchant Override Gloves",
        categoryTags: ["gloves"],
        availableForSale: true,
        selectedVariantId: "var-gloves-red-title",
        selectedColorwayKey: "black-gold",
        visualProfile: {
          dominantColors: ["#111827", "#d97706"],
          effectiveColorwayKeys: ["black-gold"],
          effectiveCollections: [{ key: "pro-series", label: "Pro Series", source: "merchant" }],
          visualConfidence: 0.92,
        },
      },
    ] as never);
    vi.mocked(dbQueries.listStyleCandidateProducts).mockResolvedValue([] as never);

    await loader({
      request: new Request("http://localhost/api/ai/recommendations?shop=test.myshopify.com&productId=prod-gloves-override"),
      params: {},
      context: {},
    } as never);

    expect(dbQueries.getColorCompatibilityRulesForKeys).toHaveBeenCalledWith(
      "test.myshopify.com",
      ["black-gold"],
    );
  });
});