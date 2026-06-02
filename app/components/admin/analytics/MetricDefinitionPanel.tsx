import { BlockStack, Card, Text } from "@shopify/polaris";

import type { AnalyticsKpiDefinition } from "../../../lib/analytics/definitions";

export function MetricDefinitionPanel({ definitions }: { definitions: AnalyticsKpiDefinition[] }) {
  return (
    <Card>
      <BlockStack gap="300">
        <Text as="h3" variant="headingSm">
          Metric Definitions
        </Text>
        {definitions.map((definition) => (
          <BlockStack key={definition.key} gap="100">
            <Text as="p" variant="bodyMd" fontWeight="semibold">
              {definition.displayName}
            </Text>
            <Text as="p" variant="bodySm" tone="subdued">
              {definition.description}
            </Text>
          </BlockStack>
        ))}
      </BlockStack>
    </Card>
  );
}
