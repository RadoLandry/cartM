/**
 * Unit tests: Knowledge Graph Editor — Bulk operations (T036)
 *
 * Covers:
 *  - Preview-hash determinism and sensitivity to inputs
 *  - Target selection resolver filtering
 *  - Aggregate status transitions (COMPLETED / PARTIAL / FAILED)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { KnowledgeGraphBulkOperationType, KnowledgeGraphBulkOperationStatus } from "@prisma/client";
import {
  computeBulkPreviewHash,
  resolveBulkTargetSelection,
  executeBulkOperation,
} from "../../../app/lib/knowledge-graph/editor.bulk";
import * as dbQueries from "../../../app/lib/db/queries";

vi.mock("../../../app/lib/db/queries", () => ({
  applyMerchantTaxonomyOverride: vi.fn().mockResolvedValue({ count: 1 }),
  createKnowledgeGraphBulkOperation: vi.fn(),
  createKnowledgeGraphChangeLog: vi.fn().mockResolvedValue({ id: "log_1" }),
  getKnowledgeGraphBulkOperationById: vi.fn(),
  getProductById: vi.fn(),
  getProductsWithTaxonomy: vi.fn().mockResolvedValue([]),
  listKnowledgeGraphChangeLogForEntity: vi.fn(),
  updateKnowledgeGraphBulkOperationStatus: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// computeBulkPreviewHash
// ---------------------------------------------------------------------------

describe("computeBulkPreviewHash", () => {
  it("is deterministic and independent of productId ordering", () => {
    const a = computeBulkPreviewHash({
      operationType: KnowledgeGraphBulkOperationType.TAG_APPLY,
      productIds: ["p1", "p2", "p3"],
      changePayload: { categoryTagsToAdd: ["sale"] },
    });
    const b = computeBulkPreviewHash({
      operationType: KnowledgeGraphBulkOperationType.TAG_APPLY,
      productIds: ["p3", "p1", "p2"],
      changePayload: { categoryTagsToAdd: ["sale"] },
    });
    expect(a).toBe(b);
  });

  it("changes when the change payload differs", () => {
    const a = computeBulkPreviewHash({
      operationType: KnowledgeGraphBulkOperationType.TAG_APPLY,
      productIds: ["p1"],
      changePayload: { categoryTagsToAdd: ["sale"] },
    });
    const b = computeBulkPreviewHash({
      operationType: KnowledgeGraphBulkOperationType.TAG_APPLY,
      productIds: ["p1"],
      changePayload: { categoryTagsToAdd: ["clearance"] },
    });
    expect(a).not.toBe(b);
  });
});

// ---------------------------------------------------------------------------
// resolveBulkTargetSelection
// ---------------------------------------------------------------------------

describe("resolveBulkTargetSelection", () => {
  it("filters candidates by category and discipline tags", async () => {
    vi.mocked(dbQueries.getProductsWithTaxonomy).mockResolvedValueOnce([
      { id: "p1", shopifyProductId: "gid://1", title: "A", handle: "a", disciplineTags: ["boxing"], categoryTags: ["gloves"], classificationConfidence: 1, isManuallyClassified: true },
      { id: "p2", shopifyProductId: "gid://2", title: "B", handle: "b", disciplineTags: ["mma"], categoryTags: ["shorts"], classificationConfidence: 1, isManuallyClassified: true },
    ] as never);

    const snapshot = await resolveBulkTargetSelection("shop.myshopify.com", { categoryTags: ["gloves"] });

    expect(snapshot.productIds).toEqual(["p1"]);
  });

  it("returns a deterministic sorted product id list", async () => {
    vi.mocked(dbQueries.getProductsWithTaxonomy).mockResolvedValueOnce([
      { id: "p9", shopifyProductId: "gid://9", title: "Z", handle: "z", disciplineTags: [], categoryTags: [], classificationConfidence: 1, isManuallyClassified: true },
      { id: "p1", shopifyProductId: "gid://1", title: "A", handle: "a", disciplineTags: [], categoryTags: [], classificationConfidence: 1, isManuallyClassified: true },
    ] as never);

    const snapshot = await resolveBulkTargetSelection("shop.myshopify.com", {});

    expect(snapshot.productIds).toEqual(["p1", "p9"]);
  });
});

// ---------------------------------------------------------------------------
// executeBulkOperation — aggregate status transitions
// ---------------------------------------------------------------------------

describe("executeBulkOperation — aggregate status", () => {
  function mockOperation(overrides: Partial<{ status: KnowledgeGraphBulkOperationStatus }> = {}) {
    return {
      id: "op_1",
      shop: "shop.myshopify.com",
      operationType: KnowledgeGraphBulkOperationType.TAG_APPLY,
      targetCount: 2,
      previewHash: "hash",
      initiatedBy: null,
      status: KnowledgeGraphBulkOperationStatus.CONFIRMED,
      startedAt: null,
      finishedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    };
  }

  it("returns INVALID_STATUS when the operation is not CONFIRMED", async () => {
    vi.mocked(dbQueries.getKnowledgeGraphBulkOperationById).mockResolvedValueOnce(
      mockOperation({ status: KnowledgeGraphBulkOperationStatus.PREVIEWED }) as never,
    );

    const result = await executeBulkOperation({ shop: "shop.myshopify.com", operationId: "op_1" });

    expect(result).toEqual({ ok: false, code: "INVALID_STATUS" });
  });

  it("aggregates to COMPLETED when all records succeed", async () => {
    vi.mocked(dbQueries.getKnowledgeGraphBulkOperationById).mockResolvedValueOnce(mockOperation() as never);
    vi.mocked(dbQueries.listKnowledgeGraphChangeLogForEntity).mockResolvedValueOnce([
      { afterSnapshot: { productIds: ["p1", "p2"], changePayload: { categoryTagsToAdd: ["sale"] } } },
    ] as never);
    vi.mocked(dbQueries.getProductById).mockImplementation(async (id: string) => ({
      id,
      shop: "shop.myshopify.com",
      shopifyProductId: `gid://${id}`,
      title: id,
      disciplineTags: [],
      categoryTags: [],
    }) as never);

    const result = await executeBulkOperation({ shop: "shop.myshopify.com", operationId: "op_1" });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.status).toBe("COMPLETED");
      expect(result.results).toHaveLength(2);
    }
  });

  it("aggregates to PARTIAL when some records fail", async () => {
    vi.mocked(dbQueries.getKnowledgeGraphBulkOperationById).mockResolvedValueOnce(mockOperation() as never);
    vi.mocked(dbQueries.listKnowledgeGraphChangeLogForEntity).mockResolvedValueOnce([
      { afterSnapshot: { productIds: ["p1", "p2"], changePayload: {} } },
    ] as never);
    vi.mocked(dbQueries.getProductById).mockImplementation(async (id: string) =>
      id === "p1"
        ? ({ id, shop: "shop.myshopify.com", shopifyProductId: "gid://1", title: "A", disciplineTags: [], categoryTags: [] } as never)
        : null,
    );

    const result = await executeBulkOperation({ shop: "shop.myshopify.com", operationId: "op_1" });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.status).toBe("PARTIAL");
    }
  });

  it("aggregates to FAILED when every record fails", async () => {
    vi.mocked(dbQueries.getKnowledgeGraphBulkOperationById).mockResolvedValueOnce(mockOperation() as never);
    vi.mocked(dbQueries.listKnowledgeGraphChangeLogForEntity).mockResolvedValueOnce([
      { afterSnapshot: { productIds: ["p1"], changePayload: {} } },
    ] as never);
    vi.mocked(dbQueries.getProductById).mockResolvedValueOnce(null);

    const result = await executeBulkOperation({ shop: "shop.myshopify.com", operationId: "op_1" });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.status).toBe("FAILED");
    }
  });
});
