import type { AnalyticsPeriod } from "./aggregation";

export interface RecommendationAttributionRecord {
  category: string;
  impressions: number;
  clicks: number;
  addToCarts: number;
  purchases: number;
}

export interface RecommendationPerformanceRow {
  category: string;
  impressions: number;
  clicks: number;
  addToCarts: number;
  purchases: number;
  clickThroughRate: number;
  addToCartRate: number;
  purchaseRate: number;
  score: number;
}

function safeRate(numerator: number, denominator: number): number {
  if (denominator <= 0) {
    return 0;
  }

  return numerator / denominator;
}

function toPerformanceRow(record: RecommendationAttributionRecord): RecommendationPerformanceRow {
  const clickThroughRate = safeRate(record.clicks, record.impressions);
  const addToCartRate = safeRate(record.addToCarts, record.clicks);
  const purchaseRate = safeRate(record.purchases, record.addToCarts);
  const score = clickThroughRate * 0.35 + addToCartRate * 0.35 + purchaseRate * 0.3;

  return {
    ...record,
    clickThroughRate,
    addToCartRate,
    purchaseRate,
    score,
  };
}

export function aggregateRecommendationAttribution(
  records: RecommendationAttributionRecord[],
): RecommendationPerformanceRow[] {
  const bucket = new Map<string, RecommendationAttributionRecord>();

  for (const record of records) {
    const existing = bucket.get(record.category);
    if (!existing) {
      bucket.set(record.category, { ...record });
      continue;
    }

    existing.impressions += record.impressions;
    existing.clicks += record.clicks;
    existing.addToCarts += record.addToCarts;
    existing.purchases += record.purchases;
  }

  return Array.from(bucket.values()).map(toPerformanceRow);
}

export function rankRecommendationPerformance(
  rows: RecommendationPerformanceRow[],
): RecommendationPerformanceRow[] {
  return [...rows].sort((a, b) => b.score - a.score || b.purchases - a.purchases);
}

export async function getRecommendationPerformanceForPeriod(_input: {
  shop: string;
  currentPeriod: AnalyticsPeriod;
  baselinePeriod: AnalyticsPeriod;
}): Promise<RecommendationPerformanceRow[]> {
  return [];
}
