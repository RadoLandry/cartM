import { BlockStack, Card, InlineStack, Text } from "@shopify/polaris";

import type { ChatOutcomeSummary } from "../../../lib/analytics/chat";

function asPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export function ChatPerformanceSection({ summary }: { summary: ChatOutcomeSummary }) {
  return (
    <Card>
      <BlockStack gap="200">
        <Text as="h3" variant="headingSm">
          Chat Outcomes
        </Text>
        <InlineStack align="space-between">
          <Text as="p">Sessions</Text>
          <Text as="p" tone="subdued">
            {summary.sessions}
          </Text>
        </InlineStack>
        <InlineStack align="space-between">
          <Text as="p">Conversions</Text>
          <Text as="p" tone="subdued">
            {summary.conversions}
          </Text>
        </InlineStack>
        <InlineStack align="space-between">
          <Text as="p">Conversion Rate</Text>
          <Text as="p" tone="subdued">
            {asPercent(summary.conversionRate)}
          </Text>
        </InlineStack>
        <InlineStack align="space-between">
          <Text as="p">Assisted Revenue</Text>
          <Text as="p" tone="subdued">
            ${summary.assistedRevenue.toFixed(2)}
          </Text>
        </InlineStack>
      </BlockStack>
    </Card>
  );
}
