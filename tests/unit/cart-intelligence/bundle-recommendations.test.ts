import { describe, expect, it } from "vitest";

import { detectBundles } from "../../../app/lib/cart-intelligence/bundles";
import { buildBundleRecommendations } from "../../../app/lib/cart-intelligence/recommendations";
import {
  makeNearCompleteBundleCart,
  makeOverlappingBundleFixtures,
  makeQualifiedBundleCart,
} from "../../helpers/bundles";

describe("buildBundleRecommendations", () => {
  it("surfaces overlapping qualified bundles by priority and marks them as competing offers", () => {
    const { starter, premium } = makeOverlappingBundleFixtures();
    const detection = detectBundles({
      shop: "test.myshopify.com",
      cartItems: makeQualifiedBundleCart(),
      bundleRules: [starter, premium],
    });

    const payload = buildBundleRecommendations({ detection });

    expect(payload.summary).toEqual({
      qualifiedCount: 2,
      nearCompleteCount: 0,
      primaryBundleKey: "boxing-premium-bundle",
    });
    expect(payload.opportunities.map((opportunity) => ({
      bundleKey: opportunity.bundleKey,
      isCompetingOffer: opportunity.isCompetingOffer,
      totalRequiredCount: opportunity.completionProgress.totalRequiredCount,
      matchedRequiredCount: opportunity.completionProgress.matchedRequiredCount,
      completionActions: opportunity.completionActions,
    }))).toEqual([
      {
        bundleKey: "boxing-premium-bundle",
        isCompetingOffer: true,
        totalRequiredCount: 3,
        matchedRequiredCount: 3,
        completionActions: [],
      },
      {
        bundleKey: "boxing-starter-bundle",
        isCompetingOffer: true,
        totalRequiredCount: 3,
        matchedRequiredCount: 3,
        completionActions: [],
      },
    ]);
  });

  it("builds nearly-complete actions with unavailable candidates while keeping the opportunity surfaced", () => {
    const detection = detectBundles({
      shop: "test.myshopify.com",
      cartItems: makeNearCompleteBundleCart(),
      bundleRules: [starterRule()],
    });

    const payload = buildBundleRecommendations({
      detection,
      completionCandidates: {
        mouthguard: [
          {
            componentKey: "mouthguard",
            productId: "prod-mouthguard",
            variantId: "var-mouthguard-black",
            title: "Mouthguard / Black",
            availableForSale: false,
            confidence: 0.88,
            reason: "Closest match exists but is currently out of stock.",
          },
        ],
      },
    });

    expect(payload.summary).toEqual({
      qualifiedCount: 0,
      nearCompleteCount: 1,
      primaryBundleKey: "boxing-starter-bundle",
    });
    expect(payload.opportunities).toHaveLength(1);
    expect(payload.opportunities[0]).toMatchObject({
      bundleKey: "boxing-starter-bundle",
      status: "nearly_complete",
      isCompetingOffer: false,
      savings: {
        label: "Save 10.00%",
      },
      completionProgress: {
        matchedRequiredCount: 2,
        totalRequiredCount: 3,
        coverageRatio: 0.67,
      },
    });
    expect(payload.opportunities[0].completionActions).toEqual([
      {
        componentKey: "mouthguard",
        title: "Mouthguard / Black",
        remainingQuantity: 1,
        productId: "prod-mouthguard",
        variantId: "var-mouthguard-black",
        availability: "unavailable",
        confidence: 0.88,
        reason: "Closest match exists but is currently out of stock.",
      },
    ]);
  });
});

function starterRule() {
  const { starter } = makeOverlappingBundleFixtures();
  return {
    ...starter,
    completionThreshold: 0.66,
  };
}