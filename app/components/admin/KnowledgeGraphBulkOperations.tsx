import {
  Banner,
  BlockStack,
  Button,
  Card,
  InlineStack,
  Select,
  Text,
  TextField,
  Toast,
} from "@shopify/polaris";
import { useFetcher } from "react-router";
import { useCallback, useState } from "react";

type BulkOperationType = "RECLASSIFY" | "TAG_APPLY" | "TAG_REMOVE";

type PreviewResponse =
  | { ok: true; operationId: string; previewHash: string; targetCount: number; sampleTargetIds: string[] }
  | { ok: false; error?: string };

type ConfirmResponse =
  | { ok: true; status: "COMPLETED" | "PARTIAL" | "FAILED"; results: Array<{ productId: string; ok: boolean; error?: string }> }
  | { ok: false; error?: string };

type Props = {
  categoryTags: string[];
  disciplineTags: string[];
};

function parseCommaList(value: string): string[] {
  return value
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

export function KnowledgeGraphBulkOperations({ categoryTags, disciplineTags }: Props) {
  const previewFetcher = useFetcher<PreviewResponse>();
  const confirmFetcher = useFetcher<ConfirmResponse>();
  const [toast, setToast] = useState<{ message: string; error?: boolean } | null>(null);

  const [operationType, setOperationType] = useState<BulkOperationType>("TAG_APPLY");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterDiscipline, setFilterDiscipline] = useState("");
  const [disciplineTagsToAdd, setDisciplineTagsToAdd] = useState("");
  const [categoryTagsToAdd, setCategoryTagsToAdd] = useState("");
  const [disciplineTagsToRemove, setDisciplineTagsToRemove] = useState("");
  const [categoryTagsToRemove, setCategoryTagsToRemove] = useState("");

  const preview = previewFetcher.data;
  const confirmResult = confirmFetcher.data;

  const operationTypeOptions = [
    { label: "Apply tags", value: "TAG_APPLY" },
    { label: "Remove tags", value: "TAG_REMOVE" },
    { label: "Reclassify (replace tags)", value: "RECLASSIFY" },
  ];
  const categoryOptions = [
    { label: "Any category", value: "" },
    ...categoryTags.map((t) => ({ label: t, value: t })),
  ];
  const disciplineOptions = [
    { label: "Any discipline", value: "" },
    ...disciplineTags.map((t) => ({ label: t, value: t })),
  ];

  const buildPayload = useCallback(
    () => ({
      operationType,
      filter: {
        categoryTags: filterCategory ? [filterCategory] : undefined,
        disciplineTags: filterDiscipline ? [filterDiscipline] : undefined,
      },
      changePayload: {
        disciplineTagsToAdd: parseCommaList(disciplineTagsToAdd),
        categoryTagsToAdd: parseCommaList(categoryTagsToAdd),
        disciplineTagsToRemove: parseCommaList(disciplineTagsToRemove),
        categoryTagsToRemove: parseCommaList(categoryTagsToRemove),
      },
    }),
    [
      operationType,
      filterCategory,
      filterDiscipline,
      disciplineTagsToAdd,
      categoryTagsToAdd,
      disciplineTagsToRemove,
      categoryTagsToRemove,
    ],
  );

  const handlePreview = useCallback(() => {
    const payload = buildPayload();
    previewFetcher.submit(
      {
        intent: "preview-bulk-operation",
        operationType: payload.operationType,
        filter: JSON.stringify(payload.filter),
        changePayload: JSON.stringify(payload.changePayload),
      },
      { method: "post" },
    );
  }, [buildPayload, previewFetcher]);

  const handleConfirm = useCallback(() => {
    if (!preview || !preview.ok) return;
    confirmFetcher.submit(
      {
        intent: "confirm-bulk-operation",
        operationId: preview.operationId,
        previewHash: preview.previewHash,
      },
      { method: "post" },
    );
  }, [preview, confirmFetcher]);

  const handleCancel = useCallback(() => {
    if (!preview || !preview.ok) return;
    confirmFetcher.submit(
      { intent: "cancel-bulk-operation", operationId: preview.operationId },
      { method: "post" },
    );
    setToast({ message: "Bulk operation cancelled — no changes were applied" });
  }, [preview, confirmFetcher]);

  return (
    <Card>
      {toast && <Toast content={toast.message} error={toast.error} onDismiss={() => setToast(null)} />}
      <BlockStack gap="400">
        <Text variant="headingMd" as="h2">
          Bulk governance updates
        </Text>

        <InlineStack gap="200" wrap>
          <Select label="Operation" options={operationTypeOptions} value={operationType} onChange={(v) => setOperationType(v as BulkOperationType)} />
          <Select label="Filter by category" options={categoryOptions} value={filterCategory} onChange={setFilterCategory} />
          <Select label="Filter by discipline" options={disciplineOptions} value={filterDiscipline} onChange={setFilterDiscipline} />
        </InlineStack>

        <InlineStack gap="200" wrap>
          <TextField
            label="Discipline tags to add"
            value={disciplineTagsToAdd}
            onChange={setDisciplineTagsToAdd}
            autoComplete="off"
            helpText="Comma-separated"
          />
          <TextField
            label="Category tags to add"
            value={categoryTagsToAdd}
            onChange={setCategoryTagsToAdd}
            autoComplete="off"
            helpText="Comma-separated"
          />
          <TextField
            label="Discipline tags to remove"
            value={disciplineTagsToRemove}
            onChange={setDisciplineTagsToRemove}
            autoComplete="off"
            helpText="Comma-separated"
          />
          <TextField
            label="Category tags to remove"
            value={categoryTagsToRemove}
            onChange={setCategoryTagsToRemove}
            autoComplete="off"
            helpText="Comma-separated"
          />
        </InlineStack>

        <InlineStack gap="200">
          <Button onClick={handlePreview} loading={previewFetcher.state !== "idle"}>
            Preview
          </Button>
        </InlineStack>

        {preview && !preview.ok && (
          <Banner tone="critical" title="Preview failed">
            <p>{preview.error}</p>
          </Banner>
        )}

        {preview && preview.ok && (
          <Banner tone="info" title={`${preview.targetCount} product(s) targeted`}>
            <BlockStack gap="200">
              <Text as="p">Preview hash: {preview.previewHash}</Text>
              <InlineStack gap="200">
                <Button variant="primary" onClick={handleConfirm} loading={confirmFetcher.state !== "idle"}>
                  Confirm &amp; apply
                </Button>
                <Button tone="critical" onClick={handleCancel}>
                  Cancel
                </Button>
              </InlineStack>
            </BlockStack>
          </Banner>
        )}

        {confirmResult && confirmResult.ok && (
          <Banner
            tone={confirmResult.status === "COMPLETED" ? "success" : confirmResult.status === "PARTIAL" ? "warning" : "critical"}
            title={`Bulk operation ${confirmResult.status.toLowerCase()}`}
          >
            <p>
              {confirmResult.results.filter((r) => r.ok).length} of {confirmResult.results.length} records updated successfully.
            </p>
          </Banner>
        )}
        {confirmResult && !confirmResult.ok && (
          <Banner tone="critical" title="Bulk operation failed">
            <p>{confirmResult.error}</p>
          </Banner>
        )}
      </BlockStack>
    </Card>
  );
}
