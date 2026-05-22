import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { useLoaderData, useSubmit, Form, useFetcher } from "react-router";
import { authenticate } from "../shopify.server";
import {
  getLowConfidenceProducts,
  getProductsWithTaxonomy,
  applyMerchantTaxonomyOverride,
  getSizeChartsForShop,
  getCrossSizeMappingsForShop,
  getDistinctSizeCategoryTagsForShop,
  saveSizeChartOverride,
  resetSizeChartOverride,
  createCrossSizeMapping,
  deleteCrossSizeMapping,
  type SizeBreakpointRow,
} from "../lib/db/queries";
import { CONFIDENCE_THRESHOLD } from "../lib/knowledge-graph/llm-classifier";
import { DISCIPLINES, CATEGORIES } from "../lib/knowledge-graph/taxonomy";
import { z } from "zod";

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
  DataTable,
  Modal,
  TextField,
  Toast,
  Frame,
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

type SizeChartRow = {
  id: string;
  categoryTag: string;
  sizeSystem: string;
  source: string;
  breakpointCount: number;
  hasOverride: boolean;
};

type CrossSizeMappingRow = {
  id: string;
  sourceCategoryTag: string;
  sourceSize: string;
  targetCategoryTag: string;
  targetSize: string;
  severityOnMismatch: string;
  source: string;
};

type LoaderData = {
  lowConfidenceProducts: TaxonomyProduct[];
  allProducts: TaxonomyProduct[];
  lowConfidenceCount: number;
  sizeCharts: SizeChartRow[];
  crossSizeMappings: CrossSizeMappingRow[];
  categoryTags: string[];
};

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  const [lowConfidenceProducts, allProducts, rawSizeCharts, rawCrossMappings, categoryTags] = await Promise.all([
    getLowConfidenceProducts(session.shop, CONFIDENCE_THRESHOLD, 50),
    getProductsWithTaxonomy(session.shop, 50),
    getSizeChartsForShop(session.shop),
    getCrossSizeMappingsForShop(session.shop),
    getDistinctSizeCategoryTagsForShop(session.shop),
  ]);

  const sizeCharts: SizeChartRow[] = rawSizeCharts.map((c) => ({
    id: c.id,
    categoryTag: c.categoryTag,
    sizeSystem: c.sizeSystem,
    source: c.source,
    breakpointCount: Array.isArray(c.breakpoints) ? (c.breakpoints as unknown[]).length : 0,
    hasOverride: c.overrideBreakpoints != null,
  }));

  const crossSizeMappings: CrossSizeMappingRow[] = rawCrossMappings.map((m) => ({
    id: m.id,
    sourceCategoryTag: m.sourceCategoryTag,
    sourceSize: m.sourceSize,
    targetCategoryTag: m.targetCategoryTag,
    targetSize: m.targetSize,
    severityOnMismatch: m.severityOnMismatch,
    source: m.source,
  }));

  return {
    lowConfidenceProducts,
    allProducts,
    lowConfidenceCount: lowConfidenceProducts.length,
    sizeCharts,
    crossSizeMappings,
    categoryTags,
  } satisfies LoaderData;
};

// ---------------------------------------------------------------------------
// Action
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Zod schemas for size chart action inputs
// ---------------------------------------------------------------------------

const SizeBreakpointSchema = z.object({
  label: z.string().min(1),
  attributeType: z.string().min(1),
  min: z.number().nullable(),
  max: z.number().nullable(),
  note: z.string().optional(),
});

const SaveOverrideSchema = z.object({
  sizeChartId: z.string().min(1),
  overrideBreakpoints: z.array(SizeBreakpointSchema).min(1),
});

const ResetOverrideSchema = z.object({
  sizeChartId: z.string().min(1),
});

const CreateMappingSchema = z.object({
  sourceCategoryTag: z.string().min(1),
  sourceSize: z.string().min(1),
  targetCategoryTag: z.string().min(1),
  targetSize: z.string().min(1),
  severityOnMismatch: z.enum(["WARNING", "ERROR"]).default("WARNING"),
}).refine((d) => d.sourceCategoryTag !== d.targetCategoryTag, {
  message: "sourceCategoryTag and targetCategoryTag must differ",
});

const DeleteMappingSchema = z.object({
  mappingId: z.string().min(1),
});

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

  // T011 — save-size-chart-override
  if (intent === "save-size-chart-override") {
    const raw = {
      sizeChartId: formData.get("sizeChartId"),
      overrideBreakpoints: JSON.parse(String(formData.get("overrideBreakpoints") ?? "[]")),
    };
    const parsed = SaveOverrideSchema.safeParse(raw);
    if (!parsed.success) return { ok: false, error: parsed.error.message };
    await saveSizeChartOverride(parsed.data.sizeChartId, parsed.data.overrideBreakpoints as SizeBreakpointRow[]);
    return { ok: true };
  }

  // T012 — reset-size-chart-override
  if (intent === "reset-size-chart-override") {
    const raw = { sizeChartId: formData.get("sizeChartId") };
    const parsed = ResetOverrideSchema.safeParse(raw);
    if (!parsed.success) return { ok: false, error: parsed.error.message };
    await resetSizeChartOverride(parsed.data.sizeChartId);
    return { ok: true };
  }

  // T013 — create-cross-size-mapping
  if (intent === "create-cross-size-mapping") {
    const raw = {
      sourceCategoryTag: formData.get("sourceCategoryTag"),
      sourceSize: formData.get("sourceSize"),
      targetCategoryTag: formData.get("targetCategoryTag"),
      targetSize: formData.get("targetSize"),
      severityOnMismatch: formData.get("severityOnMismatch") ?? "WARNING",
    };
    const parsed = CreateMappingSchema.safeParse(raw);
    if (!parsed.success) return { ok: false, error: parsed.error.message };
    try {
      await createCrossSizeMapping({ shop: session.shop, ...parsed.data });
    } catch (err: unknown) {
      if (typeof err === "object" && err !== null && "code" in err && (err as { code: string }).code === "P2002") {
        return { ok: false, error: "duplicate" };
      }
      throw err;
    }
    return { ok: true };
  }

  // T014 — delete-cross-size-mapping
  if (intent === "delete-cross-size-mapping") {
    const raw = { mappingId: formData.get("mappingId") };
    const parsed = DeleteMappingSchema.safeParse(raw);
    if (!parsed.success) return { ok: false, error: parsed.error.message };
    await deleteCrossSizeMapping(parsed.data.mappingId);
    return { ok: true };
  }

  return { ok: false, error: "Unknown intent" };
};

// ---------------------------------------------------------------------------
// Size Charts Tab component (T015)
// ---------------------------------------------------------------------------

function SizeChartsTab({
  sizeCharts,
  crossSizeMappings,
  categoryTags,
}: {
  sizeCharts: SizeChartRow[];
  crossSizeMappings: CrossSizeMappingRow[];
  categoryTags: string[];
}) {
  const fetcher = useFetcher();
  const [toast, setToast] = useState<{ message: string; error?: boolean } | null>(null);
  const [addModalOpen, setAddModalOpen] = useState(false);

  // New mapping form state
  const [newSourceCat, setNewSourceCat] = useState("");
  const [newSourceSize, setNewSourceSize] = useState("");
  const [newTargetCat, setNewTargetCat] = useState("");
  const [newTargetSize, setNewTargetSize] = useState("");
  const [newSeverity, setNewSeverity] = useState<"WARNING" | "ERROR">("WARNING");

  const submitAction = useCallback(
    (data: Record<string, string>) => {
      fetcher.submit(data, { method: "post" });
    },
    [fetcher],
  );

  const handleReset = useCallback(
    (sizeChartId: string) => {
      submitAction({ intent: "reset-size-chart-override", sizeChartId });
      setToast({ message: "Override reset" });
    },
    [submitAction],
  );

  const handleDeleteMapping = useCallback(
    (mappingId: string) => {
      submitAction({ intent: "delete-cross-size-mapping", mappingId });
      setToast({ message: "Mapping deleted" });
    },
    [submitAction],
  );

  const handleAddMapping = useCallback(() => {
    if (!newSourceCat || !newSourceSize || !newTargetCat || !newTargetSize) return;
    fetcher.submit(
      {
        intent: "create-cross-size-mapping",
        sourceCategoryTag: newSourceCat,
        sourceSize: newSourceSize,
        targetCategoryTag: newTargetCat,
        targetSize: newTargetSize,
        severityOnMismatch: newSeverity,
      },
      { method: "post" },
    );
    setAddModalOpen(false);
    setToast({ message: "Mapping created" });
  }, [fetcher, newSourceCat, newSourceSize, newTargetCat, newTargetSize, newSeverity]);

  const catOptions = [
    { label: "— select —", value: "" },
    ...categoryTags.map((t) => ({ label: t, value: t })),
  ];
  const severityOptions = [
    { label: "WARNING", value: "WARNING" },
    { label: "ERROR", value: "ERROR" },
  ];

  const sizeChartRows = sizeCharts.map((c) => [
    c.categoryTag,
    c.sizeSystem,
    <Badge key={c.id} tone={c.source === "MERCHANT" ? "success" : "info"}>{c.source}</Badge>,
    String(c.breakpointCount),
    c.hasOverride ? <Badge key={`ov-${c.id}`} tone="warning">Override active</Badge> : "—",
    <InlineStack key={`act-${c.id}`} gap="200">
      {c.hasOverride && (
        <Button size="slim" onClick={() => handleReset(c.id)}>
          Reset
        </Button>
      )}
    </InlineStack>,
  ]);

  const mappingRows = crossSizeMappings.map((m) => [
    m.sourceCategoryTag,
    m.sourceSize,
    m.targetCategoryTag,
    m.targetSize,
    <Badge key={m.id} tone={m.severityOnMismatch === "ERROR" ? "critical" : "warning"}>
      {m.severityOnMismatch}
    </Badge>,
    <Badge key={`src-${m.id}`} tone={m.source === "MERCHANT" ? "success" : "info"}>{m.source}</Badge>,
    <Button key={`del-${m.id}`} size="slim" tone="critical" onClick={() => handleDeleteMapping(m.id)}>
      Delete
    </Button>,
  ]);

  return (
    <BlockStack gap="400">
      {toast && (
        <Toast
          content={toast.message}
          error={toast.error}
          onDismiss={() => setToast(null)}
        />
      )}

      <Card>
        <BlockStack gap="300">
          <Text variant="headingMd" as="h2">Size Charts</Text>
          {sizeCharts.length === 0 ? (
            <EmptyState
              heading="No size charts yet"
              image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
            >
              <p>Run the seed script or sync products to generate size charts.</p>
            </EmptyState>
          ) : (
            <DataTable
              columnContentTypes={["text", "text", "text", "numeric", "text", "text"]}
              headings={["Category", "Size System", "Source", "Breakpoints", "Override", "Actions"]}
              rows={sizeChartRows}
            />
          )}
        </BlockStack>
      </Card>

      <Card>
        <BlockStack gap="300">
          <InlineStack align="space-between">
            <Text variant="headingMd" as="h2">Cross-Size Mappings</Text>
            <Button variant="primary" onClick={() => setAddModalOpen(true)}>
              Add mapping
            </Button>
          </InlineStack>
          {crossSizeMappings.length === 0 ? (
            <EmptyState
              heading="No cross-size mappings yet"
              image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
            >
              <p>Mappings define when cart items from different categories are considered a size mismatch.</p>
            </EmptyState>
          ) : (
            <DataTable
              columnContentTypes={["text", "text", "text", "text", "text", "text", "text"]}
              headings={["Source Category", "Source Size", "Target Category", "Target Size", "Severity", "Origin", "Actions"]}
              rows={mappingRows}
            />
          )}
        </BlockStack>
      </Card>

      <Modal
        open={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        title="Add Cross-Size Mapping"
        primaryAction={{ content: "Create", onAction: handleAddMapping }}
        secondaryActions={[{ content: "Cancel", onAction: () => setAddModalOpen(false) }]}
      >
        <Modal.Section>
          <BlockStack gap="300">
            <Select
              label="Source Category"
              options={catOptions}
              value={newSourceCat}
              onChange={setNewSourceCat}
            />
            <TextField
              label="Source Size"
              value={newSourceSize}
              onChange={setNewSourceSize}
              autoComplete="off"
            />
            <Select
              label="Target Category"
              options={catOptions}
              value={newTargetCat}
              onChange={setNewTargetCat}
            />
            <TextField
              label="Target Size"
              value={newTargetSize}
              onChange={setNewTargetSize}
              autoComplete="off"
            />
            <Select
              label="Severity on mismatch"
              options={severityOptions}
              value={newSeverity}
              onChange={(v) => setNewSeverity(v as "WARNING" | "ERROR")}
            />
          </BlockStack>
        </Modal.Section>
      </Modal>
    </BlockStack>
  );
}

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
  const { lowConfidenceProducts, allProducts, lowConfidenceCount, sizeCharts, crossSizeMappings, categoryTags } =
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
    {
      id: "size-charts",
      content: `Size Charts (${sizeCharts.length})`,
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
    <Frame>
    <Page
      title="Knowledge Graph — Taxonomy"
      subtitle="Review and override AI-generated product discipline and category classifications."
    >
      <Layout>
        {lowConfidenceCount > 0 && selectedTab < 2 && (
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
              {selectedTab === 2 ? (
                <SizeChartsTab
                  sizeCharts={sizeCharts}
                  crossSizeMappings={crossSizeMappings}
                  categoryTags={categoryTags}
                />
              ) : activeProducts.length === 0 ? (
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
    </Frame>
  );
}
