import { describe, expect, it } from "vitest";
import { ColorCompatibility } from "@prisma/client";
import { scoreStyleCoherence, type CartVisualItem } from "../../../app/lib/cart-intelligence/style-coherence";

function makeItem(overrides: Partial<CartVisualItem> = {}): CartVisualItem {
  return {
    productId: "prod-1",
    title: "Product",
    categoryTags: ["gloves"],
    availableForSale: true,
    selectedVariantId: "var-1",
    visualProfile: {
      dominantColors: ["#111827", "#d97706"],
      effectiveColorwayKeys: ["black-gold"],
      effectiveCollections: [{ key: "pro", label: "Pro", source: "shopify" }],
      visualConfidence: 0.82,
    },
    ...overrides,
  };
}

describe("scoreStyleCoherence", () => {
  it("marks a tightly matched cart as cohesive and suppresses suggestions", () => {
    const result = scoreStyleCoherence({
      shop: "test.myshopify.com",
      items: [
        makeItem({ productId: "prod-1", title: "Gloves", categoryTags: ["gloves"] }),
        makeItem({ productId: "prod-2", title: "Headgear", categoryTags: ["headgear"], selectedVariantId: "var-2" }),
      ],
      compatibilityRules: [],
    });

    expect(result.status).toBe("cohesive");
    expect(result.suggestions).toHaveLength(0);
  });

  it("suggests a collection-completion add when two cart items share a collection", () => {
    const result = scoreStyleCoherence({
      shop: "test.myshopify.com",
      items: [
        makeItem({ productId: "prod-1", title: "Gloves", categoryTags: ["gloves"] }),
        makeItem({ productId: "prod-2", title: "Headgear", categoryTags: ["headgear"], selectedVariantId: "var-2" }),
        makeItem({
          productId: "prod-3",
          title: "Mouthguard",
          categoryTags: ["mouthguard"],
          selectedVariantId: "var-3",
          visualProfile: {
            dominantColors: ["#dc2626"],
            effectiveColorwayKeys: ["red"],
            effectiveCollections: [],
            visualConfidence: 0.35,
          },
        }),
      ],
      compatibilityRules: [{ sourceColorwayKey: "black-gold", targetColorwayKey: "red", compatibility: ColorCompatibility.AVOID }],
      candidateProducts: [
        makeItem({ productId: "prod-4", title: "Shin Guards", categoryTags: ["shin-guards"], selectedVariantId: "var-4" }),
      ],
    });

    expect(result.suggestions.some((suggestion) => suggestion.type === "add" && suggestion.candidateProductId === "prod-4")).toBe(true);
  });

  it("suggests a swap when a same-category candidate improves a clashing cart", () => {
    const clashingItem = makeItem({
      productId: "prod-2",
      title: "Headgear",
      categoryTags: ["headgear"],
      selectedVariantId: "var-2",
      visualProfile: {
        dominantColors: ["#dc2626"],
        effectiveColorwayKeys: ["red"],
        effectiveCollections: [],
        visualConfidence: 0.48,
      },
    });

    const result = scoreStyleCoherence({
      shop: "test.myshopify.com",
      items: [makeItem({ productId: "prod-1", title: "Gloves" }), clashingItem],
      compatibilityRules: [{ sourceColorwayKey: "black-gold", targetColorwayKey: "red", compatibility: ColorCompatibility.AVOID }],
      candidateProducts: [
        makeItem({
          productId: "prod-3",
          title: "Replacement Headgear",
          categoryTags: ["headgear"],
          selectedVariantId: "var-3",
          visualProfile: {
            dominantColors: ["#111827", "#d97706"],
            effectiveColorwayKeys: ["black-gold"],
            effectiveCollections: [{ key: "pro", label: "Pro", source: "merchant" }],
            visualConfidence: 0.91,
          },
        }),
      ],
    });

    expect(result.status).toBe("clashing");
    expect(result.suggestions.some((suggestion) => suggestion.type === "swap" && suggestion.candidateProductId === "prod-3")).toBe(true);
  });

  it("returns mixed for lower-confidence palette-only overlap", () => {
    const result = scoreStyleCoherence({
      shop: "test.myshopify.com",
      items: [
        makeItem({
          productId: "prod-1",
          visualProfile: {
            dominantColors: ["#111827"],
            effectiveColorwayKeys: [],
            effectiveCollections: [],
            visualConfidence: 0.21,
          },
        }),
        makeItem({
          productId: "prod-2",
          categoryTags: ["headgear"],
          visualProfile: {
            dominantColors: ["#111827", "#2563eb"],
            effectiveColorwayKeys: [],
            effectiveCollections: [],
            visualConfidence: 0.25,
          },
        }),
      ],
      compatibilityRules: [],
    });

    expect(result.status).toBe("mixed");
  });

  it("excludes unavailable candidates from suggestions", () => {
    const result = scoreStyleCoherence({
      shop: "test.myshopify.com",
      items: [
        makeItem({ productId: "prod-1" }),
        makeItem({
          productId: "prod-2",
          categoryTags: ["headgear"],
          visualProfile: {
            dominantColors: ["#dc2626"],
            effectiveColorwayKeys: ["red"],
            effectiveCollections: [],
            visualConfidence: 0.33,
          },
        }),
      ],
      compatibilityRules: [{ sourceColorwayKey: "black-gold", targetColorwayKey: "red", compatibility: ColorCompatibility.AVOID }],
      candidateProducts: [
        makeItem({
          productId: "prod-3",
          categoryTags: ["headgear"],
          availableForSale: false,
          visualProfile: {
            dominantColors: ["#111827"],
            effectiveColorwayKeys: ["black-gold"],
            effectiveCollections: [{ key: "pro", label: "Pro", source: "merchant" }],
            visualConfidence: 0.92,
          },
        }),
      ],
    });

    expect(result.suggestions).toHaveLength(0);
  });
});