import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../app/shopify.server", () => ({
  authenticate: {
    admin: vi.fn(),
  },
}));

vi.mock("../../../app/lib/analytics", async () => {
  const actual = await vi.importActual<typeof import("../../../app/lib/analytics")>(
    "../../../app/lib/analytics",
  );

  return {
    ...actual,
    getCoreKpiMetricsForPeriod: vi.fn(),
    getRecommendationPerformanceForPeriod: vi.fn(),
    getRecommendationFunnelForPeriod: vi.fn(),
  };
});

import { loader } from "../../../app/routes/app.analytics";
import { authenticate } from "../../../app/shopify.server";
import {
  ANALYTICS_KPI_KEYS,
  getCoreKpiMetricsForPeriod,
  getRecommendationFunnelForPeriod,
  getRecommendationPerformanceForPeriod,
} from "../../../app/lib/analytics";

describe("analytics recommendation loader payload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authenticate.admin).mockResolvedValue({
      session: { shop: "test.myshopify.com" },
    } as never);

    vi.mocked(getCoreKpiMetricsForPeriod).mockResolvedValue([
      {
        key: ANALYTICS_KPI_KEYS.aovLift,
        value: 10,
        baselineValue: 8,
        absoluteDelta: 2,
        percentDelta: 25,
      },
      {
        key: ANALYTICS_KPI_KEYS.sizeReturnRateChange,
        value: 0,
        baselineValue: 0,
        absoluteDelta: 0,
        percentDelta: 0,
      },
      {
        key: ANALYTICS_KPI_KEYS.cartAbandonmentChange,
        value: 0,
        baselineValue: 0,
        absoluteDelta: 0,
        percentDelta: 0,
      },
      {
        key: ANALYTICS_KPI_KEYS.kitCompletionRate,
        value: 0,
        baselineValue: 0,
        absoluteDelta: 0,
        percentDelta: 0,
      },
      {
        key: ANALYTICS_KPI_KEYS.chatEngagementRate,
        value: 0,
        baselineValue: 0,
        absoluteDelta: 0,
        percentDelta: 0,
      },
    ]);
  });

  it("includes recommendation performance and funnel sections", async () => {
    vi.mocked(getRecommendationPerformanceForPeriod).mockResolvedValueOnce([
      {
        category: "tops",
        impressions: 100,
        clicks: 30,
        addToCarts: 10,
        purchases: 5,
        clickThroughRate: 0.3,
        addToCartRate: 0.33,
        purchaseRate: 0.5,
        score: 0.37,
      },
    ]);

    vi.mocked(getRecommendationFunnelForPeriod).mockResolvedValueOnce([
      {
        stage: "impressions",
        count: 100,
        rateFromPrevious: 1,
      },
      {
        stage: "clicks",
        count: 30,
        rateFromPrevious: 0.3,
      },
    ] as never);

    const result = await loader({
      request: new Request("http://localhost/app/analytics?startDate=2026-06-01&endDate=2026-06-30"),
      params: {},
      context: {},
    } as never);

    expect(result.recommendationPerformance).toHaveLength(1);
    expect(result.funnelStages).toHaveLength(2);
  });
});
