import { BlockStack, Text } from "@shopify/polaris";

type BundleRulePreviewPanelProps = {
  productCount: number;
  categoryCount: number;
};

export function BundleRulePreviewPanel({ productCount, categoryCount }: BundleRulePreviewPanelProps) {
  return (
    <BlockStack gap="200">
      <Text as="h2" variant="headingMd">
        Preview panel scaffold
      </Text>
      <Text as="p" variant="bodySm" tone="subdued">
        Preview request builder and result rendering will be implemented in the User Story 2 phase.
      </Text>
      <Text as="p" variant="bodySm" tone="subdued">
        {productCount} products and {categoryCount} category tags are available for preview composition.
      </Text>
    </BlockStack>
  );
}
