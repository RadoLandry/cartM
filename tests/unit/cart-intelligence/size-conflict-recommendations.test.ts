import { describe, it, expect } from "vitest";
import { buildSizeConflictRecommendations } from "../../../app/lib/cart-intelligence/recommendations";
import type { SizeConflict, SizeConflictResult } from "../../../app/lib/knowledge-graph/sizing";

function makeConflict(overrides: Partial<SizeConflict> = {}): SizeConflict {
  return {
    conflictKey: "mapped_size_mismatch:var-a:var-b",
    severity: "WARNING",
    reasonType: "mapped_size_mismatch",
    itemA: { productId: "prod-a", variantId: "var-a", categoryTag: "clothing", selectedSize: "M" },
    itemB: { productId: "prod-b", variantId: "var-b", categoryTag: "shorts_waist", selectedSize: "36", expectedSize: "32" },
    message: "clothing size M typically pairs with shorts_waist size 32, but 36 is selected.",
    suggestions: [],
    suggestedCorrection: "Change shorts_waist to 32.",
    ...overrides,
  };
}

function buildResult(conflicts: SizeConflict[]): SizeConflictResult {
  const errorCount = conflicts.filter((c) => c.severity === "ERROR").length;
  const warningCount = conflicts.length - errorCount;
  return {
    conflicts,
    hasErrors: errorCount > 0,
    hasWarnings: warningCount > 0,
    summary: { total: conflicts.length, errorCount, warningCount },
  };
}

describe("buildSizeConflictRecommendations — summary derivation", () => {
  it("derives summary counts and highestSeverity from the conflict list", () => {
    const result = buildResult([
      makeConflict({ conflictKey: "a", severity: "ERROR" }),
      makeConflict({ conflictKey: "b", severity: "WARNING" }),
    ]);

    const payload = buildSizeConflictRecommendations(result);

    expect(payload.summary).toEqual({
      totalConflicts: 2,
      errorCount: 1,
      warningCount: 1,
      highestSeverity: "ERROR",
    });
  });

  it("reports highestSeverity null and empty conflicts for a clean cart", () => {
    const payload = buildSizeConflictRecommendations(buildResult([]));

    expect(payload.summary).toEqual({
      totalConflicts: 0,
      errorCount: 0,
      warningCount: 0,
      highestSeverity: null,
    });
    expect(payload.conflicts).toHaveLength(0);
  });
});

describe("buildSizeConflictRecommendations — sorting", () => {
  it("sorts ERROR conflicts ahead of WARNING conflicts", () => {
    const result = buildResult([
      makeConflict({ conflictKey: "z-warning", severity: "WARNING" }),
      makeConflict({ conflictKey: "a-error", severity: "ERROR" }),
    ]);

    const payload = buildSizeConflictRecommendations(result);
    expect(payload.conflicts.map((c) => c.conflictKey)).toEqual(["a-error", "z-warning"]);
  });

  it("sorts conflicts of the same severity deterministically by conflictKey", () => {
    const result = buildResult([
      makeConflict({ conflictKey: "b", severity: "WARNING" }),
      makeConflict({ conflictKey: "a", severity: "WARNING" }),
    ]);

    const payload = buildSizeConflictRecommendations(result);
    expect(payload.conflicts.map((c) => c.conflictKey)).toEqual(["a", "b"]);
  });
});

describe("buildSizeConflictRecommendations — suggestion promotion", () => {
  it("omits primarySuggestion when no candidate is available", () => {
    const result = buildResult([
      makeConflict({
        suggestions: [
          {
            targetItem: "itemB",
            currentVariantId: "var-b",
            currentSize: "36",
            suggestedSize: "32",
            availability: "unavailable",
            confidence: 0.85,
            reason: "clothing size M maps to shorts_waist size 32.",
          },
        ],
      }),
    ]);

    const payload = buildSizeConflictRecommendations(result);
    const card = payload.conflicts[0];

    expect(card.primarySuggestion).toBeUndefined();
    expect(card.additionalSuggestions).toHaveLength(1);
    expect(card.additionalSuggestions[0].availability).toBe("unavailable");
  });

  it("promotes an available suggestion to primarySuggestion", () => {
    const result = buildResult([
      makeConflict({
        suggestions: [
          {
            targetItem: "itemB",
            currentVariantId: "var-b",
            currentSize: "36",
            suggestedSize: "32",
            availability: "available",
            suggestedVariantId: "var-shorts-32",
            confidence: 0.85,
            reason: "clothing size M maps to shorts_waist size 32.",
          },
          {
            targetItem: "itemB",
            currentVariantId: "var-b",
            currentSize: "36",
            suggestedSize: "30",
            availability: "unknown",
            confidence: 0.6,
            reason: "Alternative correction.",
          },
        ],
      }),
    ]);

    const payload = buildSizeConflictRecommendations(result);
    const card = payload.conflicts[0];

    expect(card.primarySuggestion?.suggestedSize).toBe("32");
    expect(card.primarySuggestion?.suggestedVariantId).toBe("var-shorts-32");
    expect(card.additionalSuggestions).toHaveLength(1);
    expect(card.additionalSuggestions[0].suggestedSize).toBe("30");
  });

  it("carries itemA and itemB as affectedItems on the card", () => {
    const conflict = makeConflict();
    const payload = buildSizeConflictRecommendations(buildResult([conflict]));

    expect(payload.conflicts[0].affectedItems).toEqual([conflict.itemA, conflict.itemB]);
  });
});
