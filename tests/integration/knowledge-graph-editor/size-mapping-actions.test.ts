/**
 * Integration tests: Knowledge Graph Editor — Size mapping actions (T029)
 *
 * Covers the governed size-mapping CRUD flow end-to-end at the service layer:
 *  - Valid create/update persists and returns ok
 *  - Contradictory input is rejected with structured field errors
 *  - Stale-write conflicts are rejected without mutating persisted data
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { SizeConflictSeverity } from "@prisma/client";
import {
  upsertGovernedSizeMapping,
  deactivateGovernedSizeMapping,
} from "../../../app/lib/knowledge-graph/sizing";
import * as dbQueries from "../../../app/lib/db/queries";

vi.mock("../../../app/lib/db/queries", () => ({
  getSizeChartForCategory: vi.fn(),
  getUnprocessedReturnsByCategoryForShop: vi.fn(),
  markReturnRecordsProcessed: vi.fn(),
  upsertSizeChart: vi.fn(),
  getCrossSizeMappingById: vi.fn(),
  getCrossSizeMappingsForShop: vi.fn().mockResolvedValue([]),
  upsertGovernedCrossSizeMapping: vi.fn(),
  deleteCrossSizeMapping: vi.fn(),
  createKnowledgeGraphChangeLog: vi.fn().mockResolvedValue({ id: "log_1" }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(dbQueries.getCrossSizeMappingsForShop).mockResolvedValue([]);
});

describe("size mapping CRUD — valid create/update persists", () => {
  it("creates a new mapping and logs an audit CREATE entry", async () => {
    vi.mocked(dbQueries.upsertGovernedCrossSizeMapping).mockResolvedValueOnce({
      id: "map_1",
      shop: "shop.myshopify.com",
      sourceCategoryTag: "gloves",
      sourceSize: "14oz",
      targetCategoryTag: "handwraps",
      targetSize: "M",
      severityOnMismatch: SizeConflictSeverity.WARNING,
      source: "MERCHANT",
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never);

    const result = await upsertGovernedSizeMapping({
      shop: "shop.myshopify.com",
      actorId: "admin_1",
      sourceCategoryTag: "gloves",
      sourceSize: "14oz",
      targetCategoryTag: "handwraps",
      targetSize: "M",
    });

    expect(result.ok).toBe(true);
    expect(dbQueries.upsertGovernedCrossSizeMapping).toHaveBeenCalledWith(
      expect.objectContaining({ sourceCategoryTag: "gloves", targetCategoryTag: "handwraps" }),
    );
    expect(dbQueries.createKnowledgeGraphChangeLog).toHaveBeenCalledWith(
      expect.objectContaining({ actorId: "admin_1", action: "CREATE" }),
    );
  });

  it("updates an existing mapping when the revision matches", async () => {
    const updatedAt = new Date("2026-03-01T00:00:00Z");
    vi.mocked(dbQueries.getCrossSizeMappingsForShop).mockResolvedValueOnce([
      {
        id: "map_1",
        shop: "shop.myshopify.com",
        sourceCategoryTag: "gloves",
        sourceSize: "14oz",
        targetCategoryTag: "handwraps",
        targetSize: "M",
        severityOnMismatch: SizeConflictSeverity.WARNING,
        source: "MERCHANT",
        createdAt: updatedAt,
        updatedAt,
      } as never,
    ]);
    vi.mocked(dbQueries.upsertGovernedCrossSizeMapping).mockResolvedValueOnce({
      id: "map_1",
      shop: "shop.myshopify.com",
      sourceCategoryTag: "gloves",
      sourceSize: "14oz",
      targetCategoryTag: "handwraps",
      targetSize: "L",
      severityOnMismatch: SizeConflictSeverity.ERROR,
      source: "MERCHANT",
      createdAt: updatedAt,
      updatedAt: new Date(),
    } as never);

    const result = await upsertGovernedSizeMapping({
      shop: "shop.myshopify.com",
      sourceCategoryTag: "gloves",
      sourceSize: "14oz",
      targetCategoryTag: "handwraps",
      targetSize: "L",
      severityOnMismatch: SizeConflictSeverity.ERROR,
      expectedRevision: updatedAt.getTime(),
    });

    expect(result.ok).toBe(true);
    expect(dbQueries.createKnowledgeGraphChangeLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "UPDATE" }),
    );
  });
});

describe("size mapping CRUD — contradictory input is rejected", () => {
  it("rejects a self-mapping with a structured field error and never persists", async () => {
    const result = await upsertGovernedSizeMapping({
      shop: "shop.myshopify.com",
      sourceCategoryTag: "gloves",
      sourceSize: "14oz",
      targetCategoryTag: "gloves",
      targetSize: "16oz",
    });

    expect(result.ok).toBe(false);
    if (!result.ok && result.code === "VALIDATION") {
      expect(result.contradictions[0]).toEqual(
        expect.objectContaining({ field: "targetCategoryTag", code: "SAME_CATEGORY" }),
      );
    } else {
      throw new Error("Expected VALIDATION result");
    }
    expect(dbQueries.upsertGovernedCrossSizeMapping).not.toHaveBeenCalled();
    expect(dbQueries.createKnowledgeGraphChangeLog).not.toHaveBeenCalled();
  });

  it("rejects a reciprocal contradiction against an existing rule", async () => {
    vi.mocked(dbQueries.getCrossSizeMappingsForShop).mockResolvedValueOnce([
      { sourceCategoryTag: "handwraps", sourceSize: "L", targetCategoryTag: "gloves", targetSize: "16oz" } as never,
    ]);

    const result = await upsertGovernedSizeMapping({
      shop: "shop.myshopify.com",
      sourceCategoryTag: "gloves",
      sourceSize: "14oz",
      targetCategoryTag: "handwraps",
      targetSize: "L",
    });

    expect(result.ok).toBe(false);
    if (!result.ok && result.code === "VALIDATION") {
      expect(result.contradictions[0].code).toBe("RECIPROCAL_MISMATCH");
    } else {
      throw new Error("Expected VALIDATION result");
    }
    expect(dbQueries.upsertGovernedCrossSizeMapping).not.toHaveBeenCalled();
  });
});

describe("size mapping CRUD — stale-write conflict semantics", () => {
  it("rejects deactivation with STALE_WRITE and never deletes when revision is outdated", async () => {
    const updatedAt = new Date("2026-04-01T00:00:00Z");
    vi.mocked(dbQueries.getCrossSizeMappingById).mockResolvedValueOnce({
      id: "map_1",
      shop: "shop.myshopify.com",
      sourceCategoryTag: "gloves",
      sourceSize: "14oz",
      targetCategoryTag: "handwraps",
      targetSize: "M",
      severityOnMismatch: SizeConflictSeverity.WARNING,
      source: "MERCHANT",
      createdAt: updatedAt,
      updatedAt,
    } as never);

    const result = await deactivateGovernedSizeMapping({
      shop: "shop.myshopify.com",
      mappingId: "map_1",
      expectedRevision: updatedAt.getTime() - 5000,
    });

    expect(result).toEqual(expect.objectContaining({ ok: false, code: "STALE_WRITE" }));
    expect(dbQueries.deleteCrossSizeMapping).not.toHaveBeenCalled();
  });
});
