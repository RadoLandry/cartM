import { ColorCompatibility } from "@prisma/client";

import type {
  CartVisualItem,
  StyleCompatibilityRule,
} from "../../app/lib/cart-intelligence/style-coherence";

export const TEST_SHOP = "test.myshopify.com";

export function makeCartVisualItem(
  overrides: Partial<CartVisualItem> = {},
): CartVisualItem {
  return {
    productId: "prod-gloves-black-gold",
    title: "Baseline visual item",
    categoryTags: ["gloves"],
    availableForSale: true,
    selectedVariantId: "var-gloves-black-gold",
    selectedColorwayKey: "black-gold",
    visualProfile: {
      dominantColors: ["#111827", "#d97706"],
      effectiveColorwayKeys: ["black-gold"],
      effectiveCollections: [
        {
          key: "pro-series",
          label: "Pro Series",
          source: "shopify",
        },
      ],
      visualConfidence: 0.86,
    },
    ...overrides,
  };
}

export function makeStyleCompatibilityRule(
  overrides: Partial<StyleCompatibilityRule> = {},
): StyleCompatibilityRule {
  return {
    sourceColorwayKey: "black-gold",
    targetColorwayKey: "red",
    compatibility: ColorCompatibility.AVOID,
    ...overrides,
  };
}

export function makeCoordinatedCart(): CartVisualItem[] {
  return [
    makeCartVisualItem({
      productId: "prod-gloves-black-gold",
      title: "Boxing Gloves",
      categoryTags: ["gloves", "boxing-gloves"],
      selectedVariantId: "var-gloves-black-gold",
    }),
    makeCartVisualItem({
      productId: "prod-headgear-black-gold",
      title: "Headgear",
      categoryTags: ["headgear"],
      selectedVariantId: "var-headgear-black-gold",
    }),
  ];
}

export function makeClashingCart(): CartVisualItem[] {
  return [
    makeCartVisualItem({
      productId: "prod-gloves-black-gold",
      title: "Boxing Gloves",
      categoryTags: ["gloves", "boxing-gloves"],
      selectedVariantId: "var-gloves-black-gold",
    }),
    makeCartVisualItem({
      productId: "prod-headgear-red",
      title: "Headgear",
      categoryTags: ["headgear"],
      selectedVariantId: "var-headgear-red",
      selectedColorwayKey: "red",
      visualProfile: {
        dominantColors: ["#dc2626"],
        effectiveColorwayKeys: ["red"],
        effectiveCollections: [],
        visualConfidence: 0.44,
      },
    }),
  ];
}

export function makeAdditionCandidates(): CartVisualItem[] {
  return [
    makeCartVisualItem({
      productId: "prod-shin-guards-black-gold",
      title: "Shin Guards",
      categoryTags: ["shin-guards"],
      selectedVariantId: "var-shin-guards-black-gold",
    }),
  ];
}

export function makeSwapCandidates(): CartVisualItem[] {
  return [
    makeCartVisualItem({
      productId: "prod-headgear-black-gold",
      title: "Replacement Headgear",
      categoryTags: ["headgear"],
      selectedVariantId: "var-headgear-black-gold",
    }),
  ];
}