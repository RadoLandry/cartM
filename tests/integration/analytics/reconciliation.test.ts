import { describe, expect, it } from "vitest";

function withinVariance(expected: number, actual: number, tolerance: number) {
  if (expected === 0) {
    return actual === 0;
  }

  const variance = Math.abs(actual - expected) / expected;
  return variance <= tolerance;
}

describe("analytics sampled reconciliation checks", () => {
  it("keeps dashboard metrics within allowed event variance", () => {
    const sourceSample = {
      recommendationImpressions: 1000,
      recommendationClicks: 240,
      bundleCompletions: 120,
      chatSessions: 300,
    };

    const dashboardSample = {
      recommendationImpressions: 980,
      recommendationClicks: 235,
      bundleCompletions: 118,
      chatSessions: 306,
    };

    const tolerance = 0.05;

    expect(withinVariance(sourceSample.recommendationImpressions, dashboardSample.recommendationImpressions, tolerance)).toBe(true);
    expect(withinVariance(sourceSample.recommendationClicks, dashboardSample.recommendationClicks, tolerance)).toBe(true);
    expect(withinVariance(sourceSample.bundleCompletions, dashboardSample.bundleCompletions, tolerance)).toBe(true);
    expect(withinVariance(sourceSample.chatSessions, dashboardSample.chatSessions, tolerance)).toBe(true);
  });
});
