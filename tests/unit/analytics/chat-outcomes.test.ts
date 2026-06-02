import { describe, expect, it } from "vitest";

import { aggregateChatOutcomes } from "../../../app/lib/analytics/chat";

describe("aggregateChatOutcomes", () => {
  it("sums chat outcomes and computes conversion rate", () => {
    const summary = aggregateChatOutcomes([
      {
        sessions: 100,
        conversions: 20,
        assistedRevenue: 1000,
      },
      {
        sessions: 50,
        conversions: 5,
        assistedRevenue: 250,
      },
    ]);

    expect(summary.sessions).toBe(150);
    expect(summary.conversions).toBe(25);
    expect(summary.conversionRate).toBeCloseTo(25 / 150, 5);
    expect(summary.assistedRevenue).toBe(1250);
  });
});
