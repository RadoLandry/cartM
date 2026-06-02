import { describe, expect, it } from "vitest";

import { rankRecommendationPerformance } from "../../../app/lib/analytics/recommendations";

describe("rankRecommendationPerformance", () => {
  it("orders rows by score descending", () => {
    const ranked = rankRecommendationPerformance([
      {
        category: "bottoms",
        impressions: 100,
        clicks: 20,
        addToCarts: 10,
        purchases: 4,
        clickThroughRate: 0.2,
        addToCartRate: 0.5,
        purchaseRate: 0.4,
        score: 0.35,
      },
      {
        category: "tops",
        impressions: 100,
        clicks: 30,
        addToCarts: 15,
        purchases: 8,
        clickThroughRate: 0.3,
        addToCartRate: 0.5,
        purchaseRate: 0.53,
        score: 0.45,
      },
    ]);

    expect(ranked.map((row) => row.category)).toEqual(["tops", "bottoms"]);
  });
});
