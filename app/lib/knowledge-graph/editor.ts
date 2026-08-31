import type {
  KnowledgeGraphEditorSnapshot,
  KnowledgeGraphReviewQueueFilters,
  KnowledgeGraphRouteScaffold,
} from "./editor.types";
import { getLowConfidenceProducts, applyMerchantTaxonomyOverride } from "../db/queries";

type LowConfidenceProduct = {
  id: string;
  shopifyProductId: string;
  title: string;
  handle: string;
  disciplineTags: string[];
  categoryTags: string[];
  classificationConfidence: number | null;
  isManuallyClassified: boolean;
};

export const KNOWLEDGE_GRAPH_EDITOR_ROUTE_INTENTS = [
  "override-taxonomy",
  "save-visual-override",
  "reset-visual-override",
  "save-compatibility-rule",
  "delete-compatibility-rule",
  "save-size-chart-override",
  "reset-size-chart-override",
  "create-cross-size-mapping",
  "delete-cross-size-mapping",
  "approve-relationship",
  "reject-relationship",
  "disable-relationship",
  "create-relationship",
  "mark-reviewed",
  "reflag-for-review",
] as const;

export function createKnowledgeGraphRouteScaffold(): KnowledgeGraphRouteScaffold {
  return {
    hasLoader: true,
    hasAction: true,
    intents: [...KNOWLEDGE_GRAPH_EDITOR_ROUTE_INTENTS],
  };
}

export function createKnowledgeGraphEditorSnapshot(input: {
  lowConfidenceCount: number;
  totalProductsCount: number;
  visualProfilesCount: number;
  sizeChartsCount: number;
  availableCategoryTagsCount: number;
}): KnowledgeGraphEditorSnapshot {
  return {
    lowConfidenceCount: input.lowConfidenceCount,
    totalProductsCount: input.totalProductsCount,
    visualProfilesCount: input.visualProfilesCount,
    sizeChartsCount: input.sizeChartsCount,
    availableCategoryTagsCount: input.availableCategoryTagsCount,
  };
}

export function normalizeKnowledgeGraphReviewQueueFilters(
  input: KnowledgeGraphReviewQueueFilters,
): KnowledgeGraphReviewQueueFilters {
  return {
    search: input.search?.trim() || undefined,
    disciplineTags: input.disciplineTags?.filter(Boolean),
    categoryTags: input.categoryTags?.filter(Boolean),
    reviewStatus: input.reviewStatus,
    limit: input.limit,
    cursor: input.cursor,
    sort: input.sort ?? "confidence_asc",
  };
}

export async function getKnowledgeGraphReviewQueue(
  shop: string,
  confidenceThreshold: number,
  filters: KnowledgeGraphReviewQueueFilters,
): Promise<LowConfidenceProduct[]> {
  const normalized = normalizeKnowledgeGraphReviewQueueFilters(filters);
  const rows = await getLowConfidenceProducts(
    shop,
    confidenceThreshold,
    normalized.limit ?? 50,
    normalized.cursor,
  );

  const search = normalized.search?.toLowerCase();

  const filtered = rows.filter((row) => {
    if (search && !`${row.title} ${row.handle}`.toLowerCase().includes(search)) {
      return false;
    }

    if (
      normalized.disciplineTags &&
      normalized.disciplineTags.length > 0 &&
      !row.disciplineTags.some((tag) => normalized.disciplineTags!.includes(tag))
    ) {
      return false;
    }

    if (
      normalized.categoryTags &&
      normalized.categoryTags.length > 0 &&
      !row.categoryTags.some((tag) => normalized.categoryTags!.includes(tag))
    ) {
      return false;
    }

    return true;
  });

  if (normalized.sort === "confidence_desc") {
    return filtered.sort(
      (a, b) => (b.classificationConfidence ?? 0) - (a.classificationConfidence ?? 0),
    );
  }

  return filtered.sort(
    (a, b) => (a.classificationConfidence ?? 0) - (b.classificationConfidence ?? 0),
  );
}

// ---------------------------------------------------------------------------
// T016 — Review-status transition handlers
// ---------------------------------------------------------------------------

/**
 * Mark a product as reviewed by confirming its current taxonomy assignments.
 * Sets isManuallyClassified = true so the item leaves the low-confidence queue.
 * The existing discipline/category tags are preserved; call applyMerchantTaxonomyOverride
 * directly if you also want to change the classification values.
 */
export async function markProductAsReviewed(
  shopifyProductId: string,
  currentDisciplineTags: string[],
  currentCategoryTags: string[],
): Promise<void> {
  await applyMerchantTaxonomyOverride(shopifyProductId, currentDisciplineTags, currentCategoryTags);
}

/**
 * Reflag a product for re-review by resetting its isManuallyClassified flag
 * and lowering its confidence score so it re-enters the low-confidence queue.
 *
 * This does NOT change the discipline/category tags — it only resets the review state.
 */
export async function reflagProductForReview(shopifyProductId: string): Promise<void> {
  const db = (await import("../../db.server")).default;
  await db.product.updateMany({
    where: { shopifyProductId },
    data: {
      isManuallyClassified: false,
      classificationConfidence: 0.0,
      updatedAt: new Date(),
    },
  });
}
