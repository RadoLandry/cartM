export interface AnalyticsPeriod {
  startDate: Date;
  endDate: Date;
}

import { ANALYTICS_KPI_KEYS, type AnalyticsKpiKey } from "./definitions";
import { getKpiSnapshots } from "../db/queries";

export interface DashboardKpiMetric {
  key: AnalyticsKpiKey;
  value: number;
  baselineValue: number;
  absoluteDelta: number;
  percentDelta: number;
}

export interface BaselineResolverInput {
  current: AnalyticsPeriod;
  baselineMode: "previous_period" | "custom";
  baselineStartDate?: Date;
  baselineEndDate?: Date;
}

export function safeDivide(numerator: number, denominator: number): number {
  if (denominator <= 0) {
    return 0;
  }

  return numerator / denominator;
}

export function assertValidAnalyticsPeriod(period: AnalyticsPeriod) {
  if (Number.isNaN(period.startDate.getTime()) || Number.isNaN(period.endDate.getTime())) {
    throw new Error("Invalid analytics period dates");
  }

  if (period.startDate > period.endDate) {
    throw new Error("startDate must be less than or equal to endDate");
  }
}

export function resolveBaselinePeriod(input: BaselineResolverInput): AnalyticsPeriod {
  assertValidAnalyticsPeriod(input.current);

  if (input.baselineMode === "custom") {
    if (!input.baselineStartDate || !input.baselineEndDate) {
      throw new Error("Custom baseline requires baselineStartDate and baselineEndDate");
    }

    const customPeriod = {
      startDate: input.baselineStartDate,
      endDate: input.baselineEndDate,
    };

    assertValidAnalyticsPeriod(customPeriod);
    return customPeriod;
  }

  const durationMs = input.current.endDate.getTime() - input.current.startDate.getTime();
  const previousEnd = new Date(input.current.startDate.getTime() - 1);
  const previousStart = new Date(previousEnd.getTime() - durationMs);

  return {
    startDate: previousStart,
    endDate: previousEnd,
  };
}

function toNumber(value: unknown): number {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  if (value && typeof value === "object" && "toString" in value) {
    const parsed = Number.parseFloat(String(value));
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function toMetric(
  key: AnalyticsKpiKey,
  currentValue: number,
  baselineValue: number,
): DashboardKpiMetric {
  const absoluteDelta = currentValue - baselineValue;
  const percentDelta = safeDivide(absoluteDelta, baselineValue) * 100;

  return {
    key,
    value: currentValue,
    baselineValue,
    absoluteDelta,
    percentDelta,
  };
}

export function aggregateCoreKpis(input: {
  currentByKey: Partial<Record<AnalyticsKpiKey, number>>;
  baselineByKey: Partial<Record<AnalyticsKpiKey, number>>;
}): DashboardKpiMetric[] {
  const orderedKeys: AnalyticsKpiKey[] = [
    ANALYTICS_KPI_KEYS.aovLift,
    ANALYTICS_KPI_KEYS.sizeReturnRateChange,
    ANALYTICS_KPI_KEYS.cartAbandonmentChange,
    ANALYTICS_KPI_KEYS.kitCompletionRate,
    ANALYTICS_KPI_KEYS.chatEngagementRate,
  ];

  return orderedKeys.map((key) =>
    toMetric(key, input.currentByKey[key] ?? 0, input.baselineByKey[key] ?? 0),
  );
}

function mapSnapshotsToValues(
  snapshots: Array<{ kpiKey: string; value: unknown }>,
): Partial<Record<AnalyticsKpiKey, number>> {
  return snapshots.reduce((acc, snapshot) => {
    const key = snapshot.kpiKey as AnalyticsKpiKey;
    acc[key] = toNumber(snapshot.value);
    return acc;
  }, {} as Partial<Record<AnalyticsKpiKey, number>>);
}

export async function getCoreKpiMetricsForPeriod(input: {
  shop: string;
  currentPeriod: AnalyticsPeriod;
  baselinePeriod: AnalyticsPeriod;
}): Promise<DashboardKpiMetric[]> {
  const keys: AnalyticsKpiKey[] = [
    ANALYTICS_KPI_KEYS.aovLift,
    ANALYTICS_KPI_KEYS.sizeReturnRateChange,
    ANALYTICS_KPI_KEYS.cartAbandonmentChange,
    ANALYTICS_KPI_KEYS.kitCompletionRate,
    ANALYTICS_KPI_KEYS.chatEngagementRate,
  ];

  const [currentSnapshots, baselineSnapshots] = await Promise.all([
    getKpiSnapshots(
      input.shop,
      input.currentPeriod.startDate,
      input.currentPeriod.endDate,
      keys,
    ),
    getKpiSnapshots(
      input.shop,
      input.baselinePeriod.startDate,
      input.baselinePeriod.endDate,
      keys,
    ),
  ]);

  return aggregateCoreKpis({
    currentByKey: mapSnapshotsToValues(currentSnapshots),
    baselineByKey: mapSnapshotsToValues(baselineSnapshots),
  });
}
