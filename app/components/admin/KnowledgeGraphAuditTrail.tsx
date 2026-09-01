import { BlockStack, Card, DataTable, EmptyState, Text } from "@shopify/polaris";

export type ChangeHistoryRow = {
  id: string;
  actorId: string | null;
  entityType: string;
  entityId: string;
  action: string;
  reason: string | null;
  createdAt: string;
};

type Props = {
  entries: ChangeHistoryRow[];
};

export function KnowledgeGraphAuditTrail({ entries }: Props) {
  const rows = entries.map((entry) => [
    new Date(entry.createdAt).toLocaleString(),
    entry.actorId ?? "system",
    entry.entityType,
    entry.entityId,
    entry.action,
    entry.reason ?? "—",
  ]);

  return (
    <Card>
      <BlockStack gap="300">
        <Text variant="headingMd" as="h2">
          Change history ({entries.length})
        </Text>
        {entries.length === 0 ? (
          <EmptyState
            heading="No changes recorded yet"
            image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
          >
            <p>Admin edits across the knowledge graph editor will appear here for auditability.</p>
          </EmptyState>
        ) : (
          <DataTable
            columnContentTypes={["text", "text", "text", "text", "text", "text"]}
            headings={["When", "Actor", "Entity type", "Entity id", "Action", "Reason"]}
            rows={rows}
          />
        )}
      </BlockStack>
    </Card>
  );
}
