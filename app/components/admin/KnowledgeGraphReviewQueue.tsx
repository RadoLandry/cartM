import {
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

type ReviewQueueItem = {
  id: string;
  shopifyProductId: string;
  title: string;
  handle: string;
  disciplineTags: string[];
  categoryTags: string[];
  classificationConfidence: number | null;
  isManuallyClassified: boolean;
};

type Props = {
  items: ReviewQueueItem[];
  availableDisciplines: string[];
  availableCategories: string[];
};

export function KnowledgeGraphReviewQueue({
  items,
  availableDisciplines,
  availableCategories,
}: Props) {
  const fetcher = useFetcher();
  const [toast, setToast] = useState<{ message: string; error?: boolean } | null>(null);
  const [search, setSearch] = useState("");
  const [disciplineFilter, setDisciplineFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");

  const submitAction = useCallback(
    (data: Record<string, string>) => {
      fetcher.submit(data, { method: "post" });
    },
    [fetcher],
  );

  const handleMarkReviewed = useCallback(
    (item: ReviewQueueItem) => {
      submitAction({
        intent: "mark-reviewed",
        shopifyProductId: item.shopifyProductId,
        disciplineTags: JSON.stringify(item.disciplineTags),
        categoryTags: JSON.stringify(item.categoryTags),
      });
      setToast({ message: `${item.title} marked as reviewed` });
    },
    [submitAction],
  );

  const handleReflag = useCallback(
    (item: ReviewQueueItem) => {
      submitAction({
        intent: "reflag-for-review",
        shopifyProductId: item.shopifyProductId,
      });
      setToast({ message: `${item.title} reflagged for re-review` });
    },
    [submitAction],
  );

  const searchLower = search.toLowerCase();
  const filtered = items.filter((item) => {
    if (searchLower && !`${item.title} ${item.handle}`.toLowerCase().includes(searchLower)) {
      return false;
    }
    if (disciplineFilter && !item.disciplineTags.includes(disciplineFilter)) {
      return false;
    }
    if (categoryFilter && !item.categoryTags.includes(categoryFilter)) {
      return false;
    }
    return true;
  });

  const disciplineOptions = [
    { label: "All disciplines", value: "" },
    ...availableDisciplines.map((d) => ({ label: d, value: d })),
  ];
  const categoryOptions = [
    { label: "All categories", value: "" },
    ...availableCategories.map((c) => ({ label: c, value: c })),
  ];

  const rows = filtered.map((item) => [
    item.title,
    item.disciplineTags.join(", ") || "—",
    item.categoryTags.join(", ") || "—",
    item.classificationConfidence != null
      ? `${Math.round(item.classificationConfidence * 100)}%`
      : "—",
    <InlineStack key={item.id} gap="200">
      <Button
        size="slim"
        variant="primary"
        onClick={() => handleMarkReviewed(item)}
      >
        Mark reviewed
      </Button>
      {item.isManuallyClassified && (
        <Button
          size="slim"
          onClick={() => handleReflag(item)}
        >
          Reflag
        </Button>
      )}
    </InlineStack>,
  ]);

  return (
    <Card>
      {toast && (
        <Toast
          content={toast.message}
          error={toast.error}
          onDismiss={() => setToast(null)}
        />
      )}
      <BlockStack gap="400">
        <Text variant="headingMd" as="h2">
          Review queue ({filtered.length} item{filtered.length !== 1 ? "s" : ""})
        </Text>

        <InlineStack gap="300" wrap>
          <TextField
            label="Search"
            value={search}
            onChange={setSearch}
            placeholder="Product title or handle"
            autoComplete="off"
            clearButton
            onClearButtonClick={() => setSearch("")}
          />
          <Select
            label="Discipline"
            options={disciplineOptions}
            value={disciplineFilter}
            onChange={setDisciplineFilter}
          />
          <Select
            label="Category"
            options={categoryOptions}
            value={categoryFilter}
            onChange={setCategoryFilter}
          />
        </InlineStack>

        {filtered.length === 0 ? (
          <EmptyState
            heading="No items in the review queue"
            image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
          >
            <p>All products meet the confidence threshold, or no products match the active filters.</p>
          </EmptyState>
        ) : (
          <DataTable
            columnContentTypes={["text", "text", "text", "numeric", "text"]}
            headings={["Product", "Disciplines", "Categories", "Confidence", "Actions"]}
            rows={rows}
          />
        )}
      </BlockStack>
    </Card>
  );
}
