import { beforeEach, describe, expect, it, vi } from "vitest";
import { action, loader } from "../../../app/routes/app._index";
import { authenticate } from "../../../app/shopify.server";
import {
  countProductsForShop,
  countProductVariantsForShop,
  getLatestSyncJob,
  getActiveSyncJob,
  getProductsNotYetSynced,
} from "../../../app/lib/db/queries";
import { runCatalogSync } from "../../../app/lib/knowledge-graph/ingestion";

vi.mock("../../../app/shopify.server", () => ({
  authenticate: {
    admin: vi.fn(),
  },
}));

vi.mock("../../../app/lib/db/queries", () => ({
  countProductsForShop: vi.fn(),
  countProductVariantsForShop: vi.fn(),
  getLatestSyncJob: vi.fn(),
  getActiveSyncJob: vi.fn(),
  getProductsNotYetSynced: vi.fn(),
}));

vi.mock("../../../app/lib/knowledge-graph/ingestion", () => ({
  runCatalogSync: vi.fn(),
}));

describe("app._index catalog sync route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads catalog sync overview for the authenticated shop", async () => {
    vi.mocked(authenticate.admin).mockResolvedValueOnce({
      session: { shop: "test.myshopify.com" },
    } as any);
    vi.mocked(countProductsForShop).mockResolvedValueOnce(12);
    vi.mocked(countProductVariantsForShop).mockResolvedValueOnce(18);
    vi.mocked(getLatestSyncJob).mockResolvedValueOnce({
      id: "job_1",
      status: "FAILED",
      syncedCount: 0,
      failedCount: 0,
      totalCount: 0,
      startedAt: new Date("2026-05-19T07:46:11.000Z"),
      completedAt: new Date("2026-05-19T07:47:16.000Z"),
    } as any);
    vi.mocked(getProductsNotYetSynced).mockResolvedValueOnce([]);

    const result = await loader({
      request: new Request("http://localhost/app"),
      params: {},
      context: {},
    } as any);

    expect(countProductsForShop).toHaveBeenCalledWith("test.myshopify.com");
    expect(countProductVariantsForShop).toHaveBeenCalledWith("test.myshopify.com");
    expect(getLatestSyncJob).toHaveBeenCalledWith("test.myshopify.com");
    expect(result).toEqual({
      shop: "test.myshopify.com",
      productCount: 12,
      variantCount: 18,
      latestJob: {
        id: "job_1",
        status: "FAILED",
        syncedCount: 0,
        failedCount: 0,
        totalCount: 0,
        startedAt: "2026-05-19T07:46:11.000Z",
        completedAt: "2026-05-19T07:47:16.000Z",
      },
      unsyncedProducts: [],
    });
  });

  it("runs a manual catalog sync for the authenticated shop", async () => {
    const admin = { graphql: vi.fn() };
    vi.mocked(authenticate.admin).mockResolvedValueOnce({
      admin,
      session: { shop: "test.myshopify.com" },
    } as any);
    vi.mocked(getActiveSyncJob).mockResolvedValueOnce(null);
    vi.mocked(runCatalogSync).mockResolvedValueOnce(undefined);

    const request = new Request("http://localhost/app", {
      method: "POST",
      body: new URLSearchParams({ intent: "sync-catalog" }),
    });

    const result = await action({ request, params: {}, context: {} } as any);

    expect(runCatalogSync).toHaveBeenCalledWith(admin, "test.myshopify.com");
    expect(result).toEqual({ ok: true, started: true });
  });

  it("rejects unknown form actions", async () => {
    vi.mocked(authenticate.admin).mockResolvedValueOnce({
      admin: {},
      session: { shop: "test.myshopify.com" },
    } as any);

    const request = new Request("http://localhost/app", {
      method: "POST",
      body: new URLSearchParams({ intent: "unknown" }),
    });

    const result = await action({ request, params: {}, context: {} } as any);

    expect(runCatalogSync).not.toHaveBeenCalled();
    expect(result).toEqual({ ok: false, error: "Unknown action" });
  });
});