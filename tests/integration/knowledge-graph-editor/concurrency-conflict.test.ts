/**
 * Integration tests: Knowledge Graph Editor — Stale-write conflict handling (T042)
 *
 * Covers the generic optimistic-concurrency helper and its wiring into the
 * governed size-mapping mutation flow, which is the concrete surface that
 * layers stale-write protection on top of a mutable governance entity.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { SizeConflictSeverity } from "@prisma/client";
import { assertRevisionMatches } from "../../../app/lib/knowledge-graph/editor.concurrency";
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

describe("assertRevisionMatches", () => {
  it("returns null when the requested revision matches the current one", () => {
    const updatedAt = new Date("2026-05-01T00:00:00Z");
    const conflict = assertRevisionMatches({ revision: updatedAt.getTime(), updatedAt }, updatedAt.getTime());
    expect(conflict).toBeNull();
  });

  it("returns a STALE_WRITE conflict with the server's current revision/updatedAt", () => {
    const updatedAt = new Date("2026-05-01T00:00:00Z");
    const conflict = assertRevisionMatches({ revision: updatedAt.getTime(), updatedAt }, updatedAt.getTime() - 1);
    expect(conflict).toEqual(
      expect.objectContaining({
        code: "STALE_WRITE",
        serverRevision: updatedAt.getTime(),
        serverUpdatedAt: updatedAt.toISOString(),
      }),
    );
  });
});

describe("stale-write handling — governed size mapping upsert", () => {
  it("rejects an update carrying an outdated revision without persisting", async () => {
    const updatedAt = new Date("2026-05-02T00:00:00Z");
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

    const result = await upsertGovernedSizeMapping({
      shop: "shop.myshopify.com",
      sourceCategoryTag: "gloves",
      sourceSize: "14oz",
      targetCategoryTag: "handwraps",
      targetSize: "L",
      expectedRevision: updatedAt.getTime() - 60_000,
    });

    expect(result).toEqual(
      expect.objectContaining({
        ok: false,
        code: "STALE_WRITE",
        conflict: expect.objectContaining({ serverRevision: updatedAt.getTime() }),
      }),
    );
    expect(dbQueries.upsertGovernedCrossSizeMapping).not.toHaveBeenCalled();
    expect(dbQueries.createKnowledgeGraphChangeLog).not.toHaveBeenCalled();
  });

  it("succeeds when no expectedRevision is supplied (no concurrency claim made)", async () => {
    const updatedAt = new Date("2026-05-02T00:00:00Z");
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
      severityOnMismatch: SizeConflictSeverity.WARNING,
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
    });

    expect(result.ok).toBe(true);
  });
});

describe("stale-write handling — governed size mapping deactivate", () => {
  it("rejects deletion carrying an outdated revision without deleting", async () => {
    const updatedAt = new Date("2026-05-03T00:00:00Z");
    vi.mocked(dbQueries.getCrossSizeMappingById).mockResolvedValueOnce({
      id: "map_2",
      shop: "shop.myshopify.com",
      sourceCategoryTag: "gloves",
      sourceSize: "16oz",
      targetCategoryTag: "handwraps",
      targetSize: "L",
      severityOnMismatch: SizeConflictSeverity.WARNING,
      source: "MERCHANT",
      createdAt: updatedAt,
      updatedAt,
    } as never);

    const result = await deactivateGovernedSizeMapping({
      shop: "shop.myshopify.com",
      mappingId: "map_2",
      expectedRevision: updatedAt.getTime() - 60_000,
    });

    expect(result).toEqual(
      expect.objectContaining({ ok: false, code: "STALE_WRITE" }),
    );
    expect(dbQueries.deleteCrossSizeMapping).not.toHaveBeenCalled();
  });
});
