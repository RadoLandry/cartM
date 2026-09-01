import {
  Banner,
  BlockStack,
  Button,
  Card,
  DataTable,
  EmptyState,
  InlineStack,
  Select,
  Text,
  TextField,
  Toast,
} from "@shopify/polaris";
import { useFetcher } from "react-router";
import { useCallback, useState } from "react";

export type SizeMappingRow = {
  id: string;
  sourceCategoryTag: string;
  sourceSize: string;
  targetCategoryTag: string;
  targetSize: string;
  severityOnMismatch: string;
  source: string;
  /** updatedAt.getTime() snapshot used for optimistic-concurrency checks. */
  revision: number;
};

type FieldError = { field: string; code: string; message: string };

type ActionResponse =
  | { ok: true }
  | { ok: false; error?: string; contradictions?: FieldError[]; conflict?: { message: string } };

type Props = {
  mappings: SizeMappingRow[];
  categoryTags: string[];
};

export function KnowledgeGraphSizeMappings({ mappings, categoryTags }: Props) {
  const fetcher = useFetcher<ActionResponse>();
  const [toast, setToast] = useState<{ message: string; error?: boolean } | null>(null);
  const [sourceCat, setSourceCat] = useState("");
  const [sourceSize, setSourceSize] = useState("");
  const [targetCat, setTargetCat] = useState("");
  const [targetSize, setTargetSize] = useState("");
  const [severity, setSeverity] = useState<"WARNING" | "ERROR">("WARNING");

  const response = fetcher.data;
  const errorMessage = response && !response.ok ? response.error : null;
  const contradictions = (response && !response.ok && response.contradictions) || [];
  const staleWriteMessage = response && !response.ok ? response.conflict?.message : null;

  const catOptions = [
    { label: "— select —", value: "" },
    ...categoryTags.map((t) => ({ label: t, value: t })),
  ];
  const severityOptions = [
    { label: "WARNING", value: "WARNING" },
    { label: "ERROR", value: "ERROR" },
  ];

  const handleCreate = useCallback(() => {
    if (!sourceCat || !sourceSize || !targetCat || !targetSize) return;
    fetcher.submit(
      {
        intent: "upsert-size-mapping-rule",
        sourceCategoryTag: sourceCat,
        sourceSize,
        targetCategoryTag: targetCat,
        targetSize,
        severityOnMismatch: severity,
      },
      { method: "post" },
    );
  }, [fetcher, sourceCat, sourceSize, targetCat, targetSize, severity]);

  const handleDeactivate = useCallback(
    (mapping: SizeMappingRow) => {
      fetcher.submit(
        {
          intent: "deactivate-size-mapping-rule",
          mappingId: mapping.id,
          expectedRevision: String(mapping.revision),
        },
        { method: "post" },
      );
      setToast({ message: `Mapping ${mapping.sourceCategoryTag} → ${mapping.targetCategoryTag} removed` });
    },
    [fetcher],
  );

  const rows = mappings.map((m) => [
    m.sourceCategoryTag,
    m.sourceSize,
    m.targetCategoryTag,
    m.targetSize,
    m.severityOnMismatch,
    m.source,
    <Button key={`deact-${m.id}`} size="slim" tone="critical" onClick={() => handleDeactivate(m)}>
      Deactivate
    </Button>,
  ]);

  return (
    <Card>
      {toast && <Toast content={toast.message} error={toast.error} onDismiss={() => setToast(null)} />}
      <BlockStack gap="400">
        <Text variant="headingMd" as="h2">
          Governed size mappings ({mappings.length})
        </Text>

        {errorMessage && (
          <Banner tone="critical" title="Could not save mapping">
            <p>{errorMessage}</p>
          </Banner>
        )}
        {staleWriteMessage && (
          <Banner tone="warning" title="Refresh required">
            <p>{staleWriteMessage}</p>
          </Banner>
        )}
        {contradictions.length > 0 && (
          <Banner tone="warning" title="Contradiction detected">
            <BlockStack gap="100">
              {contradictions.map((c) => (
                <Text as="p" key={`${c.field}-${c.code}`}>
                  {c.message}
                </Text>
              ))}
            </BlockStack>
          </Banner>
        )}

        {mappings.length === 0 ? (
          <EmptyState
            heading="No governed size mappings yet"
            image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
          >
            <p>Create a mapping below to define expected size correspondence across categories.</p>
          </EmptyState>
        ) : (
          <DataTable
            columnContentTypes={["text", "text", "text", "text", "text", "text", "text"]}
            headings={["Source category", "Source size", "Target category", "Target size", "Severity", "Origin", "Actions"]}
            rows={rows}
          />
        )}

        <BlockStack gap="200">
          <Text variant="headingSm" as="h3">
            Add mapping
          </Text>
          <InlineStack gap="200" wrap>
            <Select label="Source category" options={catOptions} value={sourceCat} onChange={setSourceCat} />
            <TextField label="Source size" value={sourceSize} onChange={setSourceSize} autoComplete="off" />
            <Select label="Target category" options={catOptions} value={targetCat} onChange={setTargetCat} />
            <TextField label="Target size" value={targetSize} onChange={setTargetSize} autoComplete="off" />
            <Select
              label="Severity"
              options={severityOptions}
              value={severity}
              onChange={(v) => setSeverity(v as "WARNING" | "ERROR")}
            />
          </InlineStack>
          <InlineStack>
            <Button variant="primary" onClick={handleCreate} loading={fetcher.state !== "idle"}>
              Save mapping
            </Button>
          </InlineStack>
        </BlockStack>
      </BlockStack>
    </Card>
  );
}
