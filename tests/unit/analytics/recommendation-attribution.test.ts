import { describe, expect, it } from "vitest";

import { aggregateRecommendationAttribution } from "../../../app/lib/analytics/recommendations";

describe("aggregateRecommendationAttribution", () => {
  it("aggregates records by category and computes rates", () => {
    const rows = aggregateRecommendationAttribution([
      {
        category: "tops",
        impressions: 100,
        clicks: 20,
        addToCarts: 10,
        purchases: 4,
      },
      {
        category: "tops",
        impressions: 50,
        clicks: 5,
        addToCarts: 3,
        purchases: 1,
      },
    ]);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      category: "tops",
      impressions: 150,
      clicks: 25,
      addToCarts: 13,
      purchases: 5,
    });
    expect(rows[0].clickThroughRate).toBeCloseTo(25 / 150, 5);
  });
});
