import { describe, expect, it } from "vitest";

import { aggregateBundleOutcomes } from "../../../app/lib/analytics/bundles";

describe("aggregateBundleOutcomes", () => {
  it("aggregates bundle outcomes and computes rates safely", () => {
    const summary = aggregateBundleOutcomes([
      {
        bundleViews: 120,
        bundleAdds: 30,
        bundlePurchases: 15,
        averageBundleValue: 45,
      },
      {
        bundleViews: 80,
        bundleAdds: 20,
        bundlePurchases: 5,
        averageBundleValue: 60,
      },
    ]);

    expect(summary.bundleViews).toBe(200);
    expect(summary.bundleAdds).toBe(50);
    expect(summary.bundlePurchases).toBe(20);
    expect(summary.addRate).toBeCloseTo(50 / 200, 5);
    expect(summary.purchaseRate).toBeCloseTo(20 / 50, 5);
    expect(summary.averageBundleValue).toBeCloseTo((45 * 15 + 60 * 5) / 20, 5);
  });
});
