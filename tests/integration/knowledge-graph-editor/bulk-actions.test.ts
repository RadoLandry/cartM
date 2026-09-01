/**
 * Integration tests: Knowledge Graph Editor — Bulk actions (T037)
 *
 * Covers the preview -> confirm -> execute and preview -> cancel lifecycles:
 *  - Confirm succeeds only when the preview hash matches and applies changes
 *  - Cancel transitions a previewed operation to CANCELLED with no product mutation
 *  - Confirming with a stale/mismatched preview hash is rejected
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { KnowledgeGraphBulkOperationType, KnowledgeGraphBulkOperationStatus } from "@prisma/client";
import {
  previewBulkOperation,
  confirmBulkOperation,
  cancelBulkOperation,
  executeBulkOperation,
} from "../../../app/lib/knowledge-graph/editor.bulk";
import * as dbQueries from "../../../app/lib/db/queries";

vi.mock("../../../app/lib/db/queries", () => ({
  applyMerchantTaxonomyOverride: vi.fn().mockResolvedValue({ count: 1 }),
  createKnowledgeGraphBulkOperation: vi.fn(),
  createKnowledgeGraphChangeLog: vi.fn().mockResolvedValue({ id: "log_1" }),
  getKnowledgeGraphBulkOperationById: vi.fn(),
  getProductById: vi.fn(),
  getProductsWithTaxonomy: vi.fn(),
  listKnowledgeGraphChangeLogForEntity: vi.fn(),
  updateKnowledgeGraphBulkOperationStatus: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("preview -> confirm -> execute", () => {
  it("confirms and applies changes when the preview hash matches", async () => {
    vi.mocked(dbQueries.getProductsWithTaxonomy).mockResolvedValueOnce([
      { id: "p1", shopifyProductId: "gid://1", title: "Gloves", handle: "gloves", disciplineTags: ["boxing"], categoryTags: ["gloves"], classificationConfidence: 1, isManuallyClassified: true },
    ] as never);
    vi.mocked(dbQueries.createKnowledgeGraphBulkOperation).mockResolvedValueOnce({
      id: "op_1",
      shop: "shop.myshopify.com",
      operationType: KnowledgeGraphBulkOperationType.TAG_APPLY,
      targetCount: 1,
      previewHash: "will-be-overwritten",
      initiatedBy: "admin_1",
      status: KnowledgeGraphBulkOperationStatus.PREVIEWED,
      startedAt: null,
      finishedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never);

    const preview = await previewBulkOperation({
      shop: "shop.myshopify.com",
      operationType: KnowledgeGraphBulkOperationType.TAG_APPLY,
      filter: { categoryTags: ["gloves"] },
      changePayload: { categoryTagsToAdd: ["sale"] },
      initiatedBy: "admin_1",
    });

    expect(preview.ok).toBe(true);
    if (!preview.ok) throw new Error("expected preview to succeed");

    vi.mocked(dbQueries.getKnowledgeGraphBulkOperationById).mockResolvedValue({
      id: "op_1",
      shop: "shop.myshopify.com",
      operationType: KnowledgeGraphBulkOperationType.TAG_APPLY,
      targetCount: 1,
      previewHash: preview.previewHash,
      initiatedBy: "admin_1",
      status: KnowledgeGraphBulkOperationStatus.PREVIEWED,
      startedAt: null,
      finishedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never);

    const confirmResult = await confirmBulkOperation({
      shop: "shop.myshopify.com",
      operationId: preview.operationId,
      previewHash: preview.previewHash,
    });
    expect(confirmResult).toEqual({ ok: true, operationId: "op_1" });
    expect(dbQueries.updateKnowledgeGraphBulkOperationStatus).toHaveBeenCalledWith(
      expect.objectContaining({ status: KnowledgeGraphBulkOperationStatus.CONFIRMED }),
    );

    // Execute reads the operation as CONFIRMED and the preview snapshot.
    vi.mocked(dbQueries.getKnowledgeGraphBulkOperationById).mockResolvedValueOnce({
      id: "op_1",
      shop: "shop.myshopify.com",
      operationType: KnowledgeGraphBulkOperationType.TAG_APPLY,
      targetCount: 1,
      previewHash: preview.previewHash,
      initiatedBy: "admin_1",
      status: KnowledgeGraphBulkOperationStatus.CONFIRMED,
      startedAt: null,
      finishedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never);
    vi.mocked(dbQueries.listKnowledgeGraphChangeLogForEntity).mockResolvedValueOnce([
      { afterSnapshot: { productIds: ["p1"], changePayload: { categoryTagsToAdd: ["sale"] } } },
    ] as never);
    vi.mocked(dbQueries.getProductById).mockResolvedValueOnce({
      id: "p1",
      shop: "shop.myshopify.com",
      shopifyProductId: "gid://1",
      title: "Gloves",
      disciplineTags: ["boxing"],
      categoryTags: ["gloves"],
    } as never);

    const executeResult = await executeBulkOperation({ shop: "shop.myshopify.com", operationId: "op_1" });

    expect(executeResult.ok).toBe(true);
    if (executeResult.ok) {
      expect(executeResult.status).toBe("COMPLETED");
      expect(dbQueries.applyMerchantTaxonomyOverride).toHaveBeenCalledWith("gid://1", ["boxing"], ["gloves", "sale"]);
    }
  });

  it("rejects confirmation when the preview hash no longer matches", async () => {
    vi.mocked(dbQueries.getKnowledgeGraphBulkOperationById).mockResolvedValueOnce({
      id: "op_2",
      shop: "shop.myshopify.com",
      operationType: KnowledgeGraphBulkOperationType.TAG_APPLY,
      targetCount: 1,
      previewHash: "original-hash",
      initiatedBy: "admin_1",
      status: KnowledgeGraphBulkOperationStatus.PREVIEWED,
      startedAt: null,
      finishedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never);

    const result = await confirmBulkOperation({
      shop: "shop.myshopify.com",
      operationId: "op_2",
      previewHash: "stale-hash",
    });

    expect(result).toEqual({ ok: false, code: "PREVIEW_MISMATCH" });
    expect(dbQueries.updateKnowledgeGraphBulkOperationStatus).not.toHaveBeenCalled();
  });
});

describe("preview -> cancel guarantees no persisted changes", () => {
  it("cancels a previewed operation without ever applying product mutations", async () => {
    vi.mocked(dbQueries.getKnowledgeGraphBulkOperationById).mockResolvedValueOnce({
      id: "op_3",
      shop: "shop.myshopify.com",
      operationType: KnowledgeGraphBulkOperationType.TAG_APPLY,
      targetCount: 3,
      previewHash: "hash-3",
      initiatedBy: "admin_1",
      status: KnowledgeGraphBulkOperationStatus.PREVIEWED,
      startedAt: null,
      finishedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never);

    const result = await cancelBulkOperation({ shop: "shop.myshopify.com", operationId: "op_3" });

    expect(result).toEqual({ ok: true });
    expect(dbQueries.updateKnowledgeGraphBulkOperationStatus).toHaveBeenCalledWith(
      expect.objectContaining({ status: KnowledgeGraphBulkOperationStatus.CANCELLED }),
    );
    expect(dbQueries.applyMerchantTaxonomyOverride).not.toHaveBeenCalled();
  });

  it("refuses to cancel an operation that has already completed", async () => {
    vi.mocked(dbQueries.getKnowledgeGraphBulkOperationById).mockResolvedValueOnce({
      id: "op_4",
      shop: "shop.myshopify.com",
      operationType: KnowledgeGraphBulkOperationType.TAG_APPLY,
      targetCount: 1,
      previewHash: "hash-4",
      initiatedBy: "admin_1",
      status: KnowledgeGraphBulkOperationStatus.COMPLETED,
      startedAt: new Date(),
      finishedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never);

    const result = await cancelBulkOperation({ shop: "shop.myshopify.com", operationId: "op_4" });

    expect(result).toEqual({ ok: false, code: "INVALID_STATUS" });
  });
});
