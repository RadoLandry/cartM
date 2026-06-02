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
  };
});

import { loader } from "../../../app/routes/app.analytics";
import { authenticate } from "../../../app/shopify.server";
import { ANALYTICS_KPI_KEYS, getCoreKpiMetricsForPeriod } from "../../../app/lib/analytics";

describe("analytics dashboard core loader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authenticate.admin).mockResolvedValue({
      session: { shop: "test.myshopify.com" },
    } as never);
  });

  it("returns KPI payload with parsed date filters", async () => {
    vi.mocked(getCoreKpiMetricsForPeriod).mockResolvedValueOnce([
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

    const result = await loader({
      request: new Request("http://localhost/app/analytics?startDate=2026-06-01&endDate=2026-06-30"),
      params: {},
      context: {},
    } as never);

    expect(getCoreKpiMetricsForPeriod).toHaveBeenCalledWith(
      expect.objectContaining({
        shop: "test.myshopify.com",
      }),
    );
    expect(result.metrics).toHaveLength(5);
    expect(result.period).toEqual({
      startDate: "2026-06-01",
      endDate: "2026-06-30",
    });
  });
});
