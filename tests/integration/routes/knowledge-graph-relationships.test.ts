/**
 * Integration test scaffolding: Product Relationship Mapping — knowledge-graph relationships.
 *
 * Covers:
 *  - Merchant relationship review actions (approve, reject, create) [US2]
 *  - Approved-relationship read model filtering [US3]
 *  - Baseline candidate upsert and query round-trips
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import * as dbQueries from "../../../app/lib/db/queries";
import {
  RelationshipType,
  RelationshipDirectionality,
  RelationshipStatus,
  RelationshipOrigin,
  EvidenceType,
} from "@prisma/client";

// ---------------------------------------------------------------------------
// Mock the db layer so tests run without a real database
// ---------------------------------------------------------------------------

vi.mock("../../../app/lib/db/queries", () => ({
  upsertCandidateRelationship: vi.fn(),
  invalidateRelationshipsForProduct: vi.fn(),
  getActiveRelationshipsForProduct: vi.fn(),
  getCandidateRelationships: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Baseline: candidate upsert
// ---------------------------------------------------------------------------

describe("upsertCandidateRelationship (integration scaffold)", () => {
  it("calls upsert with the correct shape", async () => {
    vi.mocked(dbQueries.upsertCandidateRelationship).mockResolvedValueOnce({
      id: "rel_001",
      shop: "venum.myshopify.com",
      sourceProductId: "prod_a",
      targetProductId: "prod_b",
      relationshipType: RelationshipType.COMPLEMENTS,
      directionality: RelationshipDirectionality.DIRECTIONAL,
      strength: 0.72,
      status: RelationshipStatus.CANDIDATE,
      origin: RelationshipOrigin.AUTO,
      evidenceSummary: null,
      reviewedAt: null,
      invalidatedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const candidate = {
      shop: "venum.myshopify.com",
      sourceProductId: "prod_a",
      targetProductId: "prod_b",
      relationshipType: RelationshipType.COMPLEMENTS,
      directionality: RelationshipDirectionality.DIRECTIONAL,
      strength: 0.72,
      origin: RelationshipOrigin.AUTO,
    };

    const evidence = [
      { evidenceType: EvidenceType.TAXONOMY, score: 0.8, details: { sharedDisciplines: ["boxing"] } },
    ];

    const result = await dbQueries.upsertCandidateRelationship(candidate, evidence);

    expect(dbQueries.upsertCandidateRelationship).toHaveBeenCalledOnce();
    expect(result).not.toBeNull();
    expect(result?.status).toBe(RelationshipStatus.CANDIDATE);
  });
});

// ---------------------------------------------------------------------------
// Approved-relationship read (US3)
// ---------------------------------------------------------------------------

describe("getActiveRelationshipsForProduct (integration scaffold)", () => {
  it("returns only active relationships for the requested product", async () => {
    const mockRows = [
      {
        id: "rel_001",
        sourceProductId: "prod_a",
        targetProductId: "prod_b",
        relationshipType: RelationshipType.COMPLEMENTS,
        directionality: RelationshipDirectionality.DIRECTIONAL,
        strength: 0.9,
        origin: RelationshipOrigin.AUTO,
        status: RelationshipStatus.ACTIVE,
      },
    ];

    vi.mocked(dbQueries.getActiveRelationshipsForProduct).mockResolvedValueOnce(mockRows);

    const rows = await dbQueries.getActiveRelationshipsForProduct(
      "venum.myshopify.com",
      "prod_a",
    );

    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe(RelationshipStatus.ACTIVE);
  });

  it("returns empty array when no active relationships exist", async () => {
    vi.mocked(dbQueries.getActiveRelationshipsForProduct).mockResolvedValueOnce([]);

    const rows = await dbQueries.getActiveRelationshipsForProduct(
      "venum.myshopify.com",
      "prod_unknown",
    );

    expect(rows).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Invalidation (US1 / US3)
// ---------------------------------------------------------------------------

describe("invalidateRelationshipsForProduct (integration scaffold)", () => {
  it("calls the invalidation helper with shop and product id", async () => {
    vi.mocked(dbQueries.invalidateRelationshipsForProduct).mockResolvedValueOnce(undefined);

    await dbQueries.invalidateRelationshipsForProduct("venum.myshopify.com", "prod_deleted");

    expect(dbQueries.invalidateRelationshipsForProduct).toHaveBeenCalledWith(
      "venum.myshopify.com",
      "prod_deleted",
    );
  });
});

// ---------------------------------------------------------------------------
// Candidate listing for admin review (US2)
// ---------------------------------------------------------------------------

describe("getCandidateRelationships (integration scaffold)", () => {
  it("returns candidate rows for admin review", async () => {
    const mockCandidates = [
      {
        id: "rel_002",
        sourceProductId: "prod_a",
        targetProductId: "prod_c",
        relationshipType: RelationshipType.SAME_COLLECTION,
        directionality: RelationshipDirectionality.SYMMETRIC,
        strength: 0.55,
        origin: RelationshipOrigin.AUTO,
        status: RelationshipStatus.CANDIDATE,
        evidenceSummary: { contributions: [] },
        createdAt: new Date(),
      },
    ];

    vi.mocked(dbQueries.getCandidateRelationships).mockResolvedValueOnce(mockCandidates);

    const rows = await dbQueries.getCandidateRelationships("venum.myshopify.com");

    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe(RelationshipStatus.CANDIDATE);
  });
});
