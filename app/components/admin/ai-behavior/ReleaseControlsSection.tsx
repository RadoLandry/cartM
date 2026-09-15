import { Button, InlineStack, Select, Text } from "@shopify/polaris";

export function ReleaseControlsSection(props: {
  history: Array<{ id: string; versionNumber: number; status: string }>;
  onPublish: () => void;
  onRollback: (versionId: string) => void;
  disabled?: boolean;
}) {
  const archived = props.history.filter((entry) => entry.status === "ARCHIVED");
  return (
    <InlineStack gap="300" blockAlign="end">
      <Button variant="primary" onClick={props.onPublish} loading={props.disabled}>
        Publish draft
      </Button>
      <Select
        label="Rollback version"
        labelHidden
        options={archived.length > 0
          ? archived.map((entry) => ({ label: `Version ${entry.versionNumber}`, value: entry.id }))
          : [{ label: "No archived versions", value: "" }]}
        value={archived[0]?.id ?? ""}
        onChange={props.onRollback}
        disabled={props.disabled || archived.length === 0}
      />
      <Text as="span" tone="subdued">Published changes affect new conversations.</Text>
    </InlineStack>
  );
}
