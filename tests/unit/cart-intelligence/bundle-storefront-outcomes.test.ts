import { describe, expect, it } from "vitest";
import { BundleDiscountType } from "@prisma/client";
import {
  projectBundleStorefrontOutcomes,
  type BundleDetectionResult,
  type BundleMatch,
} from "../../../app/lib/cart-intelligence/bundles";

function makeMatch(overrides: Partial<BundleMatch> = {}): BundleMatch {
  return {
    bundleKey: "bundle-1",
    label: "Starter Pack",
    priority: 1,
    status: "qualified",
    coverageRatio: 1,
    matchedComponents: [
      {
        componentKey: "comp-a",
        label: "Shirt",
        requiredQuantity: 1,
        matchedQuantity: 1,
        matchedCartItemIds: ["line-1"],
      },
    ],
    missingComponents: [],
    qualifiedCartItemIds: ["line-1", "line-2"],
    competitionGroupKeys: [],
    savings: {
      discountType: BundleDiscountType.PERCENTAGE,
      discountValue: "15",
    },
    reasons: [],
    ...overrides,
  };
}

function makeDetectionResult(matches: BundleMatch[]): BundleDetectionResult {
  const qualified = matches.filter((m) => m.status === "qualified");
  const nearComplete = matches.filter((m) => m.status === "nearly_complete");
  return {
    matches,
    winningMatch: qualified[0] ?? nearComplete[0] ?? null,
    summary: {
      qualifiedCount: qualified.length,
      nearCompleteCount: nearComplete.length,
      competingOfferCount: 0,
    },
  };
}

describe("projectBundleStorefrontOutcomes", () => {
  it("returns a qualified outcome with discount for a fully matched bundle", () => {
    const match = makeMatch();
    const result = projectBundleStorefrontOutcomes({
      shop: "test.myshopify.com",
      detectionResult: makeDetectionResult([match]),
    });

    expect(result.outcomes).toHaveLength(1);
    const outcome = result.outcomes[0];
    expect(outcome.status).toBe("qualified");
    expect(outcome.outcomeId).toBe("bundle-1");
    expect(outcome.discount).toBeDefined();
    expect(outcome.discount?.type).toBe("percentage");
    expect(outcome.discount?.value).toBe(15);
    expect(outcome.discount?.displayLabel).toContain("15%");
    expect(outcome.qualifiedLineIds).toEqual(["line-1", "line-2"]);
  });

  it("returns a partial outcome with missing requirements for a nearly-complete bundle", () => {
    const match = makeMatch({
      status: "partial",
      coverageRatio: 0.5,
      qualifiedCartItemIds: ["line-1"],
      missingComponents: [
        {
          componentKey: "comp-b",
          label: "Pants",
          requiredQuantity: 1,
          remainingQuantity: 1,
          isRequired: true,
        },
      ],
      savings: {
        discountType: BundleDiscountType.PERCENTAGE,
        discountValue: "10",
      },
    });

    const result = projectBundleStorefrontOutcomes({
      shop: "test.myshopify.com",
      detectionResult: makeDetectionResult([match]),
    });

    expect(result.outcomes).toHaveLength(1);
    const outcome = result.outcomes[0];
    expect(outcome.status).toBe("partial");
    expect(outcome.discount).toBeUndefined();
    expect(outcome.missingRequirements).toHaveLength(1);
    expect(outcome.missingRequirements[0].label).toBe("Pants");
  });

  it("returns ineligible for not_applicable bundle", () => {
    const match = makeMatch({
      status: "not_applicable",
      coverageRatio: 0,
      qualifiedCartItemIds: [],
    });

    const result = projectBundleStorefrontOutcomes({
      shop: "test.myshopify.com",
      detectionResult: makeDetectionResult([match]),
    });

    expect(result.outcomes[0].status).toBe("ineligible");
  });

  it("returns expired for a bundle past its expiresAt date", () => {
    const match = makeMatch({ status: "qualified" });
    const pastDate = new Date("2020-01-01T00:00:00Z").toISOString();

    const result = projectBundleStorefrontOutcomes({
      shop: "test.myshopify.com",
      detectionResult: makeDetectionResult([match]),
      expiresAtMap: { "bundle-1": pastDate },
      now: new Date("2024-01-01T00:00:00Z"),
    });

    expect(result.outcomes[0].status).toBe("expired");
  });

  it("resolves overlapping qualified bundles deterministically using merchant_priority", () => {
    const high = makeMatch({ bundleKey: "bundle-high", priority: 1, competitionGroupKeys: ["bundle-low"] });
    const low = makeMatch({ bundleKey: "bundle-low", priority: 2, competitionGroupKeys: ["bundle-high"] });

    const result = projectBundleStorefrontOutcomes({
      shop: "test.myshopify.com",
      detectionResult: makeDetectionResult([high, low]),
      strategy: "merchant_priority",
    });

    expect(result.resolution.selectedOutcomeIds).toEqual(["bundle-high"]);
    expect(result.resolution.rejectedOutcomeIds).toEqual(["bundle-low"]);
  });

  it("resolves overlapping qualified bundles using best_savings strategy", () => {
    const low = makeMatch({
      bundleKey: "bundle-low-savings",
      priority: 1,
      competitionGroupKeys: ["bundle-high-savings"],
      savings: { discountType: BundleDiscountType.PERCENTAGE, discountValue: "5" },
    });
    const high = makeMatch({
      bundleKey: "bundle-high-savings",
      priority: 2,
      competitionGroupKeys: ["bundle-low-savings"],
      savings: { discountType: BundleDiscountType.PERCENTAGE, discountValue: "20" },
    });

    const result = projectBundleStorefrontOutcomes({
      shop: "test.myshopify.com",
      detectionResult: makeDetectionResult([low, high]),
      strategy: "best_savings",
    });

    expect(result.resolution.selectedOutcomeIds).toEqual(["bundle-high-savings"]);
    expect(result.resolution.rejectedOutcomeIds).toEqual(["bundle-low-savings"]);
  });

  it("includes correct projectionVersion and generatedAt in the output", () => {
    const now = new Date("2025-06-15T10:00:00Z");
    const result = projectBundleStorefrontOutcomes({
      shop: "test.myshopify.com",
      detectionResult: makeDetectionResult([makeMatch()]),
      projectionVersion: 1,
      now,
    });

    expect(result.projectionVersion).toBe(1);
    expect(result.generatedAt).toBe("2025-06-15T10:00:00.000Z");
  });

  it("handles an empty detection result gracefully", () => {
    const result = projectBundleStorefrontOutcomes({
      shop: "test.myshopify.com",
      detectionResult: makeDetectionResult([]),
    });

    expect(result.outcomes).toHaveLength(0);
    expect(result.resolution.selectedOutcomeIds).toHaveLength(0);
    expect(result.resolution.rejectedOutcomeIds).toHaveLength(0);
  });

  it("lineMergeEligible is true for qualified bundles with multiple line IDs", () => {
    const result = projectBundleStorefrontOutcomes({
      shop: "test.myshopify.com",
      detectionResult: makeDetectionResult([makeMatch()]),
    });

    expect(result.outcomes[0].presentation?.lineMergeEligible).toBe(true);
  });

  it("lineMergeEligible is false for qualified bundles with single line ID", () => {
    const match = makeMatch({ qualifiedCartItemIds: ["line-1"] });
    const result = projectBundleStorefrontOutcomes({
      shop: "test.myshopify.com",
      detectionResult: makeDetectionResult([match]),
    });

    expect(result.outcomes[0].presentation?.lineMergeEligible).toBe(false);
  });
});
