/**
 * Unit tests: Knowledge Graph Editor — Size mapping validation (T028)
 *
 * Covers:
 *  - Contradiction detection (self-mapping, reciprocal mismatch)
 *  - Governed upsert: contradiction rejection, revision-checked update, create
 *  - Governed deactivate: not-found, stale-write rejection, success
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { SizeConflictSeverity } from "@prisma/client";
import {
  detectSizeMappingContradictions,
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
  getCrossSizeMappingsForShop: vi.fn(),
  upsertGovernedCrossSizeMapping: vi.fn(),
  deleteCrossSizeMapping: vi.fn(),
  createKnowledgeGraphChangeLog: vi.fn().mockResolvedValue({ id: "log_1" }),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// detectSizeMappingContradictions
// ---------------------------------------------------------------------------

describe("detectSizeMappingContradictions", () => {
  it("rejects self-mapping (same source/target category)", () => {
    const contradictions = detectSizeMappingContradictions(
      { sourceCategoryTag: "tops", sourceSize: "M", targetCategoryTag: "tops", targetSize: "M" },
      [],
    );
    expect(contradictions.some((c) => c.code === "SAME_CATEGORY")).toBe(true);
  });

  it("rejects a reciprocal mapping that maps back to a different size", () => {
    const existing = [
      { sourceCategoryTag: "bottoms", sourceSize: "M", targetCategoryTag: "tops", targetSize: "L" },
    ];
    const contradictions = detectSizeMappingContradictions(
      { sourceCategoryTag: "tops", sourceSize: "S", targetCategoryTag: "bottoms", targetSize: "M" },
      existing,
    );
    expect(contradictions.some((c) => c.code === "RECIPROCAL_MISMATCH")).toBe(true);
  });

  it("returns no contradictions for a valid, non-conflicting mapping", () => {
    const contradictions = detectSizeMappingContradictions(
      { sourceCategoryTag: "tops", sourceSize: "M", targetCategoryTag: "bottoms", targetSize: "L" },
      [],
    );
    expect(contradictions).toHaveLength(0);
  });

  it("does not flag a consistent reciprocal mapping", () => {
    const existing = [
      { sourceCategoryTag: "bottoms", sourceSize: "L", targetCategoryTag: "tops", targetSize: "M" },
    ];
    const contradictions = detectSizeMappingContradictions(
      { sourceCategoryTag: "tops", sourceSize: "M", targetCategoryTag: "bottoms", targetSize: "L" },
      existing,
    );
    expect(contradictions).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// upsertGovernedSizeMapping
// ---------------------------------------------------------------------------

describe("upsertGovernedSizeMapping", () => {
  it("rejects with VALIDATION when a contradiction is detected", async () => {
    vi.mocked(dbQueries.getCrossSizeMappingsForShop).mockResolvedValueOnce([]);

    const result = await upsertGovernedSizeMapping({
      shop: "shop.myshopify.com",
      sourceCategoryTag: "tops",
      sourceSize: "M",
      targetCategoryTag: "tops",
      targetSize: "M",
    });

    expect(result.ok).toBe(false);
    if (!result.ok && result.code === "VALIDATION") {
      expect(result.contradictions.length).toBeGreaterThan(0);
    } else {
      throw new Error("Expected VALIDATION result");
    }
    expect(dbQueries.upsertGovernedCrossSizeMapping).not.toHaveBeenCalled();
  });

  it("rejects with STALE_WRITE when expectedRevision does not match", async () => {
    const updatedAt = new Date("2026-01-01T00:00:00Z");
    vi.mocked(dbQueries.getCrossSizeMappingsForShop).mockResolvedValueOnce([
      {
        id: "map_1",
        shop: "shop.myshopify.com",
        sourceCategoryTag: "tops",
        sourceSize: "M",
        targetCategoryTag: "bottoms",
        targetSize: "L",
        severityOnMismatch: SizeConflictSeverity.WARNING,
        source: "MERCHANT",
        createdAt: updatedAt,
        updatedAt,
      } as never,
    ]);

    const result = await upsertGovernedSizeMapping({
      shop: "shop.myshopify.com",
      sourceCategoryTag: "tops",
      sourceSize: "M",
      targetCategoryTag: "bottoms",
      targetSize: "XL",
      expectedRevision: updatedAt.getTime() - 1000,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("STALE_WRITE");
    }
    expect(dbQueries.upsertGovernedCrossSizeMapping).not.toHaveBeenCalled();
  });

  it("creates a mapping and writes a change-log CREATE entry", async () => {
    vi.mocked(dbQueries.getCrossSizeMappingsForShop).mockResolvedValueOnce([]);
    vi.mocked(dbQueries.upsertGovernedCrossSizeMapping).mockResolvedValueOnce({
      id: "map_new",
      shop: "shop.myshopify.com",
      sourceCategoryTag: "tops",
      sourceSize: "M",
      targetCategoryTag: "bottoms",
      targetSize: "L",
      severityOnMismatch: SizeConflictSeverity.WARNING,
      source: "MERCHANT",
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never);

    const result = await upsertGovernedSizeMapping({
      shop: "shop.myshopify.com",
      sourceCategoryTag: "tops",
      sourceSize: "M",
      targetCategoryTag: "bottoms",
      targetSize: "L",
    });

    expect(result.ok).toBe(true);
    expect(dbQueries.createKnowledgeGraphChangeLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "CREATE" }),
    );
  });
});

// ---------------------------------------------------------------------------
// deactivateGovernedSizeMapping
// ---------------------------------------------------------------------------

describe("deactivateGovernedSizeMapping", () => {
  it("returns NOT_FOUND when the mapping does not exist for the shop", async () => {
    vi.mocked(dbQueries.getCrossSizeMappingById).mockResolvedValueOnce(null);

    const result = await deactivateGovernedSizeMapping({ shop: "shop.myshopify.com", mappingId: "missing" });

    expect(result).toEqual({ ok: false, code: "NOT_FOUND" });
    expect(dbQueries.deleteCrossSizeMapping).not.toHaveBeenCalled();
  });

  it("rejects with STALE_WRITE when the revision no longer matches", async () => {
    const updatedAt = new Date("2026-02-01T00:00:00Z");
    vi.mocked(dbQueries.getCrossSizeMappingById).mockResolvedValueOnce({
      id: "map_1",
      shop: "shop.myshopify.com",
      sourceCategoryTag: "tops",
      sourceSize: "M",
      targetCategoryTag: "bottoms",
      targetSize: "L",
      severityOnMismatch: SizeConflictSeverity.WARNING,
      source: "MERCHANT",
      createdAt: updatedAt,
      updatedAt,
    } as never);

    const result = await deactivateGovernedSizeMapping({
      shop: "shop.myshopify.com",
      mappingId: "map_1",
      expectedRevision: updatedAt.getTime() - 1000,
    });

    expect(result).toEqual(expect.objectContaining({ ok: false, code: "STALE_WRITE" }));
    expect(dbQueries.deleteCrossSizeMapping).not.toHaveBeenCalled();
  });

  it("deletes the mapping and writes a DEACTIVATE change-log entry on success", async () => {
    const updatedAt = new Date("2026-02-01T00:00:00Z");
    vi.mocked(dbQueries.getCrossSizeMappingById).mockResolvedValueOnce({
      id: "map_1",
      shop: "shop.myshopify.com",
      sourceCategoryTag: "tops",
      sourceSize: "M",
      targetCategoryTag: "bottoms",
      targetSize: "L",
      severityOnMismatch: SizeConflictSeverity.WARNING,
      source: "MERCHANT",
      createdAt: updatedAt,
      updatedAt,
    } as never);

    const result = await deactivateGovernedSizeMapping({
      shop: "shop.myshopify.com",
      mappingId: "map_1",
      expectedRevision: updatedAt.getTime(),
    });

    expect(result).toEqual({ ok: true });
    expect(dbQueries.deleteCrossSizeMapping).toHaveBeenCalledWith("map_1");
    expect(dbQueries.createKnowledgeGraphChangeLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "DEACTIVATE" }),
    );
  });
});
