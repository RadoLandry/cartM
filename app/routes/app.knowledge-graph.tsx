import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { useLoaderData, useSubmit, Form } from "react-router";
import { authenticate } from "../shopify.server";
import {
  getLowConfidenceProducts,
  getProductsWithTaxonomy,
  applyMerchantTaxonomyOverride,
} from "../lib/db/queries";
import { CONFIDENCE_THRESHOLD } from "../lib/knowledge-graph/llm-classifier";
import { DISCIPLINES, CATEGORIES } from "../lib/knowledge-graph/taxonomy";

import {
  Page,
  Layout,
  Card,
  IndexTable,
  Text,
  Badge,
  InlineStack,
  BlockStack,
  Select,
  Button,
  Banner,
  Tabs,
  EmptyState,
} from "@shopify/polaris";
import { useState, useCallback } from "react";

type TaxonomyProduct = {
  id: string;
  shopifyProductId: string;
  title: string;
  handle: string;
  disciplineTags: string[];
  categoryTags: string[];
  classificationConfidence: number | null;
  isManuallyClassified: boolean;
};

type LoaderData = {
  lowConfidenceProducts: TaxonomyProduct[];
  allProducts: TaxonomyProduct[];
  lowConfidenceCount: number;
};

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  const [lowConfidenceProducts, allProducts] = await Promise.all([
    getLowConfidenceProducts(session.shop, CONFIDENCE_THRESHOLD, 50),
    getProductsWithTaxonomy(session.shop, 50),
  ]);

  return {
    lowConfidenceProducts,
    allProducts,
    lowConfidenceCount: lowConfidenceProducts.length,
  } satisfies LoaderData;
};

// ---------------------------------------------------------------------------
// Action
// ---------------------------------------------------------------------------

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "override-taxonomy") {
    const shopifyProductId = formData.get("shopifyProductId");
    const disciplineTagsRaw = formData.get("disciplineTags");
    const categoryTagsRaw = formData.get("categoryTags");

    if (
      typeof shopifyProductId !== "string" ||
      typeof disciplineTagsRaw !== "string" ||
      typeof categoryTagsRaw !== "string"
    ) {
      return { ok: false, error: "Invalid form data" };
    }

    // Validate against canonical taxonomy
    const disciplineTags = disciplineTagsRaw
      .split(",")
      .map((d) => d.trim())
      .filter((d) => DISCIPLINES.includes(d as (typeof DISCIPLINES)[number]));
    const categoryTags = categoryTagsRaw
      .split(",")
      .map((c) => c.trim())
      .filter((c) => CATEGORIES.includes(c as (typeof CATEGORIES)[number]));

    await applyMerchantTaxonomyOverride(
      shopifyProductId,
      disciplineTags,
      categoryTags,
    );

    return { ok: true };
  }

  return { ok: false, error: "Unknown intent" };
};

// ---------------------------------------------------------------------------
// Component helpers
// ---------------------------------------------------------------------------

function confidenceBadge(confidence: number | null, isManual: boolean) {
  if (isManual) return <Badge tone="success">Manual</Badge>;
  if (confidence === null) return <Badge tone="attention">Unclassified</Badge>;
  if (confidence >= CONFIDENCE_THRESHOLD) return <Badge tone="success">{`${Math.round(confidence * 100)}%`}</Badge>;
  return <Badge tone="warning">{`${Math.round(confidence * 100)}%`}</Badge>;
}

function OverrideForm({
  product,
  onDone,
}: {
  product: TaxonomyProduct;
  onDone: () => void;
}) {
  const submit = useSubmit();
  const [selectedDisciplines, setSelectedDisciplines] = useState<string[]>(
    product.disciplineTags,
  );
  const [selectedCategories, setSelectedCategories] = useState<string[]>(
    product.categoryTags,
  );

  const handleSubmit = useCallback(() => {
    submit(
      {
        intent: "override-taxonomy",
        shopifyProductId: product.shopifyProductId,
        disciplineTags: selectedDisciplines.join(","),
        categoryTags: selectedCategories.join(","),
      },
      { method: "post" },
    );
    onDone();
  }, [submit, product.shopifyProductId, selectedDisciplines, selectedCategories, onDone]);

  const disciplineOptions = [
    { label: "— none —", value: "" },
    ...DISCIPLINES.map((d) => ({ label: d, value: d })),
  ];
  const categoryOptions = [
    { label: "— none —", value: "" },
    ...CATEGORIES.map((c) => ({ label: c, value: c })),
  ];

  return (
    <BlockStack gap="200">
      <Text variant="headingSm" as="h3">
        Override: {product.title}
      </Text>
      <Select
        label="Discipline"
        options={disciplineOptions}
        value={selectedDisciplines[0] ?? ""}
        onChange={(v) => setSelectedDisciplines(v ? [v] : [])}
      />
      <Select
        label="Category"
        options={categoryOptions}
        value={selectedCategories[0] ?? ""}
        onChange={(v) => setSelectedCategories(v ? [v] : [])}
      />
      <InlineStack gap="200">
        <Button variant="primary" onClick={handleSubmit}>
          Save override
        </Button>
        <Button onClick={onDone}>Cancel</Button>
      </InlineStack>
    </BlockStack>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function KnowledgeGraphPage() {
  const { lowConfidenceProducts, allProducts, lowConfidenceCount } =
    useLoaderData<LoaderData>();

  const [selectedTab, setSelectedTab] = useState(0);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);

  const tabs = [
    {
      id: "needs-review",
      content: `Needs Review (${lowConfidenceCount})`,
    },
    {
      id: "all-products",
      content: "All Products",
    },
  ];

  const activeProducts =
    selectedTab === 0 ? lowConfidenceProducts : allProducts;

  const rowMarkup = activeProducts.map(
    (
      { id, shopifyProductId, title, disciplineTags, categoryTags, classificationConfidence, isManuallyClassified },
      index,
    ) => (
      <IndexTable.Row id={id} key={id} position={index}>
        <IndexTable.Cell>
          <Text variant="bodyMd" fontWeight="bold" as="span">
            {title}
          </Text>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <InlineStack gap="100">
            {disciplineTags.length > 0
              ? disciplineTags.map((d) => (
                  <Badge key={d} tone="info">
                    {d}
                  </Badge>
                ))
              : <Text tone="subdued" as="span">—</Text>}
          </InlineStack>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <InlineStack gap="100">
            {categoryTags.length > 0
              ? categoryTags.map((c) => (
                  <Badge key={c}>{c}</Badge>
                ))
              : <Text tone="subdued" as="span">—</Text>}
          </InlineStack>
        </IndexTable.Cell>
        <IndexTable.Cell>
          {confidenceBadge(classificationConfidence, isManuallyClassified)}
        </IndexTable.Cell>
        <IndexTable.Cell>
          {editingProductId === id ? (
            <OverrideForm
              product={{ id, shopifyProductId, title, handle: "", disciplineTags, categoryTags, classificationConfidence, isManuallyClassified }}
              onDone={() => setEditingProductId(null)}
            />
          ) : (
            <Button size="slim" onClick={() => setEditingProductId(id)}>
              Override
            </Button>
          )}
        </IndexTable.Cell>
      </IndexTable.Row>
    ),
  );

  return (
    <Page
      title="Knowledge Graph — Taxonomy"
      subtitle="Review and override AI-generated product discipline and category classifications."
    >
      <Layout>
        {lowConfidenceCount > 0 && (
          <Layout.Section>
            <Banner
              title={`${lowConfidenceCount} product${lowConfidenceCount > 1 ? "s" : ""} need review`}
              tone="warning"
            >
              <p>
                These products were classified with confidence below{" "}
                {Math.round(CONFIDENCE_THRESHOLD * 100)}%. Review and override
                them to improve recommendation accuracy.
              </p>
            </Banner>
          </Layout.Section>
        )}

        <Layout.Section>
          <Card>
            <Tabs
              tabs={tabs}
              selected={selectedTab}
              onSelect={setSelectedTab}
            >
              {activeProducts.length === 0 ? (
                <EmptyState
                  heading={
                    selectedTab === 0
                      ? "All products are well-classified"
                      : "No products found"
                  }
                  image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                >
                  <p>
                    {selectedTab === 0
                      ? "Great job! No products require manual review."
                      : "Sync your catalog from the Dashboard to populate products."}
                  </p>
                </EmptyState>
              ) : (
                <IndexTable
                  resourceName={{ singular: "product", plural: "products" }}
                  itemCount={activeProducts.length}
                  headings={[
                    { title: "Product" },
                    { title: "Disciplines" },
                    { title: "Categories" },
                    { title: "Confidence" },
                    { title: "Actions" },
                  ]}
                  selectable={false}
                >
                  {rowMarkup}
                </IndexTable>
              )}
            </Tabs>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
