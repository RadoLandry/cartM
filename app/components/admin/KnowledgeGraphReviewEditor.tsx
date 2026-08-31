import {
  BlockStack,
  Button,
  Card,
  InlineStack,
  Select,
  Text,
  Toast,
} from "@shopify/polaris";
import { useFetcher } from "react-router";
import { useCallback, useState } from "react";
import { RelationshipType } from "@prisma/client";

type TaxonomyEditorProps = {
  shopifyProductId: string;
  title: string;
  currentDisciplineTags: string[];
  currentCategoryTags: string[];
  availableDisciplines: string[];
  availableCategories: string[];
  onSaved?: () => void;
};

/**
 * Inline taxonomy override editor panel.
 * Lets the merchant change discipline/category tags and persist them as manual overrides.
 */
export function TaxonomyOverridePanel({
  shopifyProductId,
  title,
  currentDisciplineTags,
  currentCategoryTags,
  availableDisciplines,
  availableCategories,
  onSaved,
}: TaxonomyEditorProps) {
  const fetcher = useFetcher();
  const [toast, setToast] = useState<{ message: string; error?: boolean } | null>(null);
  const [discipline, setDiscipline] = useState(currentDisciplineTags[0] ?? "");
  const [category, setCategory] = useState(currentCategoryTags[0] ?? "");

  const disciplineOptions = [
    { label: "— select —", value: "" },
    ...availableDisciplines.map((d) => ({ label: d, value: d })),
  ];
  const categoryOptions = [
    { label: "— select —", value: "" },
    ...availableCategories.map((c) => ({ label: c, value: c })),
  ];

  const handleSave = useCallback(() => {
    if (!discipline && !category) {
      setToast({ message: "Select at least one tag to save", error: true });
      return;
    }
    const disciplineTags = discipline ? [discipline] : currentDisciplineTags;
    const categoryTags = category ? [category] : currentCategoryTags;
    fetcher.submit(
      {
        intent: "override-taxonomy",
        shopifyProductId,
        disciplineTags: JSON.stringify(disciplineTags),
        categoryTags: JSON.stringify(categoryTags),
      },
      { method: "post" },
    );
    setToast({ message: `Classification saved for ${title}` });
    onSaved?.();
  }, [discipline, category, currentDisciplineTags, currentCategoryTags, fetcher, shopifyProductId, title, onSaved]);

  return (
    <Card>
      {toast && (
        <Toast content={toast.message} error={toast.error} onDismiss={() => setToast(null)} />
      )}
      <BlockStack gap="300">
        <Text variant="headingMd" as="h2">Edit classification — {title}</Text>
        <Select
          label="Discipline"
          options={disciplineOptions}
          value={discipline}
          onChange={setDiscipline}
        />
        <Select
          label="Category"
          options={categoryOptions}
          value={category}
          onChange={setCategory}
        />
        <InlineStack gap="200">
          <Button variant="primary" onClick={handleSave} loading={fetcher.state !== "idle"}>
            Save override
          </Button>
        </InlineStack>
      </BlockStack>
    </Card>
  );
}

type RelationshipEditorProps = {
  shop: string;
  availableProducts: { id: string; title: string }[];
  onSaved?: () => void;
};

/**
 * Merchant-authored relationship creation panel.
 */
export function RelationshipEditorPanel({
  availableProducts,
  onSaved,
}: RelationshipEditorProps) {
  const fetcher = useFetcher();
  const [toast, setToast] = useState<{ message: string; error?: boolean } | null>(null);
  const [sourceId, setSourceId] = useState("");
  const [targetId, setTargetId] = useState("");
  const [relType, setRelType] = useState<RelationshipType>(RelationshipType.COMPLEMENTS);

  const productOptions = [
    { label: "— select product —", value: "" },
    ...availableProducts.map((p) => ({ label: p.title, value: p.id })),
  ];

  const typeOptions = Object.values(RelationshipType).map((t) => ({
    label: t.charAt(0) + t.slice(1).toLowerCase().replace(/_/g, " "),
    value: t,
  }));

  const handleCreate = useCallback(() => {
    if (!sourceId || !targetId) {
      setToast({ message: "Select both source and target products", error: true });
      return;
    }
    if (sourceId === targetId) {
      setToast({ message: "Source and target must be different products", error: true });
      return;
    }
    fetcher.submit(
      {
        intent: "create-relationship",
        sourceProductId: sourceId,
        targetProductId: targetId,
        relationshipType: relType,
      },
      { method: "post" },
    );
    setToast({ message: "Relationship created" });
    setSourceId("");
    setTargetId("");
    onSaved?.();
  }, [sourceId, targetId, relType, fetcher, onSaved]);

  return (
    <Card>
      {toast && (
        <Toast content={toast.message} error={toast.error} onDismiss={() => setToast(null)} />
      )}
      <BlockStack gap="300">
        <Text variant="headingMd" as="h2">Create relationship</Text>
        <Select
          label="Source product"
          options={productOptions}
          value={sourceId}
          onChange={setSourceId}
        />
        <Select
          label="Target product"
          options={productOptions}
          value={targetId}
          onChange={setTargetId}
        />
        <Select
          label="Relationship type"
          options={typeOptions}
          value={relType}
          onChange={(v) => setRelType(v as RelationshipType)}
        />
        <InlineStack gap="200">
          <Button variant="primary" onClick={handleCreate} loading={fetcher.state !== "idle"}>
            Create
          </Button>
        </InlineStack>
        <Text as="p" tone="subdued" variant="bodySm">
          Merchant-authored relationships are immediately set to ACTIVE with strength 1.0.
        </Text>
      </BlockStack>
    </Card>
  );
}
