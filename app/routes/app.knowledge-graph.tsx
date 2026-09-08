import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import {
  useLoaderData,
  useSubmit,
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
  previewCrossSizeConflict,
  getRelationshipCandidatesForAdmin,
  getMerchantActiveRelationships,
  approveRelationship,
  rejectRelationship,
  disableRelationship,
  upsertMerchantRelationship,
  listKitDefinitionsForShop,
  listProductsForKitEditor,
  upsertKitDefinition,
  upsertKitRequirement,
  deleteKitRequirement,
  archiveKitDefinition,
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
import {
  ColorCompatibility,
  RelationshipType,
  KnowledgeGraphBulkOperationType,
  KitDefinitionSource,
  RequirementMatchMode,
} from "@prisma/client";

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
  markProductAsReviewed,
  reflagProductForReview,
  getKnowledgeGraphChangeHistory,
} from "../lib/knowledge-graph/editor";
import {
  UpsertSizeMappingRuleSchema,
  DeactivateSizeMappingRuleSchema,
  PreviewBulkOperationSchema,
  ConfirmBulkOperationSchema,
  CancelBulkOperationSchema,
} from "../lib/knowledge-graph/editor.validation";
import {
  upsertGovernedSizeMapping,
  deactivateGovernedSizeMapping,
} from "../lib/knowledge-graph/sizing";
import {
  previewBulkOperation,
  confirmBulkOperation,
  cancelBulkOperation,
  executeBulkOperation,
} from "../lib/knowledge-graph/editor.bulk";

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

type GovernedSizeMappingRow = CrossSizeMappingRow & { revision: number };

type KitRequirementRow = {
  id: string;
  requirementKey: string;
  label: string;
  isRequired: boolean;
  priority: number;
  safetyCritical: boolean;
  matchMode: string;
  acceptedCategoryTags: string[];
  acceptedShopifyProductIds: string[];
  minQuantity: number;
};

type KitDefinitionRow = {
  id: string;
  key: string;
  label: string;
  disciplineTag: string;
  description: string | null;
  source: string;
  status: string;
  requirements: KitRequirementRow[];
};

type KitEditorProductRow = {
  id: string;
  shopifyProductId: string;
  title: string;
  categoryTags: string[];
};

type ChangeHistoryRowData = {
  id: string;
  actorId: string | null;
  entityType: string;
  entityId: string;
  action: string;
  reason: string | null;
  createdAt: string;
};

type LoaderData = {
  lowConfidenceProducts: TaxonomyProduct[];
  allProducts: TaxonomyProduct[];
  lowConfidenceCount: number;
  visualProfiles: VisualAdminRow[];
  compatibilityRules: ColorCompatibilityRuleRow[];
  sizeCharts: SizeChartRow[];
  crossSizeMappings: CrossSizeMappingRow[];
  governedSizeMappings: GovernedSizeMappingRow[];
  changeHistory: ChangeHistoryRowData[];
  categoryTags: string[];
  relationshipCandidates: RelationshipAdminRow[];
  activeRelationships: RelationshipAdminRow[];
  kitDefinitions: KitDefinitionRow[];
  kitEditorProducts: KitEditorProductRow[];
};

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  const [lowConfidenceProducts, allProducts, rawVisualProfiles, rawCompatibilityRules, rawSizeCharts, rawCrossMappings, categoryTags, relationshipCandidates, activeRelationships, changeHistoryPage, rawKitDefinitions, rawKitEditorProducts] = await Promise.all([
    getLowConfidenceProducts(session.shop, CONFIDENCE_THRESHOLD, 50),
    getProductsWithTaxonomy(session.shop, 50),
    listVisualProfilesForReview(session.shop, 50),
    listColorCompatibilityRules(session.shop),
    getSizeChartsForShop(session.shop),
    getCrossSizeMappingsForShop(session.shop),
    getDistinctSizeCategoryTagsForShop(session.shop),
    getRelationshipCandidatesForAdmin(session.shop),
    getMerchantActiveRelationships(session.shop),
    getKnowledgeGraphChangeHistory(session.shop, { take: 25 }),
    listKitDefinitionsForShop(session.shop, 100),
    listProductsForKitEditor(session.shop, 200),
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

  const governedSizeMappings: GovernedSizeMappingRow[] = rawCrossMappings.map((m) => ({
    id: m.id,
    sourceCategoryTag: m.sourceCategoryTag,
    sourceSize: m.sourceSize,
    targetCategoryTag: m.targetCategoryTag,
    targetSize: m.targetSize,
    severityOnMismatch: m.severityOnMismatch,
    source: m.source,
    revision: m.updatedAt.getTime(),
  }));

  const changeHistory: ChangeHistoryRowData[] = changeHistoryPage.entries.map((entry) => ({
    id: entry.id,
    actorId: entry.actorId,
    entityType: entry.entityType,
    entityId: entry.entityId,
    action: entry.action,
    reason: entry.reason,
    createdAt: entry.createdAt.toISOString(),
  }));

  const kitDefinitions: KitDefinitionRow[] = rawKitDefinitions.map((kit) => ({
    id: kit.id,
    key: kit.key,
    label: kit.label,
    disciplineTag: kit.disciplineTag,
    description: kit.description,
    source: kit.source,
    status: kit.status,
    requirements: kit.requirements.map((requirement) => ({
      id: requirement.id,
      requirementKey: requirement.requirementKey,
      label: requirement.label,
      isRequired: requirement.isRequired,
      priority: requirement.priority,
      safetyCritical: requirement.safetyCritical,
      matchMode: requirement.matchMode,
      acceptedCategoryTags: requirement.acceptedCategoryTags,
      acceptedShopifyProductIds: requirement.acceptedShopifyProductIds,
      minQuantity: requirement.minQuantity,
    })),
  }));

  const kitEditorProducts: KitEditorProductRow[] = rawKitEditorProducts.map((product) => ({
    id: product.id,
    shopifyProductId: product.shopifyProductId,
    title: product.title,
    categoryTags: product.categoryTags,
  }));

  return {
    lowConfidenceProducts,
    allProducts,
    lowConfidenceCount: lowConfidenceProducts.length,
    visualProfiles,
    compatibilityRules,
    sizeCharts,
    crossSizeMappings,
    governedSizeMappings,
    changeHistory,
    categoryTags,
    relationshipCandidates,
    activeRelationships,
    kitDefinitions,
    kitEditorProducts,
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

const PreviewCrossSizeConflictSchema = z.object({
  sourceCategoryTag: z.string().min(1),
  sourceSize: z.string().min(1),
  targetCategoryTag: z.string().min(1),
  targetSize: z.string().min(1),
});

const SaveKitDefinitionSchema = z.object({
  id: z.string().optional(),
  key: z.string().min(1),
  label: z.string().min(1),
  disciplineTag: z.string().min(1),
  description: z.string().optional(),
});

const SaveKitRequirementSchema = z.object({
  id: z.string().optional(),
  kitDefinitionId: z.string().min(1),
  requirementKey: z.string().min(1),
  label: z.string().min(1),
  isRequired: z.boolean(),
  priority: z.number().int(),
  safetyCritical: z.boolean(),
  matchMode: z.nativeEnum(RequirementMatchMode),
  acceptedCategoryTags: z.array(z.string()),
  acceptedShopifyProductIds: z.array(z.string()),
  minQuantity: z.number().int().min(1),
});

const DeleteKitRequirementSchema = z.object({
  requirementId: z.string().min(1),
});

const ArchiveKitDefinitionSchema = z.object({
  kitId: z.string().min(1),
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

  // T017 (008) — preview-cross-size-conflict: read-only evaluation, no persistence
  if (intent === "preview-cross-size-conflict") {
    const raw = {
      sourceCategoryTag: formData.get("sourceCategoryTag"),
      sourceSize: formData.get("sourceSize"),
      targetCategoryTag: formData.get("targetCategoryTag"),
      targetSize: formData.get("targetSize"),
    };
    const parsed = PreviewCrossSizeConflictSchema.safeParse(raw);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
    const preview = await previewCrossSizeConflict(
      session.shop,
      parsed.data.sourceCategoryTag,
      parsed.data.sourceSize,
      parsed.data.targetCategoryTag,
      parsed.data.targetSize,
    );
    return { ok: true, preview };
  }

  // T018 (007) — save-kit-definition (merchant-authored kit metadata)
  if (intent === "save-kit-definition") {
    const raw = {
      id: formData.get("id") || undefined,
      key: formData.get("key"),
      label: formData.get("label"),
      disciplineTag: formData.get("disciplineTag"),
      description: formData.get("description") || undefined,
    };
    const parsed = SaveKitDefinitionSchema.safeParse(raw);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
    await upsertKitDefinition({
      id: parsed.data.id,
      shop: session.shop,
      key: parsed.data.key,
      label: parsed.data.label,
      disciplineTag: parsed.data.disciplineTag,
      description: parsed.data.description ?? null,
      source: KitDefinitionSource.MERCHANT,
    });
    return { ok: true };
  }

  // T018 (007) — save-kit-requirement
  if (intent === "save-kit-requirement") {
    const raw = {
      id: formData.get("id") || undefined,
      kitDefinitionId: formData.get("kitDefinitionId"),
      requirementKey: formData.get("requirementKey"),
      label: formData.get("label"),
      isRequired: formData.get("isRequired") === "true",
      priority: Number(formData.get("priority") ?? 100),
      safetyCritical: formData.get("safetyCritical") === "true",
      matchMode: formData.get("matchMode") ?? RequirementMatchMode.CATEGORY,
      acceptedCategoryTags: String(formData.get("acceptedCategoryTags") ?? "")
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
      acceptedShopifyProductIds: String(formData.get("acceptedShopifyProductIds") ?? "")
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean),
      minQuantity: Number(formData.get("minQuantity") ?? 1),
    };
    const parsed = SaveKitRequirementSchema.safeParse(raw);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
    await upsertKitRequirement(parsed.data);
    return { ok: true };
  }

  // T018 (007) — delete-kit-requirement
  if (intent === "delete-kit-requirement") {
    const raw = { requirementId: formData.get("requirementId") };
    const parsed = DeleteKitRequirementSchema.safeParse(raw);
    if (!parsed.success) return { ok: false, error: parsed.error.message };
    await deleteKitRequirement(parsed.data.requirementId);
    return { ok: true };
  }

  // T018 (007) — archive-kit-definition
  if (intent === "archive-kit-definition") {
    const raw = { kitId: formData.get("kitId") };
    const parsed = ArchiveKitDefinitionSchema.safeParse(raw);
    if (!parsed.success) return { ok: false, error: parsed.error.message };
    await archiveKitDefinition(parsed.data.kitId);
    return { ok: true };
  }

  // T025 — upsert-size-mapping-rule (governed: contradiction + revision checks)
  if (intent === "upsert-size-mapping-rule") {
    const raw = {
      sourceCategoryTag: formData.get("sourceCategoryTag"),
      sourceSize: formData.get("sourceSize"),
      targetCategoryTag: formData.get("targetCategoryTag"),
      targetSize: formData.get("targetSize"),
      severityOnMismatch: formData.get("severityOnMismatch") ?? "WARNING",
      expectedRevision: formData.get("expectedRevision")
        ? Number(formData.get("expectedRevision"))
        : undefined,
    };
    const parsed = UpsertSizeMappingRuleSchema.safeParse(raw);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
    }
    const result = await upsertGovernedSizeMapping({ shop: session.shop, actorId: session.shop, ...parsed.data });
    if (!result.ok) {
      if (result.code === "VALIDATION") {
        return { ok: false, error: result.contradictions[0]?.message, contradictions: result.contradictions };
      }
      return { ok: false, error: result.conflict.message, conflict: result.conflict };
    }
    return { ok: true };
  }

  // T025 — deactivate-size-mapping-rule (governed: revision-checked delete + audit log)
  if (intent === "deactivate-size-mapping-rule") {
    const raw = {
      mappingId: formData.get("mappingId"),
      expectedRevision: formData.get("expectedRevision")
        ? Number(formData.get("expectedRevision"))
        : undefined,
    };
    const parsed = DeactivateSizeMappingRuleSchema.safeParse(raw);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
    const result = await deactivateGovernedSizeMapping({ shop: session.shop, actorId: session.shop, ...parsed.data });
    if (!result.ok) {
      if (result.code === "NOT_FOUND") return { ok: false, error: "Mapping not found" };
      return { ok: false, error: result.conflict.message, conflict: result.conflict };
    }
    return { ok: true };
  }

  // T033 — preview-bulk-operation
  if (intent === "preview-bulk-operation") {
    const raw = {
      operationType: formData.get("operationType"),
      filter: JSON.parse(String(formData.get("filter") ?? "{}")),
      changePayload: JSON.parse(String(formData.get("changePayload") ?? "{}")),
    };
    const parsed = PreviewBulkOperationSchema.safeParse(raw);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
    const result = await previewBulkOperation({
      shop: session.shop,
      operationType: parsed.data.operationType as KnowledgeGraphBulkOperationType,
      filter: parsed.data.filter,
      changePayload: parsed.data.changePayload,
      initiatedBy: session.shop,
    });
    return result;
  }

  // T033 — confirm-bulk-operation (confirms then executes synchronously)
  if (intent === "confirm-bulk-operation") {
    const raw = { operationId: formData.get("operationId"), previewHash: formData.get("previewHash") };
    const parsed = ConfirmBulkOperationSchema.safeParse(raw);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
    const confirmResult = await confirmBulkOperation({ shop: session.shop, ...parsed.data });
    if (!confirmResult.ok) return { ok: false, error: `Unable to confirm operation (${confirmResult.code})` };
    return await executeBulkOperation({ shop: session.shop, operationId: confirmResult.operationId, actorId: session.shop });
  }

  // T033 — cancel-bulk-operation (guarantees no persisted product changes)
  if (intent === "cancel-bulk-operation") {
    const raw = { operationId: formData.get("operationId") };
    const parsed = CancelBulkOperationSchema.safeParse(raw);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
    const result = await cancelBulkOperation({ shop: session.shop, ...parsed.data });
    if (!result.ok) return { ok: false, error: `Unable to cancel operation (${result.code})` };
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

  // T017 — mark-reviewed: confirm current taxonomy without editing values
  if (intent === "mark-reviewed") {
    const shopifyProductId = formData.get("shopifyProductId");
    const disciplineTagsRaw = formData.get("disciplineTags");
    const categoryTagsRaw = formData.get("categoryTags");
    if (
      typeof shopifyProductId !== "string" || !shopifyProductId ||
      typeof disciplineTagsRaw !== "string" ||
      typeof categoryTagsRaw !== "string"
    ) {
      return { ok: false, error: "Missing required fields" };
    }
    const disciplineTags = JSON.parse(disciplineTagsRaw) as string[];
    const categoryTags = JSON.parse(categoryTagsRaw) as string[];
    await markProductAsReviewed(shopifyProductId, disciplineTags, categoryTags);
    return { ok: true };
  }

  // T017 — reflag-for-review: put a product back in the review queue
  if (intent === "reflag-for-review") {
    const shopifyProductId = formData.get("shopifyProductId");
    if (typeof shopifyProductId !== "string" || !shopifyProductId) {
      return { ok: false, error: "Missing shopifyProductId" };
    }
    await reflagProductForReview(shopifyProductId);
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
  const previewFetcher = useFetcher<{ ok: boolean; preview?: { evaluated: boolean; severity?: string; expectedSize?: string; message?: string } }>();
  const [toast, setToast] = useState<{ message: string; error?: boolean } | null>(null);
  const [addModalOpen, setAddModalOpen] = useState(false);

  // Preview form state
  const [previewSourceCat, setPreviewSourceCat] = useState("");
  const [previewSourceSize, setPreviewSourceSize] = useState("");
  const [previewTargetCat, setPreviewTargetCat] = useState("");
  const [previewTargetSize, setPreviewTargetSize] = useState("");

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

  const handlePreview = useCallback(() => {
    if (!previewSourceCat || !previewSourceSize || !previewTargetCat || !previewTargetSize) return;
    previewFetcher.submit(
      {
        intent: "preview-cross-size-conflict",
        sourceCategoryTag: previewSourceCat,
        sourceSize: previewSourceSize,
        targetCategoryTag: previewTargetCat,
        targetSize: previewTargetSize,
      },
      { method: "post" },
    );
  }, [previewFetcher, previewSourceCat, previewSourceSize, previewTargetCat, previewTargetSize]);

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

      <Card>
        <BlockStack gap="300">
          <Text variant="headingMd" as="h2">Preview Compatibility</Text>
          <Text tone="subdued" as="p">
            Test a category pair against existing rules without saving anything.
          </Text>
          <InlineStack gap="300">
            <Select
              label="Source Category"
              labelHidden
              options={catOptions}
              value={previewSourceCat}
              onChange={setPreviewSourceCat}
            />
            <TextField
              label="Source Size"
              labelHidden
              placeholder="Source size"
              value={previewSourceSize}
              onChange={setPreviewSourceSize}
              autoComplete="off"
            />
            <Select
              label="Target Category"
              labelHidden
              options={catOptions}
              value={previewTargetCat}
              onChange={setPreviewTargetCat}
            />
            <TextField
              label="Target Size"
              labelHidden
              placeholder="Target size"
              value={previewTargetSize}
              onChange={setPreviewTargetSize}
              autoComplete="off"
            />
            <Button onClick={handlePreview} loading={previewFetcher.state !== "idle"}>
              Preview
            </Button>
          </InlineStack>
          {previewFetcher.data?.preview && (
            <Banner
              tone={
                !previewFetcher.data.preview.evaluated
                  ? "info"
                  : previewFetcher.data.preview.severity === "ERROR"
                    ? "critical"
                    : "warning"
              }
            >
              <p>{previewFetcher.data.preview.message}</p>
            </Banner>
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
// Kits Tab component (007 T019)
// ---------------------------------------------------------------------------

function KitsTab({
  kitDefinitions,
  kitEditorProducts,
}: {
  kitDefinitions: KitDefinitionRow[];
  kitEditorProducts: KitEditorProductRow[];
}) {
  const fetcher = useFetcher();
  const [toast, setToast] = useState<{ message: string; error?: boolean } | null>(null);
  const [selectedKitId, setSelectedKitId] = useState<string | null>(kitDefinitions[0]?.id ?? null);
  const [addKitModalOpen, setAddKitModalOpen] = useState(false);
  const [addRequirementModalOpen, setAddRequirementModalOpen] = useState(false);

  // New kit form state
  const [newKitKey, setNewKitKey] = useState("");
  const [newKitLabel, setNewKitLabel] = useState("");
  const [newKitDiscipline, setNewKitDiscipline] = useState("");
  const [newKitDescription, setNewKitDescription] = useState("");

  // New requirement form state
  const [newReqKey, setNewReqKey] = useState("");
  const [newReqLabel, setNewReqLabel] = useState("");
  const [newReqIsRequired, setNewReqIsRequired] = useState<"true" | "false">("true");
  const [newReqPriority, setNewReqPriority] = useState("100");
  const [newReqSafetyCritical, setNewReqSafetyCritical] = useState<"true" | "false">("false");
  const [newReqMatchMode, setNewReqMatchMode] = useState<string>("CATEGORY");
  const [newReqCategoryTags, setNewReqCategoryTags] = useState("");
  const [newReqSubstituteProductIds, setNewReqSubstituteProductIds] = useState("");
  const [newReqMinQuantity, setNewReqMinQuantity] = useState("1");

  const submitAction = useCallback(
    (data: Record<string, string>) => {
      fetcher.submit(data, { method: "post" });
    },
    [fetcher],
  );

  const handleArchive = useCallback(
    (kitId: string) => {
      submitAction({ intent: "archive-kit-definition", kitId });
      setToast({ message: "Kit archived" });
    },
    [submitAction],
  );

  const handleDeleteRequirement = useCallback(
    (requirementId: string) => {
      submitAction({ intent: "delete-kit-requirement", requirementId });
      setToast({ message: "Requirement removed" });
    },
    [submitAction],
  );

  const handleAddKit = useCallback(() => {
    if (!newKitKey || !newKitLabel || !newKitDiscipline) return;
    fetcher.submit(
      {
        intent: "save-kit-definition",
        key: newKitKey,
        label: newKitLabel,
        disciplineTag: newKitDiscipline,
        description: newKitDescription,
      },
      { method: "post" },
    );
    setAddKitModalOpen(false);
    setToast({ message: "Kit created" });
  }, [fetcher, newKitKey, newKitLabel, newKitDiscipline, newKitDescription]);

  const handleAddRequirement = useCallback(() => {
    if (!selectedKitId || !newReqKey || !newReqLabel) return;
    fetcher.submit(
      {
        intent: "save-kit-requirement",
        kitDefinitionId: selectedKitId,
        requirementKey: newReqKey,
        label: newReqLabel,
        isRequired: newReqIsRequired,
        priority: newReqPriority,
        safetyCritical: newReqSafetyCritical,
        matchMode: newReqMatchMode,
        acceptedCategoryTags: newReqCategoryTags,
        acceptedShopifyProductIds: newReqSubstituteProductIds,
        minQuantity: newReqMinQuantity,
      },
      { method: "post" },
    );
    setAddRequirementModalOpen(false);
    setToast({ message: "Requirement created" });
  }, [
    fetcher,
    selectedKitId,
    newReqKey,
    newReqLabel,
    newReqIsRequired,
    newReqPriority,
    newReqSafetyCritical,
    newReqMatchMode,
    newReqCategoryTags,
    newReqSubstituteProductIds,
    newReqMinQuantity,
  ]);

  const matchModeOptions = [
    { label: "Category", value: "CATEGORY" },
    { label: "Product", value: "PRODUCT" },
    { label: "Category or Product", value: "CATEGORY_OR_PRODUCT" },
    { label: "Product or Alternative", value: "PRODUCT_OR_ALTERNATIVE" },
  ];
  const requiredOptions = [
    { label: "Required", value: "true" },
    { label: "Optional", value: "false" },
  ];
  const productOptions = [
    { label: "— none —", value: "" },
    ...kitEditorProducts.map((p) => ({ label: p.title, value: p.shopifyProductId })),
  ];

  const kitRows = kitDefinitions.map((kit) => [
    kit.key,
    kit.label,
    kit.disciplineTag,
    <Badge key={`src-${kit.id}`} tone={kit.source === "MERCHANT" ? "success" : kit.source === "HYBRID" ? "attention" : "info"}>
      {kit.source}
    </Badge>,
    <Badge key={`st-${kit.id}`} tone={kit.status === "ACTIVE" ? "success" : "critical"}>{kit.status}</Badge>,
    String(kit.requirements.length),
    <InlineStack key={`act-${kit.id}`} gap="200">
      <Button size="slim" onClick={() => setSelectedKitId(kit.id)}>Manage</Button>
      {kit.status === "ACTIVE" && (
        <Button size="slim" tone="critical" onClick={() => handleArchive(kit.id)}>Archive</Button>
      )}
    </InlineStack>,
  ]);

  const selectedKit = kitDefinitions.find((kit) => kit.id === selectedKitId) ?? null;

  const requirementRows = (selectedKit?.requirements ?? []).map((requirement) => [
    requirement.requirementKey,
    requirement.label,
    <Badge key={`req-${requirement.id}`} tone={requirement.isRequired ? "critical" : "info"}>
      {requirement.isRequired ? "Required" : "Optional"}
    </Badge>,
    String(requirement.priority),
    requirement.matchMode,
    requirement.acceptedCategoryTags.join(", ") || "—",
    String(requirement.minQuantity),
    <Button key={`del-${requirement.id}`} size="slim" tone="critical" onClick={() => handleDeleteRequirement(requirement.id)}>
      Delete
    </Button>,
  ]);

  return (
    <BlockStack gap="400">
      {toast && (
        <Toast content={toast.message} error={toast.error} onDismiss={() => setToast(null)} />
      )}

      <Card>
        <BlockStack gap="300">
          <InlineStack align="space-between">
            <Text variant="headingMd" as="h2">Kit Definitions</Text>
            <Button variant="primary" onClick={() => setAddKitModalOpen(true)}>Add kit</Button>
          </InlineStack>
          {kitDefinitions.length === 0 ? (
            <EmptyState
              heading="No kit definitions yet"
              image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
            >
              <p>Run the kit seed script or create a kit to start tracking completeness.</p>
            </EmptyState>
          ) : (
            <DataTable
              columnContentTypes={["text", "text", "text", "text", "text", "numeric", "text"]}
              headings={["Key", "Label", "Discipline", "Source", "Status", "Requirements", "Actions"]}
              rows={kitRows}
            />
          )}
        </BlockStack>
      </Card>

      {selectedKit && (
        <Card>
          <BlockStack gap="300">
            <InlineStack align="space-between">
              <Text variant="headingMd" as="h2">Requirements — {selectedKit.label}</Text>
              <Button onClick={() => setAddRequirementModalOpen(true)}>Add requirement</Button>
            </InlineStack>
            {requirementRows.length === 0 ? (
              <EmptyState
                heading="No requirements yet"
                image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
              >
                <p>Add required and optional slots to define this kit.</p>
              </EmptyState>
            ) : (
              <DataTable
                columnContentTypes={["text", "text", "text", "numeric", "text", "text", "numeric", "text"]}
                headings={["Key", "Label", "Priority level", "Priority", "Match mode", "Accepted categories", "Min qty", "Actions"]}
                rows={requirementRows}
              />
            )}
          </BlockStack>
        </Card>
      )}

      <Modal
        open={addKitModalOpen}
        onClose={() => setAddKitModalOpen(false)}
        title="Add Kit Definition"
        primaryAction={{ content: "Create", onAction: handleAddKit }}
        secondaryActions={[{ content: "Cancel", onAction: () => setAddKitModalOpen(false) }]}
      >
        <Modal.Section>
          <BlockStack gap="300">
            <TextField label="Key" value={newKitKey} onChange={setNewKitKey} autoComplete="off" />
            <TextField label="Label" value={newKitLabel} onChange={setNewKitLabel} autoComplete="off" />
            <TextField label="Discipline Tag" value={newKitDiscipline} onChange={setNewKitDiscipline} autoComplete="off" />
            <TextField label="Description" value={newKitDescription} onChange={setNewKitDescription} autoComplete="off" multiline={2} />
          </BlockStack>
        </Modal.Section>
      </Modal>

      <Modal
        open={addRequirementModalOpen}
        onClose={() => setAddRequirementModalOpen(false)}
        title="Add Kit Requirement"
        primaryAction={{ content: "Create", onAction: handleAddRequirement }}
        secondaryActions={[{ content: "Cancel", onAction: () => setAddRequirementModalOpen(false) }]}
      >
        <Modal.Section>
          <BlockStack gap="300">
            <TextField label="Requirement Key" value={newReqKey} onChange={setNewReqKey} autoComplete="off" />
            <TextField label="Label" value={newReqLabel} onChange={setNewReqLabel} autoComplete="off" />
            <Select label="Priority level" options={requiredOptions} value={newReqIsRequired} onChange={(v) => setNewReqIsRequired(v as "true" | "false")} />
            <TextField label="Priority (lower = higher priority)" type="number" value={newReqPriority} onChange={setNewReqPriority} autoComplete="off" />
            <Select label="Safety critical" options={requiredOptions.map((o) => ({ label: o.value === "true" ? "Yes" : "No", value: o.value }))} value={newReqSafetyCritical} onChange={(v) => setNewReqSafetyCritical(v as "true" | "false")} />
            <Select label="Match mode" options={matchModeOptions} value={newReqMatchMode} onChange={setNewReqMatchMode} />
            <TextField label="Accepted Category Tags (comma-separated)" value={newReqCategoryTags} onChange={setNewReqCategoryTags} autoComplete="off" />
            <Select label="Substitute product (optional alternative coverage)" options={productOptions} value={newReqSubstituteProductIds} onChange={setNewReqSubstituteProductIds} />
            <TextField label="Minimum Quantity" type="number" value={newReqMinQuantity} onChange={setNewReqMinQuantity} autoComplete="off" />
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
    governedSizeMappings,
    changeHistory,
    categoryTags,
    relationshipCandidates,
    activeRelationships,
    kitDefinitions,
    kitEditorProducts,
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
    {
      id: "kits",
      content: `Kits (${kitDefinitions.length})`,
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
            reviewItems={lowConfidenceProducts}
            availableDisciplines={[...new Set(allProducts.flatMap(p => p.disciplineTags))].sort()}
            availableCategories={categoryTags}
            governedSizeMappings={governedSizeMappings}
            changeHistory={changeHistory}
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
              ) : selectedTab === 5 ? (
                <KitsTab
                  kitDefinitions={kitDefinitions}
                  kitEditorProducts={kitEditorProducts}
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
