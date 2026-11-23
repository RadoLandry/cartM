import { useState } from "react";
import { Form } from "react-router";
import { Banner, BlockStack, Button, FormLayout, InlineStack, List, Select, Text, TextField } from "@shopify/polaris";

type PreviewBundleRuleOption = {
  id: string;
  label: string;
  status: string;
};

type BundlePreviewMatch = {
  bundleKey: string;
  label?: string;
  status: string;
  coverageRatio?: number;
  missingComponents?: Array<{ label: string; remainingQuantity: number; isRequired: boolean }>;
  reasons?: Array<{ reasonType: string; message: string; confidence: number }>;
  competitionGroupKeys?: string[];
};

type BundleRulePreviewPanelActionData = {
  intent?: string;
  ok?: boolean;
  error?: string;
  preview?: BundlePreviewMatch | null;
};

type BundleRulePreviewPanelProps = {
  productCount: number;
  categoryCount: number;
  bundleRules: PreviewBundleRuleOption[];
  actionData?: BundleRulePreviewPanelActionData;
};

const DEFAULT_CART_FIXTURE = JSON.stringify(
  [{ productId: "", variantId: "", quantity: 1 }],
  null,
  2,
);

function PreviewFields({ bundleRules }: { bundleRules: PreviewBundleRuleOption[] }) {
  const [ruleId, setRuleId] = useState("");
  const [fixture, setFixture] = useState(DEFAULT_CART_FIXTURE);

  return (
    <FormLayout>
      <Select
        label="Bundle rule"
        name="bundleRuleId"
        value={ruleId}
        onChange={setRuleId}
        options={[
          { label: "Select a rule", value: "" },
          ...bundleRules.map((rule) => ({ label: `${rule.label} (${rule.status})`, value: rule.id })),
        ]}
      />
      <TextField
        label="Cart fixture"
        helpText="JSON array of productId / variantId / quantity."
        name="cartFixture"
        value={fixture}
        onChange={setFixture}
        autoComplete="off"
        multiline={6}
        monospaced
      />
      <InlineStack align="start">
        <Button submit variant="primary" disabled={!ruleId}>Run preview</Button>
      </InlineStack>
    </FormLayout>
  );
}

export function BundleRulePreviewPanel({
  productCount,
  categoryCount,
  bundleRules,
  actionData,
}: BundleRulePreviewPanelProps) {
  const preview = actionData?.intent === "preview-bundle-rule" ? actionData.preview : undefined;

  return (
    <BlockStack gap="300">
      <Text as="h2" variant="headingMd">
        Preview bundle qualification
      </Text>
      <Text as="p" variant="bodySm" tone="subdued">
        {productCount} products and {categoryCount} category tags are available for preview composition.
      </Text>

      {actionData?.intent === "preview-bundle-rule" && actionData.error ? (
        <Banner tone="warning">
          <p>{actionData.error}</p>
        </Banner>
      ) : null}

      <Form method="post">
        <BlockStack gap="300">
          <input type="hidden" name="intent" value="preview-bundle-rule" />
          <PreviewFields bundleRules={bundleRules} />
        </BlockStack>
      </Form>

      {preview ? (
        <BlockStack gap="200">
          <Text as="h3" variant="headingSm">
            Result: {preview.label ?? preview.bundleKey} — {preview.status}
          </Text>

          {typeof preview.coverageRatio === "number" ? (
            <Text as="p" variant="bodySm" tone="subdued">
              Coverage ratio: {preview.coverageRatio}
            </Text>
          ) : null}

          {preview.missingComponents && preview.missingComponents.length > 0 ? (
            <List type="bullet">
              {preview.missingComponents.map((component) => (
                <List.Item key={component.label}>
                  <Text as="span" variant="bodySm" tone={component.isRequired ? "critical" : "subdued"}>
                    {component.label}: {component.remainingQuantity} more needed
                  </Text>
                </List.Item>
              ))}
            </List>
          ) : (
            <Text as="p" variant="bodySm" tone="subdued">
              No missing requirements.
            </Text>
          )}

          {preview.reasons && preview.reasons.length > 0 ? (
            <List type="bullet">
              {preview.reasons.map((reason, index) => (
                <List.Item key={`${reason.reasonType}-${index}`}>
                  <Text as="span" variant="bodySm" tone="subdued">
                    {reason.message} (confidence {reason.confidence})
                  </Text>
                </List.Item>
              ))}
            </List>
          ) : null}

          {preview.competitionGroupKeys && preview.competitionGroupKeys.length > 0 ? (
            <Text as="p" variant="bodySm" tone="subdued">
              Competes with: {preview.competitionGroupKeys.join(", ")}
            </Text>
          ) : null}
        </BlockStack>
      ) : null}
    </BlockStack>
  );
}
