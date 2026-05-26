import { describe, expect, it } from "vitest";

import { detectBundles } from "../../../app/lib/cart-intelligence/bundles";
import {
  makeBundleRuleFixture,
  makeBundleCartItem,
  makeNearCompleteBundleCart,
  makeOverlappingBundleFixtures,
  makeQualifiedBundleCart,
} from "../../helpers/bundles";

describe("detectBundles", () => {
  it("returns an empty result for an empty cart", () => {
    const result = detectBundles({
      shop: "test.myshopify.com",
      cartItems: [],
      bundleRules: [makeBundleRuleFixture()],
    });

    expect(result).toEqual({
      matches: [],
      summary: {
        qualifiedCount: 0,
        nearCompleteCount: 0,
        competingOfferCount: 0,
      },
    });
  });

  it("classifies a fully satisfied bundle as qualified", () => {
    const result = detectBundles({
      shop: "test.myshopify.com",
      cartItems: makeQualifiedBundleCart(),
      bundleRules: [makeBundleRuleFixture()],
    });

    expect(result.summary.qualifiedCount).toBe(1);
    expect(result.matches).toHaveLength(1);
    expect(result.matches[0]).toMatchObject({
      bundleKey: "boxing-starter-bundle",
      status: "qualified",
      coverageRatio: 1,
      savings: {
        discountType: "PERCENTAGE",
        discountValue: "10.00",
      },
    });
    expect(result.matches[0].missingComponents).toEqual([]);
    expect(result.matches[0].reasons[0]?.reasonType).toBe("qualified");
  });

  it("classifies a threshold-satisfying but incomplete bundle as nearly complete", () => {
    const result = detectBundles({
      shop: "test.myshopify.com",
      cartItems: makeNearCompleteBundleCart(),
      bundleRules: [makeBundleRuleFixture({ completionThreshold: 0.66 })],
    });

    expect(result.summary.nearCompleteCount).toBe(1);
    expect(result.matches[0]).toMatchObject({
      status: "nearly_complete",
      coverageRatio: 0.67,
    });
    expect(result.matches[0].missingComponents.map((component) => component.componentKey)).toEqual([
      "mouthguard",
    ]);
    expect(result.matches[0].reasons[0]?.reasonType).toBe("near_complete");
  });

  it("classifies incomplete coverage below threshold as partial", () => {
    const result = detectBundles({
      shop: "test.myshopify.com",
      cartItems: makeNearCompleteBundleCart(),
      bundleRules: [makeBundleRuleFixture()],
    });

    expect(result.matches[0]).toMatchObject({
      status: "partial",
      coverageRatio: 0.67,
    });
    expect(result.matches[0].reasons[0]?.reasonType).toBe("partial_match");
  });

  it("marks unrelated carts as not applicable", () => {
    const result = detectBundles({
      shop: "test.myshopify.com",
      cartItems: [
        makeBundleCartItem({
          productId: "prod-headgear",
          shopifyProductId: "gid://shopify/Product/999",
          variantId: "var-headgear-1",
          shopifyVariantId: "gid://shopify/ProductVariant/999",
          title: "Headgear",
          categoryTags: ["headgear"],
        }),
      ],
      bundleRules: [makeBundleRuleFixture()],
    });

    expect(result.matches[0]).toMatchObject({
      status: "not_applicable",
      coverageRatio: 0,
    });
    expect(result.matches[0].reasons).toEqual([]);
  });

  it("groups overlapping qualified bundles into competition groups", () => {
    const { starter, premium } = makeOverlappingBundleFixtures();

    const result = detectBundles({
      shop: "test.myshopify.com",
      cartItems: makeQualifiedBundleCart(),
      bundleRules: [starter, premium],
    });

    expect(result.summary.qualifiedCount).toBe(2);
    expect(result.summary.competingOfferCount).toBe(2);
    expect(result.matches.map((match) => ({ key: match.bundleKey, competition: match.competitionGroupKeys }))).toEqual([
      {
        key: "boxing-starter-bundle",
        competition: ["boxing-premium-bundle"],
      },
      {
        key: "boxing-premium-bundle",
        competition: ["boxing-starter-bundle"],
      },
    ]);
  });
});