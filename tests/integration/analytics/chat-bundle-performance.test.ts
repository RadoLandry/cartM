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

describe("analytics chat and bundle payload", () => {
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

    vi.mocked(getRecommendationPerformanceForPeriod).mockResolvedValue([]);
    vi.mocked(getRecommendationFunnelForPeriod).mockResolvedValue([]);
  });

  it("includes chat and bundle summaries", async () => {
    vi.mocked(getChatOutcomeSummaryForPeriod).mockResolvedValueOnce({
      sessions: 200,
      conversions: 40,
      conversionRate: 0.2,
      assistedRevenue: 1500,
    });

    vi.mocked(getBundleOutcomeSummaryForPeriod).mockResolvedValueOnce({
      bundleViews: 100,
      bundleAdds: 20,
      bundlePurchases: 8,
      addRate: 0.2,
      purchaseRate: 0.4,
      averageBundleValue: 55,
    });

    const result = await loader({
      request: new Request("http://localhost/app/analytics?startDate=2026-06-01&endDate=2026-06-30"),
      params: {},
      context: {},
    } as never);

    expect(result.chatSummary.sessions).toBe(200);
    expect(result.bundleSummary.bundlePurchases).toBe(8);
  });
});
