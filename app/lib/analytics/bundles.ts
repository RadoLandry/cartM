import type { AnalyticsPeriod } from "./aggregation";

export interface BundleOutcomeRecord {
  bundleViews: number;
  bundleAdds: number;
  bundlePurchases: number;
  averageBundleValue: number;
}

export interface BundleOutcomeSummary {
  bundleViews: number;
  bundleAdds: number;
  bundlePurchases: number;
  addRate: number;
  purchaseRate: number;
  averageBundleValue: number;
}

function safeRate(numerator: number, denominator: number): number {
  if (denominator <= 0) {
    return 0;
  }

  return numerator / denominator;
}

export function aggregateBundleOutcomes(records: BundleOutcomeRecord[]): BundleOutcomeSummary {
  const totals = records.reduce(
    (acc, record) => {
      acc.bundleViews += record.bundleViews;
      acc.bundleAdds += record.bundleAdds;
      acc.bundlePurchases += record.bundlePurchases;
      acc.weightedValue += record.averageBundleValue * record.bundlePurchases;
      return acc;
    },
    {
      bundleViews: 0,
      bundleAdds: 0,
      bundlePurchases: 0,
      weightedValue: 0,
    },
  );

  return {
    bundleViews: totals.bundleViews,
    bundleAdds: totals.bundleAdds,
    bundlePurchases: totals.bundlePurchases,
    addRate: safeRate(totals.bundleAdds, totals.bundleViews),
    purchaseRate: safeRate(totals.bundlePurchases, totals.bundleAdds),
    averageBundleValue: safeRate(totals.weightedValue, totals.bundlePurchases),
  };
}

export async function getBundleOutcomeSummaryForPeriod(_input: {
  shop: string;
  currentPeriod: AnalyticsPeriod;
  baselinePeriod: AnalyticsPeriod;
}): Promise<BundleOutcomeSummary> {
  return {
    bundleViews: 0,
    bundleAdds: 0,
    bundlePurchases: 0,
    addRate: 0,
    purchaseRate: 0,
    averageBundleValue: 0,
  };
}
