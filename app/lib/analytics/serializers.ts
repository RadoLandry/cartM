import type { AnalyticsKpiDefinition } from "./definitions";
import type { DashboardKpiMetric } from "./aggregation";

export interface DashboardPeriodPayload {
  startDate: string;
  endDate: string;
}

export interface AnalyticsDashboardPayload {
  period: DashboardPeriodPayload;
  baseline: DashboardPeriodPayload;
  metrics: DashboardKpiMetric[];
  metricDefinitions: AnalyticsKpiDefinition[];
}

export function toDashboardPeriodPayload(startDate: Date, endDate: Date): DashboardPeriodPayload {
  return {
    startDate: startDate.toISOString().slice(0, 10),
    endDate: endDate.toISOString().slice(0, 10),
  };
}

export function buildDashboardPayload(input: {
  period: { startDate: Date; endDate: Date };
  baseline: { startDate: Date; endDate: Date };
  metrics: DashboardKpiMetric[];
  metricDefinitions: AnalyticsKpiDefinition[];
}): AnalyticsDashboardPayload {
  return {
    period: toDashboardPeriodPayload(input.period.startDate, input.period.endDate),
    baseline: toDashboardPeriodPayload(input.baseline.startDate, input.baseline.endDate),
    metrics: input.metrics,
    metricDefinitions: input.metricDefinitions,
  };
}
