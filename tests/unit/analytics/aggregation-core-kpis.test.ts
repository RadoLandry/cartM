import { describe, expect, it } from "vitest";

import { aggregateCoreKpis } from "../../../app/lib/analytics/aggregation";
import { ANALYTICS_KPI_KEYS } from "../../../app/lib/analytics/definitions";

describe("aggregateCoreKpis", () => {
  it("returns ordered KPI metrics with deltas", () => {
    const metrics = aggregateCoreKpis({
      currentByKey: {
        [ANALYTICS_KPI_KEYS.aovLift]: 12,
        [ANALYTICS_KPI_KEYS.kitCompletionRate]: 0.64,
      },
      baselineByKey: {
        [ANALYTICS_KPI_KEYS.aovLift]: 10,
        [ANALYTICS_KPI_KEYS.kitCompletionRate]: 0.5,
      },
    });

    const aov = metrics.find((metric) => metric.key === ANALYTICS_KPI_KEYS.aovLift);
    const kitCompletion = metrics.find((metric) => metric.key === ANALYTICS_KPI_KEYS.kitCompletionRate);

    expect(metrics).toHaveLength(5);
    expect(aov).toMatchObject({
      value: 12,
      baselineValue: 10,
      absoluteDelta: 2,
      percentDelta: 20,
    });
    expect(kitCompletion?.absoluteDelta).toBeCloseTo(0.14, 5);
  });

  it("defaults missing KPI values to zero", () => {
    const metrics = aggregateCoreKpis({
      currentByKey: {},
      baselineByKey: {},
    });

    expect(metrics.every((metric) => metric.value === 0)).toBe(true);
    expect(metrics.every((metric) => metric.baselineValue === 0)).toBe(true);
  });
});
