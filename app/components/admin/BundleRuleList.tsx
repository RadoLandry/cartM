import { BlockStack, Button, Card, EmptyState, InlineStack, List, Text } from "@shopify/polaris";

type BundleRuleListItem = {
  id: string;
  key: string;
  label: string;
  description?: string | null;
  status: string;
  priority: number;
  discountType: string;
  discountValue: string;
  components: Array<{ id: string }>;
};

type BundleRuleListProps = {
  bundleRules: BundleRuleListItem[];
  selectedRuleId?: string | null;
  validationByRuleId?: Record<string, string[]>;
};

function statusTone(status: string): "success" | "critical" | "subdued" {
  if (status === "ACTIVE") {
    return "success";
  }

  if (status === "DRAFT") {
    return "critical";
  }

  return "subdued";
}

export function BundleRuleList({ bundleRules, selectedRuleId, validationByRuleId = {} }: BundleRuleListProps) {
  if (bundleRules.length === 0) {
    return (
      <EmptyState
        heading="No bundle rules yet"
        image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
      >
        <p>Bundle rules created here will become the source of truth for deterministic cart offers.</p>
      </EmptyState>
    );
  }

  return (
    <BlockStack gap="200">
      {bundleRules.map((rule) => (
        <Card key={rule.id}>
          <div style={{ display: "grid", gap: "0.75rem" }}>
            <InlineStack align="space-between">
              <div>
                <Text as="h3" variant="headingSm">
                  {rule.label}
                </Text>
                <Text as="p" variant="bodySm" tone="subdued">
                  {rule.key}
                </Text>
              </div>
              <InlineStack gap="300" align="end" blockAlign="center">
                <Text as="span" variant="bodySm" tone={statusTone(rule.status)}>
                  {rule.status}
                </Text>
                <Text as="span" variant="bodySm" tone="subdued">
                  Priority {rule.priority}
                </Text>
                <Button
                  size="micro"
                  variant={selectedRuleId === rule.id ? "primary" : "secondary"}
                  url={`/app/bundles?ruleId=${encodeURIComponent(rule.id)}`}
                >
                  {selectedRuleId === rule.id ? "Editing" : "Edit"}
                </Button>
              </InlineStack>
            </InlineStack>

            <Text as="p" variant="bodyMd">
              {rule.description || "No description yet."}
            </Text>

            <Text as="p" variant="bodySm" tone="subdued">
              {rule.components.length} component(s) · {rule.discountType} {rule.discountValue}
            </Text>

            {rule.status === "DRAFT" && (validationByRuleId[rule.id]?.length ?? 0) > 0 ? (
              <List type="bullet">
                {validationByRuleId[rule.id].map((message) => (
                  <List.Item key={`${rule.id}-${message}`}>
                    <Text as="span" variant="bodySm" tone="critical">
                      {message}
                    </Text>
                  </List.Item>
                ))}
              </List>
            ) : null}
          </div>
        </Card>
      ))}
    </BlockStack>
  );
}
