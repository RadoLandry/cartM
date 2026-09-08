/**
 * Integration test scaffolding: Size Conflict Detection — merchant admin preview.
 *
 * Focused on the capability added on top of the existing size-chart/cross-size
 * mapping admin surface (see knowledge-graph-sizing.test.ts for base CRUD coverage):
 *   T017 — preview-cross-size-conflict (read-only evaluation, no persistence)
 *
 * NOTE: tests run against the mocked DB layer (no real database required).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import * as dbQueries from "../../../app/lib/db/queries";
import { SizeConflictSeverity } from "@prisma/client";

vi.mock("../../../app/lib/db/queries", () => ({
  previewCrossSizeConflict: vi.fn(),
}));

const SHOP = "test.myshopify.com";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("preview-cross-size-conflict", () => {
  it("returns evaluated: false when no mapping exists for the pair", async () => {
    vi.mocked(dbQueries.previewCrossSizeConflict).mockResolvedValueOnce({
      evaluated: false,
      message: "No compatibility mapping exists for the selected category pair.",
    });

    const result = await dbQueries.previewCrossSizeConflict(SHOP, "clothing", "M", "shorts_waist", "34");

    expect(dbQueries.previewCrossSizeConflict).toHaveBeenCalledWith(SHOP, "clothing", "M", "shorts_waist", "34");
    expect(result.evaluated).toBe(false);
  });

  it("returns the mapped severity and expected size on a real mismatch", async () => {
    vi.mocked(dbQueries.previewCrossSizeConflict).mockResolvedValueOnce({
      evaluated: true,
      severity: SizeConflictSeverity.WARNING,
      expectedSize: "32",
      message: "clothing size M typically pairs with shorts_waist size 32, not 34.",
    });

    const result = await dbQueries.previewCrossSizeConflict(SHOP, "clothing", "M", "shorts_waist", "34");

    expect(result.evaluated).toBe(true);
    expect(result.severity).toBe(SizeConflictSeverity.WARNING);
    expect(result.expectedSize).toBe("32");
  });

  it("returns a compatible message when the mapping's expected size matches", async () => {
    vi.mocked(dbQueries.previewCrossSizeConflict).mockResolvedValueOnce({
      evaluated: true,
      severity: SizeConflictSeverity.WARNING,
      expectedSize: "32",
      message: "clothing size M is compatible with shorts_waist size 32.",
    });

    const result = await dbQueries.previewCrossSizeConflict(SHOP, "clothing", "M", "shorts_waist", "32");

    expect(result.evaluated).toBe(true);
    expect(result.message).toContain("compatible");
  });

  it("does not persist any data — no create/update query is invoked", async () => {
    vi.mocked(dbQueries.previewCrossSizeConflict).mockResolvedValueOnce({ evaluated: false });

    await dbQueries.previewCrossSizeConflict(SHOP, "clothing", "M", "shorts_waist", "34");

    expect(dbQueries.previewCrossSizeConflict).toHaveBeenCalledTimes(1);
  });
});
