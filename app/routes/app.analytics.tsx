import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { BlockStack, Page, Text } from "@shopify/polaris";

import {
  ANALYTICS_KPI_DEFINITION_LIST,
  getBundleOutcomeSummaryForPeriod,
  getChatOutcomeSummaryForPeriod,
  getCoreKpiMetricsForPeriod,
  getRecommendationFunnelForPeriod,
  getRecommendationPerformanceForPeriod,
  parseAnalyticsDashboardQuery,
  resolveBaselinePeriod,
} from "../lib/analytics";
import { buildDashboardPayload } from "../lib/analytics/serializers";
import { AnalyticsFilterBar } from "../components/admin/analytics/AnalyticsFilterBar";
import { BundlePerformanceSection } from "../components/admin/analytics/BundlePerformanceSection";
import { ChatPerformanceSection } from "../components/admin/analytics/ChatPerformanceSection";
import { FunnelSection } from "../components/admin/analytics/FunnelSection";
import { KpiEmptyState } from "../components/admin/analytics/KpiEmptyState";
import { KpiSummarySection } from "../components/admin/analytics/KpiSummarySection";
import { MetricDefinitionPanel } from "../components/admin/analytics/MetricDefinitionPanel";
import { RecommendationPerformanceSection } from "../components/admin/analytics/RecommendationPerformanceSection";
import { authenticate } from "../shopify.server";

function readQuery(request: Request) {
  const url = new URL(request.url);
  const query = Object.fromEntries(url.searchParams.entries());

  if (!query.startDate || !query.endDate) {
    const now = new Date();
    const endDate = now.toISOString().slice(0, 10);
    const start = new Date(now);
    start.setDate(now.getDate() - 29);
    const startDate = start.toISOString().slice(0, 10);

    return {
      ...query,
      startDate,
      endDate,
    };
  }

  return query;
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const startedAt = Date.now();
  const { session } = await authenticate.admin(request);

  const query = parseAnalyticsDashboardQuery(readQuery(request));

  const currentPeriod = {
    startDate: new Date(query.startDate),
    endDate: new Date(query.endDate),
  };

  const baselinePeriod = resolveBaselinePeriod({
    current: currentPeriod,
    baselineMode: query.baselineMode,
    baselineStartDate: query.baselineStartDate ? new Date(query.baselineStartDate) : undefined,
    baselineEndDate: query.baselineEndDate ? new Date(query.baselineEndDate) : undefined,
  });

  const [metrics, recommendationPerformance, funnelStages, chatSummary, bundleSummary] = await Promise.all([
    getCoreKpiMetricsForPeriod({
      shop: session.shop,
      currentPeriod,
      baselinePeriod,
    }),
    getRecommendationPerformanceForPeriod({
      shop: session.shop,
      currentPeriod,
      baselinePeriod,
    }),
    getRecommendationFunnelForPeriod({
      shop: session.shop,
      currentPeriod,
      baselinePeriod,
    }),
    getChatOutcomeSummaryForPeriod({
      shop: session.shop,
      currentPeriod,
      baselinePeriod,
    }),
    getBundleOutcomeSummaryForPeriod({
      shop: session.shop,
      currentPeriod,
      baselinePeriod,
    }),
  ]);

  const payload = buildDashboardPayload({
    period: currentPeriod,
    baseline: baselinePeriod,
    metrics,
    metricDefinitions: ANALYTICS_KPI_DEFINITION_LIST,
  });

  const recommendationPerformanceContract = recommendationPerformance.map((row) => ({
    category: row.category,
    impressions: row.impressions,
    interactions: row.clicks,
    interactionRate: row.clickThroughRate,
    conversionContribution: row.purchases,
  }));

  const bundlePerformance = {
    opportunities: bundleSummary.bundleViews,
    completions: bundleSummary.bundlePurchases,
    completionRate: bundleSummary.purchaseRate,
    valueImpact: bundleSummary.averageBundleValue * bundleSummary.bundlePurchases,
  };

  const chatPerformance = {
    sessions: chatSummary.sessions,
    engagementRate: chatSummary.conversionRate,
    cartModifications: chatSummary.conversions,
    resolutionDistribution: {
      converted: chatSummary.conversions,
      notConverted: Math.max(0, chatSummary.sessions - chatSummary.conversions),
    },
  };

  const funnel = {
    exposure: funnelStages.find((stage) => stage.stage === "impressions")?.count ?? 0,
    interaction: funnelStages.find((stage) => stage.stage === "clicks")?.count ?? 0,
    cartChange: funnelStages.find((stage) => stage.stage === "add_to_carts")?.count ?? 0,
    purchaseCompletion: funnelStages.find((stage) => stage.stage === "purchases")?.count ?? 0,
  };

  return {
    ...payload,
    customerType: query.customerType,
    recommendationRows: recommendationPerformance,
    funnelStages,
    chatSummary,
    bundleSummary,
    recommendationPerformance: recommendationPerformanceContract,
    bundlePerformance,
    chatPerformance,
    funnel,
    loadDurationMs: Date.now() - startedAt,
  };
};

export default function AnalyticsDashboardRoute() {
  const data = useLoaderData<typeof loader>();

  const hasMetrics = data.metrics.length > 0;
  const hasZeroedMetrics = hasMetrics && data.metrics.every((metric) => metric.value === 0 && metric.baselineValue === 0);

  return (
    <Page title="Analytics Dashboard">
      <BlockStack gap="500">
        <AnalyticsFilterBar startDate={data.period.startDate} endDate={data.period.endDate} />

        {hasMetrics ? (
          <KpiSummarySection metrics={data.metrics} />
        ) : (
          <KpiEmptyState reason="no_data" />
        )}

        {hasZeroedMetrics ? <KpiEmptyState reason="partial_data" /> : null}

        <RecommendationPerformanceSection rows={data.recommendationRows} />

        <FunnelSection stages={data.funnelStages} />

        <ChatPerformanceSection summary={data.chatSummary} />

        <BundlePerformanceSection summary={data.bundleSummary} />

        <MetricDefinitionPanel definitions={data.metricDefinitions} />

        <Text as="p" tone="subdued">
          Showing metrics for customer type: {data.customerType}
        </Text>
      </BlockStack>
    </Page>
  );
}
