import { BlockStack, Card, InlineStack, Text } from "@shopify/polaris";

import type { FunnelStage } from "../../../lib/analytics/funnel";

function asPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export function FunnelSection({ stages }: { stages: FunnelStage[] }) {
  return (
    <Card>
      <BlockStack gap="200">
        <Text as="h3" variant="headingSm">
          Recommendation Funnel
        </Text>
        {stages.length === 0 ? (
          <Text as="p" tone="subdued">
            No funnel events available for this period.
          </Text>
        ) : (
          stages.map((stage) => (
            <InlineStack key={stage.stage} align="space-between">
              <Text as="p">{stage.stage.replaceAll("_", " ")}</Text>
              <Text as="p" tone="subdued">
                {stage.count} ({asPercent(stage.rateFromPrevious)})
              </Text>
            </InlineStack>
          ))
        )}
      </BlockStack>
    </Card>
  );
}
