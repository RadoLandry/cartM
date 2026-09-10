import { describe, expect, it } from "vitest";
import { BundleComponentMatchMode } from "@prisma/client";

import {
  DEFAULT_BUNDLE_TEMPLATES,
  rankBundleCompletionCandidates,
  toBundleProjection,
  type BundleCompletionCandidateProduct,
  type BundleRuleComponentDefinition,
} from "../../../app/lib/knowledge-graph/bundles";
import { validateBundleRuleActivation } from "../../../app/lib/cart-intelligence/bundles";
import { makeBundleRuleFixture } from "../../helpers/bundles";

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

describe("DEFAULT_BUNDLE_TEMPLATES", () => {
  it("provides seed templates with unique keys and at least one required component each", () => {
    expect(DEFAULT_BUNDLE_TEMPLATES.length).toBeGreaterThan(0);

    const keys = DEFAULT_BUNDLE_TEMPLATES.map((template) => template.key);
    expect(new Set(keys).size).toBe(keys.length);

    for (const template of DEFAULT_BUNDLE_TEMPLATES) {
      expect(template.completionThreshold).toBeGreaterThan(0);
      expect(template.completionThreshold).toBeLessThanOrEqual(1);
      expect(template.components.some((component) => component.isRequired)).toBe(true);
    }
  });
});

describe("toBundleProjection", () => {
  it("projects only the fields needed for downstream detection", () => {
    const rule = makeBundleRuleFixture();
    const projection = toBundleProjection(rule);

    expect(projection).toMatchObject({
      key: rule.key,
      priority: rule.priority,
      completionThreshold: rule.completionThreshold,
      discountType: rule.discountType,
      discountValue: rule.discountValue,
    });
    expect(projection.components).toHaveLength(rule.components.length);
    expect(projection.components[0]).not.toHaveProperty("id");
    expect(projection.components[0]).not.toHaveProperty("label");
  });
});

describe("validateBundleRuleActivation", () => {
  it("returns no issues for a fully configured rule", () => {
    const rule = makeBundleRuleFixture();
    expect(validateBundleRuleActivation(rule)).toEqual([]);
  });

  it("flags rules missing required components and an invalid completion threshold", () => {
    const rule = makeBundleRuleFixture();
    const issues = validateBundleRuleActivation({
      ...rule,
      components: rule.components.map((component) => ({ ...component, isRequired: false })),
      completionThreshold: 1.5,
    });
    const codes = issues.map((issue) => issue.code);

    expect(codes).toContain("required_components_missing");
    expect(codes).toContain("invalid_completion_threshold");
  });
});