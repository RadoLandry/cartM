import { Badge, BlockStack, Card, InlineStack, Text } from "@shopify/polaris";
import type { DashboardKpiMetric } from "../../../lib/analytics/aggregation";

function formatMetricValue(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function trendTone(delta: number): "success" | "critical" | "info" {
  if (delta > 0) {
    return "success";
  }

  if (delta < 0) {
    return "critical";
  }

  return "info";
}

export function KpiSummarySection({ metrics }: { metrics: DashboardKpiMetric[] }) {
  return (
    <BlockStack gap="300">
      {metrics.map((metric) => {
        const deltaLabel = `${metric.absoluteDelta >= 0 ? "+" : ""}${metric.absoluteDelta.toFixed(2)}`;

        return (
        <Card key={metric.key}>
          <BlockStack gap="200">
            <InlineStack align="space-between" blockAlign="center">
              <Text as="h3" variant="headingSm">
                {metric.key}
              </Text>
              <Badge tone={trendTone(metric.absoluteDelta)}>{deltaLabel}</Badge>
            </InlineStack>
            <Text as="p" variant="headingLg">
              {formatMetricValue(metric.value)}
            </Text>
            <Text as="p" variant="bodySm" tone="subdued">
              Baseline: {formatMetricValue(metric.baselineValue)} | Delta: {metric.percentDelta.toFixed(2)}%
            </Text>
          </BlockStack>
        </Card>
      )})}
    </BlockStack>
  );
}
