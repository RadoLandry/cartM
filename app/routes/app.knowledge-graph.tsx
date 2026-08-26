import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import {
  useLoaderData,
  useSubmit,
  Form,
  useFetcher,
  useRouteError,
  isRouteErrorResponse,
} from "react-router";
import { authenticate } from "../shopify.server";
import {
  getLowConfidenceProducts,
  getProductsWithTaxonomy,
  applyMerchantTaxonomyOverride,
  listVisualProfilesForReview,
  listColorCompatibilityRules,
  saveProductVisualOverride,
  resetProductVisualOverride,
  createColorCompatibilityRule,
  deleteColorCompatibilityRule,
  getSizeChartsForShop,
  getCrossSizeMappingsForShop,
  getDistinctSizeCategoryTagsForShop,
  saveSizeChartOverride,
  resetSizeChartOverride,
  createCrossSizeMapping,
  deleteCrossSizeMapping,
  getRelationshipCandidatesForAdmin,
  getMerchantActiveRelationships,
  approveRelationship,
  rejectRelationship,
  disableRelationship,
  upsertMerchantRelationship,
  type SizeBreakpointRow,
  type RelationshipAdminRow,
} from "../lib/db/queries";
import { CONFIDENCE_THRESHOLD } from "../lib/knowledge-graph/llm-classifier";
import { DISCIPLINES, CATEGORIES } from "../lib/knowledge-graph/taxonomy";
import {
  normalizeColorToken,
  resolveEffectiveVisualProfile,
  type CollectionSummary,
  type ColorCompatibilityRuleRow,
  type VisualAdminRow,
} from "../lib/knowledge-graph/colorways";
import {
  canonicalizePair,
  getDirectionality,
} from "../lib/knowledge-graph/relationships";
import { z } from "zod";
import { ColorCompatibility, RelationshipType } from "@prisma/client";

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
import { KnowledgeGraphEditorShell } from "../components/admin/KnowledgeGraphEditorShell";
import {
  createKnowledgeGraphEditorSnapshot,
  createKnowledgeGraphRouteScaffold,
  KNOWLEDGE_GRAPH_EDITOR_ROUTE_INTENTS,
} from "../lib/knowledge-graph/editor";

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
  visualProfiles: VisualAdminRow[];
  compatibilityRules: ColorCompatibilityRuleRow[];
  sizeCharts: SizeChartRow[];
  crossSizeMappings: CrossSizeMappingRow[];
  categoryTags: string[];
  relationshipCandidates: RelationshipAdminRow[];
  activeRelationships: RelationshipAdminRow[];
};

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  const [lowConfidenceProducts, allProducts, rawVisualProfiles, rawCompatibilityRules, rawSizeCharts, rawCrossMappings, categoryTags, relationshipCandidates, activeRelationships] = await Promise.all([
    getLowConfidenceProducts(session.shop, CONFIDENCE_THRESHOLD, 50),
    getProductsWithTaxonomy(session.shop, 50),
    listVisualProfilesForReview(session.shop, 50),
    listColorCompatibilityRules(session.shop),
    getSizeChartsForShop(session.shop),
    getCrossSizeMappingsForShop(session.shop),
    getDistinctSizeCategoryTagsForShop(session.shop),
    getRelationshipCandidatesForAdmin(session.shop),
    getMerchantActiveRelationships(session.shop),
  ]);

  const visualProfiles: VisualAdminRow[] = rawVisualProfiles.map((profile) => {
    const effective = resolveEffectiveVisualProfile({
      productId: profile.productId,
      dominantColors: (profile.dominantColors as string[]) ?? [],
      detectedColorwayKeys: profile.detectedColorwayKeys,
      overrideColorwayKeys: profile.overrideColorwayKeys,
      detectedCollections: ((profile.detectedCollections as unknown as CollectionSummary[]) ?? []),
      overrideCollections: ((profile.overrideCollections as unknown as CollectionSummary[] | null) ?? null),
      visualConfidence: profile.visualConfidence,
      reviewStatus: profile.reviewStatus,
      source: profile.source,
      extractionSummary: {
        tokenMatches: [],
        paletteSource: ((profile.extractionSummary as { paletteSource?: "image" | "fallback" | "none" } | null)?.paletteSource) ?? "none",
        notes: ((profile.extractionSummary as { notes?: string[] } | null)?.notes) ?? [],
      },
    });

    return {
      id: profile.id,
      productId: profile.productId,
      shopifyProductId: profile.product.shopifyProductId,
      title: profile.product.title,
      handle: profile.product.handle,
      dominantColors: (profile.dominantColors as string[]) ?? [],
      detectedColorwayKeys: profile.detectedColorwayKeys,
      effectiveColorwayKeys: effective.colorwayKeys,
      detectedCollections: (profile.detectedCollections as unknown as CollectionSummary[]) ?? [],
      effectiveCollections: effective.collections,
      visualConfidence: profile.visualConfidence,
      reviewStatus: profile.reviewStatus,
      source: profile.source,
    };
  });

  const compatibilityRules: ColorCompatibilityRuleRow[] = rawCompatibilityRules.map((rule) => ({
    id: rule.id,
    sourceColorwayKey: rule.sourceColorwayKey,
    targetColorwayKey: rule.targetColorwayKey,
    compatibility: rule.compatibility,
    source: rule.source,
    rationale: rule.rationale,
  }));

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
    visualProfiles,
    compatibilityRules,
    sizeCharts,
    crossSizeMappings,
    categoryTags,
    relationshipCandidates,
    activeRelationships,
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

const SaveVisualOverrideSchema = z.object({
  productId: z.string().min(1),
  overrideColorways: z.string().default(""),
  overrideCollections: z.string().default(""),
});

const ResetVisualOverrideSchema = z.object({
  productId: z.string().min(1),
});

const SaveCompatibilityRuleSchema = z.object({
  sourceColorwayKey: z.string().min(1),
  targetColorwayKey: z.string().min(1),
  compatibility: z.nativeEnum(ColorCompatibility),
  rationale: z.string().optional(),
});

const DeleteCompatibilityRuleSchema = z.object({
  ruleId: z.string().min(1),
});

function parseCollectionOverrides(rawValue: string): CollectionSummary[] | null {
  const values = rawValue
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  if (values.length === 0) {
    return null;
  }

  return values.map((value) => ({
    shopifyCollectionId: `manual:${normalizeColorToken(value)}`,
    title: value,
    handle: normalizeColorToken(value),
  }));
}

// ---------------------------------------------------------------------------
// Action
// ---------------------------------------------------------------------------

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (
    typeof intent !== "string" ||
    !KNOWLEDGE_GRAPH_EDITOR_ROUTE_INTENTS.includes(
      intent as (typeof KNOWLEDGE_GRAPH_EDITOR_ROUTE_INTENTS)[number],
    )
  ) {
    return { ok: false, error: "Unknown intent" };
  }

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

  if (intent === "save-visual-override") {
    const raw = {
      productId: formData.get("productId"),
      overrideColorways: String(formData.get("overrideColorways") ?? ""),
      overrideCollections: String(formData.get("overrideCollections") ?? ""),
    };
    const parsed = SaveVisualOverrideSchema.safeParse(raw);
    if (!parsed.success) return { ok: false, error: parsed.error.message };

    const overrideColorwayKeys = parsed.data.overrideColorways
      .split(",")
      .map((value) => normalizeColorToken(value))
      .filter(Boolean);
    const overrideCollections = parseCollectionOverrides(parsed.data.overrideCollections);

    await saveProductVisualOverride(parsed.data.productId, overrideColorwayKeys, overrideCollections);
    return { ok: true };
  }

  if (intent === "reset-visual-override") {
    const raw = { productId: formData.get("productId") };
    const parsed = ResetVisualOverrideSchema.safeParse(raw);
    if (!parsed.success) return { ok: false, error: parsed.error.message };
    await resetProductVisualOverride(parsed.data.productId);
    return { ok: true };
  }

  if (intent === "save-compatibility-rule") {
    const raw = {
      sourceColorwayKey: normalizeColorToken(String(formData.get("sourceColorwayKey") ?? "")),
      targetColorwayKey: normalizeColorToken(String(formData.get("targetColorwayKey") ?? "")),
      compatibility: formData.get("compatibility"),
      rationale: String(formData.get("rationale") ?? ""),
    };
    const parsed = SaveCompatibilityRuleSchema.safeParse(raw);
    if (!parsed.success) return { ok: false, error: parsed.error.message };

    try {
      await createColorCompatibilityRule({
        shop: session.shop,
        sourceColorwayKey: parsed.data.sourceColorwayKey,
        targetColorwayKey: parsed.data.targetColorwayKey,
        compatibility: parsed.data.compatibility,
        rationale: parsed.data.rationale || null,
      });
    } catch (err: unknown) {
      if (typeof err === "object" && err !== null && "code" in err && (err as { code: string }).code === "P2002") {
        return { ok: false, error: "duplicate" };
      }
      throw err;
    }

    return { ok: true };
  }

  if (intent === "delete-compatibility-rule") {
    const raw = { ruleId: formData.get("ruleId") };
    const parsed = DeleteCompatibilityRuleSchema.safeParse(raw);
    if (!parsed.success) return { ok: false, error: parsed.error.message };
    await deleteColorCompatibilityRule(parsed.data.ruleId);
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

  // T017 — approve-relationship
  if (intent === "approve-relationship") {
    const relationshipId = formData.get("relationshipId");
    if (typeof relationshipId !== "string" || !relationshipId) {
      return { ok: false, error: "Missing relationshipId" };
    }
    await approveRelationship(session.shop, relationshipId);
    return { ok: true };
  }

  // T017 — reject-relationship
  if (intent === "reject-relationship") {
    const relationshipId = formData.get("relationshipId");
    if (typeof relationshipId !== "string" || !relationshipId) {
      return { ok: false, error: "Missing relationshipId" };
    }
    await rejectRelationship(session.shop, relationshipId);
    return { ok: true };
  }

  // T017 — disable-relationship
  if (intent === "disable-relationship") {
    const relationshipId = formData.get("relationshipId");
    if (typeof relationshipId !== "string" || !relationshipId) {
      return { ok: false, error: "Missing relationshipId" };
    }
    await disableRelationship(session.shop, relationshipId);
    return { ok: true };
  }

  // T017 — create-relationship (merchant-authored)
  if (intent === "create-relationship") {
    const sourceProductId = formData.get("sourceProductId");
    const targetProductId = formData.get("targetProductId");
    const relationshipType = formData.get("relationshipType");
    if (
      typeof sourceProductId !== "string" || !sourceProductId ||
      typeof targetProductId !== "string" || !targetProductId ||
      typeof relationshipType !== "string" || !relationshipType
    ) {
      return { ok: false, error: "Missing required fields" };
    }
    const type = relationshipType as RelationshipType;
    const { sourceProductId: canonSource, targetProductId: canonTarget } = canonicalizePair(
      sourceProductId,
      targetProductId,
      type,
    );
    await upsertMerchantRelationship({
      shop: session.shop,
      sourceProductId: canonSource,
      targetProductId: canonTarget,
      relationshipType: type,
      directionality: getDirectionality(type),
      strength: 1.0,
    });
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
// Relationships Tab component (T016)
// ---------------------------------------------------------------------------

function RelationshipsTab({
  candidates,
  activeRelationships,
}: {
  candidates: RelationshipAdminRow[];
  activeRelationships: RelationshipAdminRow[];
}) {
  const fetcher = useFetcher();
  const [toast, setToast] = useState<{ message: string; error?: boolean } | null>(null);

  const submitAction = useCallback(
    (data: Record<string, string>) => {
      fetcher.submit(data, { method: "post" });
    },
    [fetcher],
  );

  const candidateRows = candidates.map((r) => [
    r.sourceProductTitle,
    r.targetProductTitle,
    <Badge key={`type-${r.id}`} tone="info">{r.relationshipType}</Badge>,
    <Badge key={`dir-${r.id}`}>{r.directionality}</Badge>,
    `${Math.round(r.strength * 100)}%`,
    <InlineStack key={`act-${r.id}`} gap="200">
      <Button
        size="slim"
        variant="primary"
        onClick={() => {
          submitAction({ intent: "approve-relationship", relationshipId: r.id });
          setToast({ message: "Relationship approved" });
        }}
      >
        Approve
      </Button>
      <Button
        size="slim"
        tone="critical"
        onClick={() => {
          submitAction({ intent: "reject-relationship", relationshipId: r.id });
          setToast({ message: "Relationship rejected" });
        }}
      >
        Reject
      </Button>
    </InlineStack>,
  ]);

  const activeRows = activeRelationships.map((r) => [
    r.sourceProductTitle,
    r.targetProductTitle,
    <Badge key={`type-${r.id}`} tone="info">{r.relationshipType}</Badge>,
    <Badge key={`orig-${r.id}`} tone={r.origin === "MERCHANT" ? "success" : "info"}>{r.origin}</Badge>,
    `${Math.round(r.strength * 100)}%`,
    <Button
      key={`dis-${r.id}`}
      size="slim"
      tone="critical"
      onClick={() => {
        submitAction({ intent: "disable-relationship", relationshipId: r.id });
        setToast({ message: "Relationship disabled" });
      }}
    >
      Disable
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
          <Text variant="headingMd" as="h2">Candidate relationships ({candidates.length})</Text>
          {candidates.length === 0 ? (
            <EmptyState
              heading="No relationship candidates yet"
              image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
            >
              <p>Run a catalog sync to generate relationship candidates.</p>
            </EmptyState>
          ) : (
            <DataTable
              columnContentTypes={["text", "text", "text", "text", "numeric", "text"]}
              headings={["Source product", "Target product", "Type", "Directionality", "Strength", "Actions"]}
              rows={candidateRows}
            />
          )}
        </BlockStack>
      </Card>

      <Card>
        <BlockStack gap="300">
          <Text variant="headingMd" as="h2">Active relationships ({activeRelationships.length})</Text>
          {activeRelationships.length === 0 ? (
            <EmptyState
              heading="No active relationships"
              image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
            >
              <p>Approve candidates above or run a catalog sync to generate relationships.</p>
            </EmptyState>
          ) : (
            <DataTable
              columnContentTypes={["text", "text", "text", "text", "numeric", "text"]}
              headings={["Source product", "Target product", "Type", "Origin", "Strength", "Actions"]}
              rows={activeRows}
            />
          )}
        </BlockStack>
      </Card>
    </BlockStack>
  );
}

function renderBadgeList(values: string[]) {
  if (values.length === 0) {
    return <Text tone="subdued" as="span">—</Text>;
  }

  return (
    <InlineStack gap="100">
      {values.map((value) => (
        <Badge key={value}>{value}</Badge>
      ))}
    </InlineStack>
  );
}

function renderCollectionList(collections: CollectionSummary[]) {
  if (collections.length === 0) {
    return <Text tone="subdued" as="span">—</Text>;
  }

  return (
    <InlineStack gap="100">
      {collections.map((collection) => (
        <Badge key={collection.shopifyCollectionId} tone="info">
          {collection.title || collection.handle}
        </Badge>
      ))}
    </InlineStack>
  );
}

function ColorwaysTab({
  visualProfiles,
  compatibilityRules,
}: {
  visualProfiles: VisualAdminRow[];
  compatibilityRules: ColorCompatibilityRuleRow[];
}) {
  const fetcher = useFetcher();
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [overrideColorways, setOverrideColorways] = useState("");
  const [overrideCollections, setOverrideCollections] = useState("");
  const [sourceColorwayKey, setSourceColorwayKey] = useState("");
  const [targetColorwayKey, setTargetColorwayKey] = useState("");
  const [compatibility, setCompatibility] = useState<ColorCompatibility>(ColorCompatibility.MATCHING);
  const [rationale, setRationale] = useState("");

  const selectedProfile = visualProfiles.find((profile) => profile.productId === editingProductId) ?? null;

  const productRows = visualProfiles.map((profile) => [
    profile.title,
    renderBadgeList(profile.detectedColorwayKeys),
    renderBadgeList(profile.effectiveColorwayKeys),
    renderCollectionList(profile.effectiveCollections),
    profile.visualConfidence === null ? "—" : `${Math.round(profile.visualConfidence * 100)}%`,
    <Badge key={profile.id} tone={profile.reviewStatus === "MERCHANT_REVIEWED" ? "success" : profile.reviewStatus === "AUTO_APPROVED" ? "info" : "warning"}>
      {profile.reviewStatus}
    </Badge>,
    <InlineStack key={`actions-${profile.id}`} gap="200">
      <Button
        size="slim"
        onClick={() => {
          setEditingProductId(profile.productId);
          setOverrideColorways(profile.effectiveColorwayKeys.join(", "));
          setOverrideCollections(profile.effectiveCollections.map((collection) => collection.title || collection.handle).join(", "));
        }}
      >
        Edit
      </Button>
      <Button
        size="slim"
        onClick={() => fetcher.submit({ intent: "reset-visual-override", productId: profile.productId }, { method: "post" })}
      >
        Reset
      </Button>
    </InlineStack>,
  ]);

  const ruleRows = compatibilityRules.map((rule) => [
    rule.sourceColorwayKey,
    rule.targetColorwayKey,
    rule.compatibility,
    rule.rationale || "—",
    <Button
      key={`rule-${rule.id}`}
      size="slim"
      tone="critical"
      onClick={() => fetcher.submit({ intent: "delete-compatibility-rule", ruleId: rule.id }, { method: "post" })}
    >
      Delete
    </Button>,
  ]);

  return (
    <BlockStack gap="400">
      <Card>
        <BlockStack gap="300">
          <Text variant="headingMd" as="h2">Colorway Review</Text>
          {visualProfiles.length === 0 ? (
            <EmptyState
              heading="No visual profiles yet"
              image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
            >
              <p>Run a sync or colorway backfill to generate product visual profiles.</p>
            </EmptyState>
          ) : (
            <DataTable
              columnContentTypes={["text", "text", "text", "text", "numeric", "text", "text"]}
              headings={["Product", "Detected", "Effective", "Collections", "Confidence", "Review", "Actions"]}
              rows={productRows}
            />
          )}
        </BlockStack>
      </Card>

      {selectedProfile && (
        <Card>
          <BlockStack gap="300">
            <Text variant="headingMd" as="h2">Override Visual Profile</Text>
            <Text as="p" tone="subdued">{selectedProfile.title}</Text>
            <TextField
              label="Override colorways"
              value={overrideColorways}
              onChange={setOverrideColorways}
              autoComplete="off"
              helpText="Comma-separated normalized colorway labels. Leave blank to keep detected values."
            />
            <TextField
              label="Override collections"
              value={overrideCollections}
              onChange={setOverrideCollections}
              autoComplete="off"
              helpText="Comma-separated collection names or handles."
            />
            <InlineStack gap="200">
              <Button
                variant="primary"
                onClick={() => {
                  fetcher.submit(
                    {
                      intent: "save-visual-override",
                      productId: selectedProfile.productId,
                      overrideColorways,
                      overrideCollections,
                    },
                    { method: "post" },
                  );
                  setEditingProductId(null);
                }}
              >
                Save override
              </Button>
              <Button onClick={() => setEditingProductId(null)}>Cancel</Button>
            </InlineStack>
          </BlockStack>
        </Card>
      )}

      <Card>
        <BlockStack gap="300">
          <Text variant="headingMd" as="h2">Compatibility Rules</Text>
          {compatibilityRules.length === 0 ? (
            <Text as="p" tone="subdued">No compatibility rules defined yet.</Text>
          ) : (
            <DataTable
              columnContentTypes={["text", "text", "text", "text", "text"]}
              headings={["Source", "Target", "Compatibility", "Rationale", "Actions"]}
              rows={ruleRows}
            />
          )}
        </BlockStack>
      </Card>

      <Card>
        <BlockStack gap="300">
          <Text variant="headingMd" as="h2">Add Compatibility Rule</Text>
          <TextField
            label="Source colorway"
            value={sourceColorwayKey}
            onChange={setSourceColorwayKey}
            autoComplete="off"
          />
          <TextField
            label="Target colorway"
            value={targetColorwayKey}
            onChange={setTargetColorwayKey}
            autoComplete="off"
          />
          <Select
            label="Compatibility"
            options={Object.values(ColorCompatibility).map((value) => ({ label: value, value }))}
            value={compatibility}
            onChange={(value) => setCompatibility(value as ColorCompatibility)}
          />
          <TextField
            label="Rationale"
            value={rationale}
            onChange={setRationale}
            autoComplete="off"
          />
          <Button
            variant="primary"
            onClick={() => {
              fetcher.submit(
                {
                  intent: "save-compatibility-rule",
                  sourceColorwayKey,
                  targetColorwayKey,
                  compatibility,
                  rationale,
                },
                { method: "post" },
              );
              setSourceColorwayKey("");
              setTargetColorwayKey("");
              setRationale("");
            }}
          >
            Save rule
          </Button>
        </BlockStack>
      </Card>
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
  const {
    lowConfidenceProducts,
    allProducts,
    lowConfidenceCount,
    visualProfiles,
    compatibilityRules,
    sizeCharts,
    crossSizeMappings,
    categoryTags,
    relationshipCandidates,
    activeRelationships,
  } =
    useLoaderData<LoaderData>();

  const [selectedTab, setSelectedTab] = useState(0);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);

  const editorScaffold = createKnowledgeGraphRouteScaffold();
  const editorSnapshot = createKnowledgeGraphEditorSnapshot({
    lowConfidenceCount,
    totalProductsCount: allProducts.length,
    visualProfilesCount: visualProfiles.length,
    sizeChartsCount: sizeCharts.length,
    availableCategoryTagsCount: categoryTags.length,
  });

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
      id: "colorways",
      content: `Colorways (${visualProfiles.length})`,
    },
    {
      id: "size-charts",
      content: `Size Charts (${sizeCharts.length})`,
    },
    {
      id: "relationships",
      content: `Relationships (${relationshipCandidates.length + activeRelationships.length})`,
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
      title="Knowledge Graph"
      subtitle="Review taxonomy, colorway, and sizing intelligence from one admin surface."
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
          <KnowledgeGraphEditorShell
            scaffold={editorScaffold}
            snapshot={editorSnapshot}
          />
        </Layout.Section>

        <Layout.Section>
          <Card>
            <Tabs
              tabs={tabs}
              selected={selectedTab}
              onSelect={setSelectedTab}
            >
              {selectedTab === 2 ? (
                <ColorwaysTab
                  visualProfiles={visualProfiles}
                  compatibilityRules={compatibilityRules}
                />
              ) : selectedTab === 3 ? (
                <SizeChartsTab
                  sizeCharts={sizeCharts}
                  crossSizeMappings={crossSizeMappings}
                  categoryTags={categoryTags}
                />
              ) : selectedTab === 4 ? (
                <RelationshipsTab
                  candidates={relationshipCandidates}
                  activeRelationships={activeRelationships}
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

export function ErrorBoundary() {
  const error = useRouteError();

  const message = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : error instanceof Error
      ? error.message
      : "An unexpected error occurred while loading the Knowledge Graph editor.";

  return (
    <Frame>
      <Page title="Knowledge Graph" subtitle="Editor unavailable">
        <Layout>
          <Layout.Section>
            <Banner title="Unable to load Knowledge Graph editor" tone="critical">
              <p>{message}</p>
            </Banner>
          </Layout.Section>
        </Layout>
      </Page>
    </Frame>
  );
}
