import { BlockStack, Card, InlineStack, Text } from "@shopify/polaris";

import type { BundleOutcomeSummary } from "../../../lib/analytics/bundles";

function asPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export function BundlePerformanceSection({ summary }: { summary: BundleOutcomeSummary }) {
  return (
    <Card>
      <BlockStack gap="200">
        <Text as="h3" variant="headingSm">
          Bundle Outcomes
        </Text>
        <InlineStack align="space-between">
          <Text as="p">Bundle Views</Text>
          <Text as="p" tone="subdued">
            {summary.bundleViews}
          </Text>
        </InlineStack>
        <InlineStack align="space-between">
          <Text as="p">Bundle Adds</Text>
          <Text as="p" tone="subdued">
            {summary.bundleAdds}
          </Text>
        </InlineStack>
        <InlineStack align="space-between">
          <Text as="p">Bundle Purchases</Text>
          <Text as="p" tone="subdued">
            {summary.bundlePurchases}
          </Text>
        </InlineStack>
        <InlineStack align="space-between">
          <Text as="p">Add Rate</Text>
          <Text as="p" tone="subdued">
            {asPercent(summary.addRate)}
          </Text>
        </InlineStack>
        <InlineStack align="space-between">
          <Text as="p">Purchase Rate</Text>
          <Text as="p" tone="subdued">
            {asPercent(summary.purchaseRate)}
          </Text>
        </InlineStack>
      </BlockStack>
    </Card>
  );
}
