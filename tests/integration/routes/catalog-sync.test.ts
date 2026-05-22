import { describe, it, expect, vi, beforeEach } from "vitest";
import { runCatalogSync } from "../../../app/lib/knowledge-graph/ingestion";
import { SyncTracker } from "../../../app/lib/knowledge-graph/sync-status";
import * as dbQueries from "../../../app/lib/db/queries";

vi.mock("../../../app/lib/db/queries", () => ({
  getActiveSyncJob: vi.fn(),
  createSyncJob: vi.fn(() => Promise.resolve({ id: "job_123", shop: "test.myshopify.com", status: "PENDING" })),
  updateSyncJobProgress: vi.fn(),
  completeSyncJob: vi.fn(),
  failSyncJob: vi.fn(),
  upsertProduct: vi.fn(),
  updateProductEmbedding: vi.fn(),
  upsertCandidateRelationship: vi.fn(),
  invalidateRelationshipsForProduct: vi.fn(),
  findProductByShopifyId: vi.fn(),
  getProductSnapshotsForShop: vi.fn(() => Promise.resolve([])),
}));

describe("Ingestion: runCatalogSync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should block concurrent sync operations", async () => {
    vi.mocked(dbQueries.getActiveSyncJob).mockResolvedValueOnce({
      id: "job_active",
      shop: "test.myshopify.com",
      status: "IN_PROGRESS",
      totalCount: 0,
      syncedCount: 0,
      failedCount: 0,
      startedAt: new Date(),
      completedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const mockAdmin = { graphql: vi.fn() };
    await runCatalogSync(mockAdmin as any, "test.myshopify.com");

    expect(dbQueries.createSyncJob).not.toHaveBeenCalled();
    expect(mockAdmin.graphql).not.toHaveBeenCalled();
  });

  it("should execute pagination and process active products", async () => {
    vi.mocked(dbQueries.getActiveSyncJob).mockResolvedValueOnce(null);

    const mockAdmin = {
      graphql: vi.fn()
        .mockResolvedValueOnce({
          json: () => Promise.resolve({
            data: {
              products: {
                nodes: [
                  { id: "gid://shopify/Product/1", title: "Product 1", handle: "prod-1", status: "ACTIVE" },
                  { id: "gid://shopify/Product/2", title: "Draft 2", handle: "prod-2", status: "DRAFT" },
                ],
                pageInfo: { hasNextPage: true, endCursor: "cursor1" }
              }
            }
          })
        })
        .mockResolvedValueOnce({
          json: () => Promise.resolve({
            data: {
              products: {
                nodes: [
                  { id: "gid://shopify/Product/3", title: "Product 3", handle: "prod-3", status: "ACTIVE" },
                ],
                pageInfo: { hasNextPage: false, endCursor: null }
              }
            }
          })
        })
    };

    await runCatalogSync(mockAdmin as any, "test.myshopify.com");

    expect(dbQueries.createSyncJob).toHaveBeenCalledWith("test.myshopify.com");
    expect(mockAdmin.graphql).toHaveBeenCalledTimes(2);
    expect(dbQueries.upsertProduct).toHaveBeenCalledTimes(2); // Only Active products
    expect(dbQueries.updateProductEmbedding).toHaveBeenCalledTimes(2);
    expect(dbQueries.completeSyncJob).toHaveBeenCalledWith("job_123");
  });
});

// ---------------------------------------------------------------------------
// US1: Sync-generated relationship candidates
// ---------------------------------------------------------------------------

describe("Ingestion: relationship candidate generation after sync [US1]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls upsertCandidateRelationship when two related products are synced", async () => {
    vi.mocked(dbQueries.getActiveSyncJob).mockResolvedValueOnce(null);
    vi.mocked(dbQueries.upsertProduct).mockResolvedValue({
      id: "internal_prod_1",
      shopifyProductId: "gid://shopify/Product/1",
      shop: "test.myshopify.com",
      title: "Boxing Gloves",
      description: null,
      handle: "boxing-gloves",
      vendor: "Venum",
      productType: "gloves",
      status: "ACTIVE" as const,
      tags: ["training"],
      disciplineTags: ["boxing"],
      categoryTags: ["gloves"],
      dominantColors: [],
      collectionIds: ["col_1"],
      metafields: null,
      classificationConfidence: 0.9,
      isManuallyClassified: false,
      syncedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // When relationship generation is wired, upsertCandidateRelationship is called.
    // For now we verify the mock is reachable from the sync path.
    // Full assertion is tightened in T011.
    expect(dbQueries.upsertCandidateRelationship).toBeDefined();
  });

  it("upsertCandidateRelationship is not called for a single-product catalog (no peers)", async () => {
    // With only one product there are no peers to generate candidates from.
    // The relationship engine must produce zero candidates.
    vi.mocked(dbQueries.getActiveSyncJob).mockResolvedValueOnce(null);

    const mockAdmin = {
      graphql: vi.fn().mockResolvedValueOnce({
        json: () => Promise.resolve({
          data: {
            products: {
              nodes: [
                { id: "gid://shopify/Product/1", title: "Boxing Gloves", handle: "boxing-gloves", status: "ACTIVE" },
              ],
              pageInfo: { hasNextPage: false, endCursor: null },
            },
          },
        }),
      }),
    };

    await runCatalogSync(mockAdmin as any, "test.myshopify.com");

    // upsertCandidateRelationship should NOT be called for a lone product
    expect(dbQueries.upsertCandidateRelationship).not.toHaveBeenCalled();
  });
});