import { Form } from "react-router";
import {
  Banner,
  BlockStack,
  Button,
  InlineStack,
  Text,
} from "@shopify/polaris";

type BundleRuleFormRule = {
  id: string;
  key: string;
  label: string;
  description?: string | null;
  status: string;
  priority: number;
  completionThreshold: number;
  discountType: "PERCENTAGE" | "FIXED";
  discountValue: string;
};

type BundleRuleFormActionData = {
  ok?: boolean;
  intent?: string;
  error?: string;
  validationIssues?: Array<{ code: string; message: string }>;
};

type BundleRuleFormProps = {
  selectedRule?: BundleRuleFormRule | null;
  categoryTags: string[];
  actionData?: BundleRuleFormActionData;
};

export function BundleRuleForm({ selectedRule, categoryTags, actionData }: BundleRuleFormProps) {
  const isEditing = Boolean(selectedRule);

  const statusTone: "success" | "critical" | "subdued" =
    selectedRule?.status === "ACTIVE"
      ? "success"
      : selectedRule?.status === "DRAFT"
        ? "critical"
        : "subdued";

  return (
    <BlockStack gap="300">
      {actionData?.error ? (
        <Banner tone="warning">
          <p>{actionData.error}</p>
          {actionData.validationIssues?.length ? (
            <ul>
              {actionData.validationIssues.map((issue) => (
                <li key={issue.code}>{issue.message}</li>
              ))}
            </ul>
          ) : null}
        </Banner>
      ) : null}

      {actionData?.ok ? (
        <Banner tone="success">
          <p>Bundle rule saved successfully.</p>
        </Banner>
      ) : null}

      <Text as="p" variant="bodySm" tone="subdued">
        Use this editor to create a draft bundle rule or update an existing rule without mutating unrelated fields.
      </Text>

      {selectedRule ? (
        <Text as="p" variant="bodySm" tone={statusTone}>
          Editing {selectedRule.label} ({selectedRule.status})
        </Text>
      ) : null}

      <Form method="post">
        <BlockStack gap="300">
          <input type="hidden" name="intent" value={isEditing ? "update-bundle-rule" : "create-bundle-rule"} />
          {isEditing ? <input type="hidden" name="bundleRuleId" value={selectedRule?.id} /> : null}

          <label>
            Bundle key
            <input name="key" autoComplete="off" required defaultValue={selectedRule?.key ?? ""} />
          </label>
          <label>
            Bundle label
            <input name="label" autoComplete="off" required defaultValue={selectedRule?.label ?? ""} />
          </label>
          <label>
            Description
            <textarea name="description" rows={3} defaultValue={selectedRule?.description ?? ""} />
          </label>

          <InlineStack gap="300" align="start">
            <label>
              Priority
              <input name="priority" type="number" min={0} defaultValue={String(selectedRule?.priority ?? 100)} />
            </label>
            <label>
              Completion threshold
              <input
                name="completionThreshold"
                type="number"
                step={0.01}
                min={0.01}
                max={1}
                defaultValue={String(selectedRule?.completionThreshold ?? 0.8)}
              />
            </label>
          </InlineStack>

          <InlineStack gap="300" align="start">
            <label>
              Discount type
              <select name="discountType" defaultValue={selectedRule?.discountType ?? "PERCENTAGE"}>
                <option value="PERCENTAGE">Percentage</option>
                <option value="FIXED">Fixed</option>
              </select>
            </label>
            <label>
              Discount value
              <input
                name="discountValue"
                autoComplete="off"
                type="number"
                min={0.01}
                step={0.01}
                defaultValue={selectedRule?.discountValue ?? "10.00"}
              />
            </label>
          </InlineStack>

          <Button submit variant="primary">
            {isEditing ? "Save rule changes" : "Create draft rule"}
          </Button>
        </BlockStack>
      </Form>

      {selectedRule?.status === "DRAFT" ? (
        <Form method="post">
          <input type="hidden" name="intent" value="transition-bundle-rule-status" />
          <input type="hidden" name="bundleRuleId" value={selectedRule.id} />
          <input type="hidden" name="toStatus" value="ACTIVE" />
          <InlineStack align="space-between" blockAlign="center">
            <Text as="p" variant="bodySm" tone="subdued">
              Activation validates required components, discount values, and schedule semantics.
            </Text>
            <Button submit tone="success" variant="primary">
              Activate draft
            </Button>
          </InlineStack>
        </Form>
      ) : null}

      <Text as="p" variant="bodySm" tone="subdued">
        {categoryTags.length} category tags are available when configuring bundle requirements in the next phase.
      </Text>
    </BlockStack>
  );
}
