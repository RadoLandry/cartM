/**
 * Bulk governance operations — Knowledge Graph Editor US3 (T030-T032).
 *
 * Lifecycle: resolve target selection -> preview (hash + persisted operation
 * row) -> confirm (guarded by preview hash match) -> execute (per-record
 * apply + change log) -> cancel (only while previewed/confirmed, guaranteeing
 * no persisted changes).
 */

import { createHash } from "crypto";
import { KnowledgeGraphBulkOperationType, KnowledgeGraphBulkOperationStatus, KnowledgeGraphChangeAction, KnowledgeGraphEntityType, type Prisma } from "@prisma/client";
import {
  applyMerchantTaxonomyOverride,
  createKnowledgeGraphBulkOperation,
  createKnowledgeGraphChangeLog,
  getKnowledgeGraphBulkOperationById,
  getProductById,
  getProductsWithTaxonomy,
  listKnowledgeGraphChangeLogForEntity,
  updateKnowledgeGraphBulkOperationStatus,
} from "../db/queries";

export interface BulkTargetFilter {
  productIds?: string[];
  disciplineTags?: string[];
  categoryTags?: string[];
  search?: string;
}

export interface BulkChangePayload {
  disciplineTagsToAdd?: string[];
  disciplineTagsToRemove?: string[];
  categoryTagsToAdd?: string[];
  categoryTagsToRemove?: string[];
}

export interface BulkTargetSnapshot {
  productIds: string[];
  filterSnapshot: BulkTargetFilter;
  resolvedAt: string;
}

// ---------------------------------------------------------------------------
// T030 — deterministic target selection resolver
// ---------------------------------------------------------------------------

export async function resolveBulkTargetSelection(
  shop: string,
  filter: BulkTargetFilter,
): Promise<BulkTargetSnapshot> {
  let candidates = await getProductsWithTaxonomy(shop, 1000);

  if (filter.productIds && filter.productIds.length > 0) {
    const idSet = new Set(filter.productIds);
    candidates = candidates.filter((p) => idSet.has(p.id));
  }
  if (filter.disciplineTags && filter.disciplineTags.length > 0) {
    candidates = candidates.filter((p) => p.disciplineTags.some((t) => filter.disciplineTags!.includes(t)));
  }
  if (filter.categoryTags && filter.categoryTags.length > 0) {
    candidates = candidates.filter((p) => p.categoryTags.some((t) => filter.categoryTags!.includes(t)));
  }
  if (filter.search && filter.search.trim().length > 0) {
    const q = filter.search.trim().toLowerCase();
    candidates = candidates.filter((p) => `${p.title} ${p.handle}`.toLowerCase().includes(q));
  }

  return {
    productIds: candidates.map((p) => p.id).sort(),
    filterSnapshot: filter,
    resolvedAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// T031 — preview-hash generation and confirmation guard
// ---------------------------------------------------------------------------

export function computeBulkPreviewHash(input: {
  operationType: KnowledgeGraphBulkOperationType;
  productIds: string[];
  changePayload: BulkChangePayload;
}): string {
  const normalized = JSON.stringify({
    operationType: input.operationType,
    productIds: [...input.productIds].sort(),
    changePayload: input.changePayload,
  });
  return createHash("sha256").update(normalized).digest("hex").slice(0, 24);
}

export interface PreviewBulkOperationInput {
  shop: string;
  operationType: KnowledgeGraphBulkOperationType;
  filter: BulkTargetFilter;
  changePayload: BulkChangePayload;
  initiatedBy?: string;
}

export type PreviewBulkOperationResult =
  | {
      ok: true;
      operationId: string;
      previewHash: string;
      targetCount: number;
      sampleTargetIds: string[];
    }
  | { ok: false; error: string };

export async function previewBulkOperation(
  input: PreviewBulkOperationInput,
): Promise<PreviewBulkOperationResult> {
  const snapshot = await resolveBulkTargetSelection(input.shop, input.filter);
  if (snapshot.productIds.length === 0) {
    return { ok: false, error: "No products matched the selected filters." };
  }

  const previewHash = computeBulkPreviewHash({
    operationType: input.operationType,
    productIds: snapshot.productIds,
    changePayload: input.changePayload,
  });

  const operation = await createKnowledgeGraphBulkOperation({
    shop: input.shop,
    operationType: input.operationType,
    targetCount: snapshot.productIds.length,
    previewHash,
    initiatedBy: input.initiatedBy,
  });

  // The KnowledgeGraphBulkOperation row has no json column for the target
  // list/change payload, so the preview snapshot is stashed as the initial
  // change-log entry (linked via bulkOperationId) for the execute step to read.
  await createKnowledgeGraphChangeLog({
    shop: input.shop,
    actorId: input.initiatedBy,
    entityType: KnowledgeGraphEntityType.BULK_OPERATION,
    entityId: operation.id,
    action: KnowledgeGraphChangeAction.CREATE,
    afterSnapshot: {
      productIds: snapshot.productIds,
      changePayload: input.changePayload,
      filter: input.filter,
    } as unknown as Prisma.InputJsonValue,
    bulkOperationId: operation.id,
  });

  return {
    ok: true,
    operationId: operation.id,
    previewHash,
    targetCount: snapshot.productIds.length,
    sampleTargetIds: snapshot.productIds.slice(0, 10),
  };
}

export type ConfirmBulkOperationResult =
  | { ok: true; operationId: string }
  | { ok: false; code: "NOT_FOUND" | "PREVIEW_MISMATCH" | "INVALID_STATUS" };

export async function confirmBulkOperation(input: {
  shop: string;
  operationId: string;
  previewHash: string;
}): Promise<ConfirmBulkOperationResult> {
  const operation = await getKnowledgeGraphBulkOperationById(input.operationId, input.shop);
  if (!operation) {
    return { ok: false, code: "NOT_FOUND" };
  }
  if (operation.status !== KnowledgeGraphBulkOperationStatus.PREVIEWED) {
    return { ok: false, code: "INVALID_STATUS" };
  }
  if (operation.previewHash !== input.previewHash) {
    return { ok: false, code: "PREVIEW_MISMATCH" };
  }

  await updateKnowledgeGraphBulkOperationStatus({
    id: operation.id,
    status: KnowledgeGraphBulkOperationStatus.CONFIRMED,
  });

  return { ok: true, operationId: operation.id };
}

export type CancelBulkOperationResult =
  | { ok: true }
  | { ok: false; code: "NOT_FOUND" | "INVALID_STATUS" };

/**
 * Cancel a previewed or confirmed bulk operation. Cancellation is only
 * allowed before execution starts, guaranteeing no product data is modified.
 */
export async function cancelBulkOperation(input: {
  shop: string;
  operationId: string;
}): Promise<CancelBulkOperationResult> {
  const operation = await getKnowledgeGraphBulkOperationById(input.operationId, input.shop);
  if (!operation) {
    return { ok: false, code: "NOT_FOUND" };
  }
  if (
    operation.status !== KnowledgeGraphBulkOperationStatus.PREVIEWED &&
    operation.status !== KnowledgeGraphBulkOperationStatus.CONFIRMED
  ) {
    return { ok: false, code: "INVALID_STATUS" };
  }

  await updateKnowledgeGraphBulkOperationStatus({
    id: operation.id,
    status: KnowledgeGraphBulkOperationStatus.CANCELLED,
  });

  return { ok: true };
}

// ---------------------------------------------------------------------------
// T032 — bulk execution orchestrator with per-record result aggregation
// ---------------------------------------------------------------------------

export interface BulkRecordResult {
  productId: string;
  ok: boolean;
  error?: string;
}

export type ExecuteBulkOperationResult =
  | {
      ok: true;
      operationId: string;
      status: "COMPLETED" | "PARTIAL" | "FAILED";
      results: BulkRecordResult[];
    }
  | { ok: false; code: "NOT_FOUND" | "INVALID_STATUS" };

function applyTagDiff(
  operationType: KnowledgeGraphBulkOperationType,
  current: string[],
  payload: { toAdd?: string[]; toRemove?: string[] },
): string[] {
  if (operationType === KnowledgeGraphBulkOperationType.TAG_APPLY) {
    return Array.from(new Set([...current, ...(payload.toAdd ?? [])]));
  }
  if (operationType === KnowledgeGraphBulkOperationType.TAG_REMOVE) {
    const toRemove = new Set(payload.toRemove ?? []);
    return current.filter((t) => !toRemove.has(t));
  }
  // RECLASSIFY: replace outright when an explicit add-set is supplied.
  return payload.toAdd ?? current;
}

export async function executeBulkOperation(input: {
  shop: string;
  operationId: string;
  actorId?: string;
}): Promise<ExecuteBulkOperationResult> {
  const operation = await getKnowledgeGraphBulkOperationById(input.operationId, input.shop);
  if (!operation) {
    return { ok: false, code: "NOT_FOUND" };
  }
  if (operation.status !== KnowledgeGraphBulkOperationStatus.CONFIRMED) {
    return { ok: false, code: "INVALID_STATUS" };
  }

  const snapshotLog = (
    await listKnowledgeGraphChangeLogForEntity({
      shop: input.shop,
      entityType: KnowledgeGraphEntityType.BULK_OPERATION,
      entityId: operation.id,
      take: 1,
    })
  )[0];
  const snapshot = (snapshotLog?.afterSnapshot ?? {}) as {
    productIds?: string[];
    changePayload?: BulkChangePayload;
  };
  const productIds = snapshot.productIds ?? [];
  const changePayload = snapshot.changePayload ?? {};

  await updateKnowledgeGraphBulkOperationStatus({
    id: operation.id,
    status: KnowledgeGraphBulkOperationStatus.RUNNING,
    startedAt: new Date(),
  });

  const results: BulkRecordResult[] = [];

  for (const productId of productIds) {
    try {
      const product = await getProductById(productId);
      if (!product) {
        results.push({ productId, ok: false, error: "Product not found" });
        continue;
      }

      const beforeSnapshot = {
        disciplineTags: product.disciplineTags,
        categoryTags: product.categoryTags,
      };

      const newDisciplineTags = applyTagDiff(operation.operationType, product.disciplineTags, {
        toAdd: changePayload.disciplineTagsToAdd,
        toRemove: changePayload.disciplineTagsToRemove,
      });
      const newCategoryTags = applyTagDiff(operation.operationType, product.categoryTags, {
        toAdd: changePayload.categoryTagsToAdd,
        toRemove: changePayload.categoryTagsToRemove,
      });

      await applyMerchantTaxonomyOverride(product.shopifyProductId, newDisciplineTags, newCategoryTags);

      await createKnowledgeGraphChangeLog({
        shop: input.shop,
        actorId: input.actorId,
        entityType: KnowledgeGraphEntityType.PRODUCT_INTELLIGENCE,
        entityId: productId,
        action: KnowledgeGraphChangeAction.BULK_APPLY,
        beforeSnapshot,
        afterSnapshot: { disciplineTags: newDisciplineTags, categoryTags: newCategoryTags },
        bulkOperationId: operation.id,
      });

      results.push({ productId, ok: true });
    } catch (err) {
      results.push({ productId, ok: false, error: err instanceof Error ? err.message : "Unknown error" });
    }
  }

  const successCount = results.filter((r) => r.ok).length;
  const finalStatus: "COMPLETED" | "PARTIAL" | "FAILED" =
    successCount === results.length
      ? "COMPLETED"
      : successCount === 0
        ? "FAILED"
        : "PARTIAL";

  await updateKnowledgeGraphBulkOperationStatus({
    id: operation.id,
    status: KnowledgeGraphBulkOperationStatus[finalStatus],
    finishedAt: new Date(),
  });

  return { ok: true, operationId: operation.id, status: finalStatus, results };
}
