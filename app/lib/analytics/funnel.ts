import type { AnalyticsPeriod } from "./aggregation";
import type { RecommendationPerformanceRow } from "./recommendations";

export interface FunnelStage {
  stage: "impressions" | "clicks" | "add_to_carts" | "purchases";
  count: number;
  rateFromPrevious: number;
}

function safeRate(numerator: number, denominator: number): number {
  if (denominator <= 0) {
    return 0;
  }

  return numerator / denominator;
}

export function computeRecommendationFunnel(rows: RecommendationPerformanceRow[]): FunnelStage[] {
  const totals = rows.reduce(
    (acc, row) => {
      acc.impressions += row.impressions;
      acc.clicks += row.clicks;
      acc.addToCarts += row.addToCarts;
      acc.purchases += row.purchases;
      return acc;
    },
    {
      impressions: 0,
      clicks: 0,
      addToCarts: 0,
      purchases: 0,
    },
  );

  return [
    {
      stage: "impressions",
      count: totals.impressions,
      rateFromPrevious: 1,
    },
    {
      stage: "clicks",
      count: totals.clicks,
      rateFromPrevious: safeRate(totals.clicks, totals.impressions),
    },
    {
      stage: "add_to_carts",
      count: totals.addToCarts,
      rateFromPrevious: safeRate(totals.addToCarts, totals.clicks),
    },
    {
      stage: "purchases",
      count: totals.purchases,
      rateFromPrevious: safeRate(totals.purchases, totals.addToCarts),
    },
  ];
}

export async function getRecommendationFunnelForPeriod(_input: {
  shop: string;
  currentPeriod: AnalyticsPeriod;
  baselinePeriod: AnalyticsPeriod;
}): Promise<FunnelStage[]> {
  return [];
}
