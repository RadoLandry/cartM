import { Card, Checkbox, InlineStack, RangeSlider, Text, TextField } from "@shopify/polaris";

export interface SafetyPolicySectionValue {
  safetyPriority: "SAFETY_FIRST" | "BALANCED";
  aggressiveness: number;
  customGuidance: string;
}

export interface SafetyPolicySectionProps {
  value: SafetyPolicySectionValue;
  onChange: (next: SafetyPolicySectionValue) => void;
  disabled?: boolean;
}

export function SafetyPolicySection({ value, onChange, disabled = false }: SafetyPolicySectionProps) {
  const safetyFirst = value.safetyPriority === "SAFETY_FIRST";

  return (
    <Card>
      <InlineStack align="space-between" blockAlign="center">
        <Text as="h2" variant="headingSm">
          Safety policy
        </Text>
        <Text as="p" tone="subdued">
          Safety-first mode caps aggressiveness to 0.6.
        </Text>
      </InlineStack>

      <div style={{ marginTop: "0.75rem" }}>
        <Checkbox
          label="Safety-first mode"
          checked={safetyFirst}
          disabled={disabled}
          onChange={(checked) => {
            onChange({
              ...value,
              safetyPriority: checked ? "SAFETY_FIRST" : "BALANCED",
              aggressiveness: checked ? Math.min(value.aggressiveness, 0.6) : value.aggressiveness,
            });
          }}
        />
      </div>

      <div style={{ marginTop: "0.75rem" }}>
        <RangeSlider
          label="Upsell aggressiveness"
          min={0}
          max={1}
          step={0.05}
          value={value.aggressiveness}
          disabled={disabled}
          output
          onChange={(nextValue) => {
            const numeric = typeof nextValue === "number" ? nextValue : Number(nextValue);
            onChange({
              ...value,
              aggressiveness: safetyFirst ? Math.min(numeric, 0.6) : numeric,
            });
          }}
        />
      </div>

      <div style={{ marginTop: "0.75rem" }}>
        <TextField
          label="Safety guidance"
          multiline={4}
          maxLength={2000}
          autoComplete="off"
          value={value.customGuidance}
          disabled={disabled}
          helpText="This guidance is injected into the storefront assistant prompt."
          onChange={(nextValue) => {
            onChange({
              ...value,
              customGuidance: nextValue,
            });
          }}
        />
      </div>
    </Card>
  );
}
