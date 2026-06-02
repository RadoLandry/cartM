import { describe, expect, it } from "vitest";

import { resolveBaselinePeriod } from "../../../app/lib/analytics/aggregation";

describe("resolveBaselinePeriod", () => {
  it("resolves previous-period baseline by default", () => {
    const current = {
      startDate: new Date("2026-06-01T00:00:00.000Z"),
      endDate: new Date("2026-06-30T00:00:00.000Z"),
    };

    const baseline = resolveBaselinePeriod({
      current,
      baselineMode: "previous_period",
    });

    expect(baseline.endDate.toISOString()).toBe("2026-05-31T23:59:59.999Z");
    expect(baseline.startDate.toISOString()).toBe("2026-05-02T23:59:59.999Z");
  });

  it("uses provided custom baseline", () => {
    const baseline = resolveBaselinePeriod({
      current: {
        startDate: new Date("2026-06-01T00:00:00.000Z"),
        endDate: new Date("2026-06-30T00:00:00.000Z"),
      },
      baselineMode: "custom",
      baselineStartDate: new Date("2026-05-01T00:00:00.000Z"),
      baselineEndDate: new Date("2026-05-31T00:00:00.000Z"),
    });

    expect(baseline.startDate.toISOString()).toBe("2026-05-01T00:00:00.000Z");
    expect(baseline.endDate.toISOString()).toBe("2026-05-31T00:00:00.000Z");
  });
});
