import { Card, Text } from "@shopify/polaris";

export function KpiEmptyState({ reason }: { reason: "no_data" | "partial_data" }) {
  const message =
    reason === "no_data"
      ? "No analytics data is available for this period yet."
      : "Some KPI inputs are unavailable. Displayed values are partial.";

  return (
    <Card>
      <Text as="p" tone="subdued">
        {message}
      </Text>
    </Card>
  );
}
