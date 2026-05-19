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
    expect(dbQueries.completeSyncJob).toHaveBeenCalledWith("job_123");
  });
});