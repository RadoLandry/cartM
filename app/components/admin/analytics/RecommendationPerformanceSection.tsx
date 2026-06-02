import { BlockStack, Card, InlineStack, Text } from "@shopify/polaris";

import type { RecommendationPerformanceRow } from "../../../lib/analytics/recommendations";

function asPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export function RecommendationPerformanceSection({ rows }: { rows: RecommendationPerformanceRow[] }) {
  return (
    <BlockStack gap="300">
      {rows.length === 0 ? (
        <Card>
          <Text as="p" tone="subdued">
            No recommendation events available for this period.
          </Text>
        </Card>
      ) : null}

      {rows.map((row) => (
        <Card key={row.category}>
          <BlockStack gap="200">
            <InlineStack align="space-between">
              <Text as="h3" variant="headingSm">
                {row.category}
              </Text>
              <Text as="p" tone="subdued">
                Score: {asPercent(row.score)}
              </Text>
            </InlineStack>
            <Text as="p" variant="bodySm">
              CTR {asPercent(row.clickThroughRate)} | Add-to-cart {asPercent(row.addToCartRate)} | Purchase {asPercent(row.purchaseRate)}
            </Text>
          </BlockStack>
        </Card>
      ))}
    </BlockStack>
  );
}
