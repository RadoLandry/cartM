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
    getChatOutcomeSummaryForPeriod: vi.fn(),
    getBundleOutcomeSummaryForPeriod: vi.fn(),
  };
});

import { loader } from "../../../app/routes/app.analytics";
import { authenticate } from "../../../app/shopify.server";
import {
  ANALYTICS_KPI_KEYS,
  getBundleOutcomeSummaryForPeriod,
  getChatOutcomeSummaryForPeriod,
  getCoreKpiMetricsForPeriod,
  getRecommendationFunnelForPeriod,
  getRecommendationPerformanceForPeriod,
} from "../../../app/lib/analytics";

describe("analytics dashboard contract response", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(authenticate.admin).mockResolvedValue({
      session: { shop: "test.myshopify.com" },
    } as never);

    vi.mocked(getCoreKpiMetricsForPeriod).mockResolvedValue([
      {
        key: ANALYTICS_KPI_KEYS.aovLift,
        value: 12,
        baselineValue: 10,
        absoluteDelta: 2,
        percentDelta: 20,
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

    vi.mocked(getRecommendationPerformanceForPeriod).mockResolvedValue([
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

    vi.mocked(getRecommendationFunnelForPeriod).mockResolvedValue([
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
      {
        stage: "add_to_carts",
        count: 10,
        rateFromPrevious: 0.33,
      },
      {
        stage: "purchases",
        count: 5,
        rateFromPrevious: 0.5,
      },
    ] as never);

    vi.mocked(getChatOutcomeSummaryForPeriod).mockResolvedValue({
      sessions: 200,
      conversions: 40,
      conversionRate: 0.2,
      assistedRevenue: 1200,
    });

    vi.mocked(getBundleOutcomeSummaryForPeriod).mockResolvedValue({
      bundleViews: 100,
      bundleAdds: 30,
      bundlePurchases: 10,
      addRate: 0.3,
      purchaseRate: 0.33,
      averageBundleValue: 55,
    });
  });

  it("returns contract-compatible analytics dashboard payload", async () => {
    const result = await loader({
      request: new Request("http://localhost/app/analytics?startDate=2026-06-01&endDate=2026-06-30"),
      params: {},
      context: {},
    } as never);

    expect(result.period).toMatchObject({ startDate: "2026-06-01", endDate: "2026-06-30" });
    expect(result.baseline).toBeTruthy();
    expect(Array.isArray(result.metrics)).toBe(true);
    expect(Array.isArray(result.metricDefinitions)).toBe(true);

    expect(result.recommendationPerformance[0]).toMatchObject({
      category: "tops",
      impressions: 100,
      interactions: 30,
      interactionRate: 0.3,
      conversionContribution: 5,
    });

    expect(result.bundlePerformance).toMatchObject({
      opportunities: 100,
      completions: 10,
    });

    expect(result.chatPerformance).toMatchObject({
      sessions: 200,
      engagementRate: 0.2,
      cartModifications: 40,
    });

    expect(result.funnel).toMatchObject({
      exposure: 100,
      interaction: 30,
      cartChange: 10,
      purchaseCompletion: 5,
    });

    expect(typeof result.loadDurationMs).toBe("number");
  });
});
