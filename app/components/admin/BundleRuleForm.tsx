import { useState } from "react";
import { Form } from "react-router";
import {
  Badge,
  Banner,
  BlockStack,
  Button,
  FormLayout,
  InlineStack,
  Select,
  Text,
  TextField,
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
    <BlockStack gap="400">
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
        <InlineStack gap="200" blockAlign="center">
          <Text as="span" variant="bodyMd">Editing {selectedRule.label}</Text>
          <Badge tone={statusBadgeTone(selectedRule.status)}>{selectedRule.status}</Badge>
        </InlineStack>
      ) : null}

      <Form method="post">
        <input type="hidden" name="intent" value={isEditing ? "update-bundle-rule" : "create-bundle-rule"} />
        {isEditing ? <input type="hidden" name="bundleRuleId" value={selectedRule?.id} /> : null}
        <BundleRuleFields key={selectedRule?.id ?? "new"} selectedRule={selectedRule} isEditing={isEditing} />
      </Form>

      {selectedRule?.status === "DRAFT" ? (
        <Form method="post">
          <input type="hidden" name="intent" value="transition-bundle-rule-status" />
          <input type="hidden" name="bundleRuleId" value={selectedRule.id} />
          <input type="hidden" name="toStatus" value="ACTIVE" />
          <InlineStack align="space-between" blockAlign="center" gap="300">
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

function statusBadgeTone(status: string): "success" | "critical" | "info" {
  if (status === "ACTIVE") return "success";
  if (status === "DRAFT") return "critical";
  return "info";
}

// Polaris fields are controlled; this keeps them submit-able as plain form fields via `name`.
function BundleRuleFields({
  selectedRule,
  isEditing,
}: {
  selectedRule?: BundleRuleFormRule | null;
  isEditing: boolean;
}) {
  const [key, setKey] = useState(selectedRule?.key ?? "");
  const [label, setLabel] = useState(selectedRule?.label ?? "");
  const [description, setDescription] = useState(selectedRule?.description ?? "");
  const [priority, setPriority] = useState(String(selectedRule?.priority ?? 100));
  const [threshold, setThreshold] = useState(String(selectedRule?.completionThreshold ?? 0.8));
  const [discountType, setDiscountType] = useState(selectedRule?.discountType ?? "PERCENTAGE");
  const [discountValue, setDiscountValue] = useState(selectedRule?.discountValue ?? "10.00");

  return (
    <FormLayout>
      <FormLayout.Group>
        <TextField label="Bundle key" name="key" value={key} onChange={setKey} autoComplete="off" requiredIndicator />
        <TextField label="Bundle label" name="label" value={label} onChange={setLabel} autoComplete="off" requiredIndicator />
      </FormLayout.Group>
      <TextField
        label="Description"
        name="description"
        value={description}
        onChange={setDescription}
        autoComplete="off"
        multiline={3}
      />
      <FormLayout.Group>
        <TextField
          label="Priority"
          name="priority"
          type="number"
          min={0}
          value={priority}
          onChange={setPriority}
          autoComplete="off"
          helpText="Lower numbers are evaluated first."
        />
        <TextField
          label="Completion threshold"
          name="completionThreshold"
          type="number"
          step={0.01}
          min={0.01}
          max={1}
          value={threshold}
          onChange={setThreshold}
          autoComplete="off"
          helpText="Share of required components (0.01–1) needed to qualify."
        />
      </FormLayout.Group>
      <FormLayout.Group>
        <Select
          label="Discount type"
          name="discountType"
          options={[
            { label: "Percentage", value: "PERCENTAGE" },
            { label: "Fixed", value: "FIXED" },
          ]}
          value={discountType}
          onChange={(value) => setDiscountType(value as "PERCENTAGE" | "FIXED")}
        />
        <TextField
          label="Discount value"
          name="discountValue"
          type="number"
          min={0.01}
          step={0.01}
          value={discountValue}
          onChange={setDiscountValue}
          autoComplete="off"
          suffix={discountType === "PERCENTAGE" ? "%" : undefined}
        />
      </FormLayout.Group>
      <Button submit variant="primary">
        {isEditing ? "Save rule changes" : "Create draft rule"}
      </Button>
    </FormLayout>
  );
}
