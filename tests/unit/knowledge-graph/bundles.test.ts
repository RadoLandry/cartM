import { describe, expect, it } from "vitest";
import { BundleComponentMatchMode } from "@prisma/client";

import {
  rankBundleCompletionCandidates,
  type BundleCompletionCandidateProduct,
  type BundleRuleComponentDefinition,
} from "../../../app/lib/knowledge-graph/bundles";

function makeComponent(
  overrides: Partial<BundleRuleComponentDefinition> = {},
): BundleRuleComponentDefinition {
  return {
    id: "component-mouthguard",
    componentKey: "mouthguard",
    label: "Mouthguard",
    isRequired: true,
    sortOrder: 10,
    minQuantity: 1,
    matchMode: BundleComponentMatchMode.CATEGORY_OR_PRODUCT,
    acceptedCategoryTags: ["mouthguard"],
    acceptedShopifyProductIds: ["gid://shopify/Product/200"],
    acceptedShopifyVariantIds: ["gid://shopify/ProductVariant/2001"],
    ...overrides,
  };
}

function makeCandidate(
  overrides: Partial<BundleCompletionCandidateProduct> = {},
): BundleCompletionCandidateProduct {
  return {
    productId: "prod-mouthguard",
    shopifyProductId: "gid://shopify/Product/200",
    title: "Venum Mouthguard",
    categoryTags: ["mouthguard"],
    variants: [
      {
        id: "var-mouthguard-black",
        shopifyVariantId: "gid://shopify/ProductVariant/2001",
        title: "Black",
        inventoryQuantity: 8,
      },
    ],
    ...overrides,
  };
}

describe("rankBundleCompletionCandidates", () => {
  it("prioritizes available exact matches ahead of category-only and unavailable candidates", () => {
    const component = makeComponent();

    const ranked = rankBundleCompletionCandidates(component, [
      makeCandidate({
        productId: "prod-category-only",
        shopifyProductId: "gid://shopify/Product/201",
        title: "Generic Mouthguard",
        variants: [
          {
            id: "var-category-only",
            shopifyVariantId: "gid://shopify/ProductVariant/2011",
            title: "Default",
            inventoryQuantity: 11,
          },
        ],
      }),
      makeCandidate({
        productId: "prod-unavailable-exact",
        title: "Venum Mouthguard Elite",
        variants: [
          {
            id: "var-unavailable-exact",
            shopifyVariantId: "gid://shopify/ProductVariant/2001",
            title: "Gold",
            inventoryQuantity: 0,
          },
        ],
      }),
      makeCandidate(),
    ]);

    expect(ranked.map((candidate) => ({
      productId: candidate.productId,
      availableForSale: candidate.availableForSale,
      confidence: candidate.confidence,
    }))).toEqual([
      {
        productId: "prod-mouthguard",
        availableForSale: true,
        confidence: 0.97,
      },
      {
        productId: "prod-category-only",
        availableForSale: true,
        confidence: 0.82,
      },
      {
        productId: "prod-unavailable-exact",
        availableForSale: false,
        confidence: 0.85,
      },
    ]);
  });
});