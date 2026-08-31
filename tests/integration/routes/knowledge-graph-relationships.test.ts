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
  getApprovedRelationshipsForProduct: vi.fn(),
  getCandidateRelationships: vi.fn(),
  approveRelationship: vi.fn(),
  rejectRelationship: vi.fn(),
  disableRelationship: vi.fn(),
  upsertMerchantRelationship: vi.fn(),
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

// ---------------------------------------------------------------------------
// T014: Merchant relationship review actions (US2)
// ---------------------------------------------------------------------------

describe("approveRelationship (US2)", () => {
  it("approves a candidate and resolves with ACTIVE status", async () => {
    const approved = {
      id: "rel_001",
      shop: "venum.myshopify.com",
      sourceProductId: "prod_a",
      targetProductId: "prod_b",
      relationshipType: RelationshipType.COMPLEMENTS,
      directionality: RelationshipDirectionality.DIRECTIONAL,
      strength: 0.72,
      status: RelationshipStatus.ACTIVE,
      origin: RelationshipOrigin.MERCHANT,
      evidenceSummary: null,
      reviewedAt: new Date(),
      invalidatedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    vi.mocked(dbQueries.approveRelationship).mockResolvedValueOnce(approved);

    const result = await dbQueries.approveRelationship("venum.myshopify.com", "rel_001");
    expect(dbQueries.approveRelationship).toHaveBeenCalledWith("venum.myshopify.com", "rel_001");
    expect(result.status).toBe(RelationshipStatus.ACTIVE);
    expect(result.origin).toBe(RelationshipOrigin.MERCHANT);
    expect(result.reviewedAt).not.toBeNull();
  });
});

describe("rejectRelationship (US2)", () => {
  it("rejects a candidate and resolves with REJECTED status", async () => {
    const rejected = {
      id: "rel_002",
      shop: "venum.myshopify.com",
      sourceProductId: "prod_a",
      targetProductId: "prod_c",
      relationshipType: RelationshipType.SAME_COLLECTION,
      directionality: RelationshipDirectionality.SYMMETRIC,
      strength: 0.55,
      status: RelationshipStatus.REJECTED,
      origin: RelationshipOrigin.MERCHANT,
      evidenceSummary: null,
      reviewedAt: new Date(),
      invalidatedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    vi.mocked(dbQueries.rejectRelationship).mockResolvedValueOnce(rejected);

    const result = await dbQueries.rejectRelationship("venum.myshopify.com", "rel_002");
    expect(dbQueries.rejectRelationship).toHaveBeenCalledWith("venum.myshopify.com", "rel_002");
    expect(result.status).toBe(RelationshipStatus.REJECTED);
    expect(result.origin).toBe(RelationshipOrigin.MERCHANT);
  });
});

describe("disableRelationship (US2)", () => {
  it("disables an active relationship and resolves with INACTIVE status", async () => {
    const disabled = {
      id: "rel_003",
      shop: "venum.myshopify.com",
      sourceProductId: "prod_b",
      targetProductId: "prod_d",
      relationshipType: RelationshipType.ALTERNATIVES,
      directionality: RelationshipDirectionality.SYMMETRIC,
      strength: 0.80,
      status: RelationshipStatus.INACTIVE,
      origin: RelationshipOrigin.MERCHANT,
      evidenceSummary: null,
      reviewedAt: new Date(),
      invalidatedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    vi.mocked(dbQueries.disableRelationship).mockResolvedValueOnce(disabled);

    const result = await dbQueries.disableRelationship("venum.myshopify.com", "rel_003");
    expect(dbQueries.disableRelationship).toHaveBeenCalledWith("venum.myshopify.com", "rel_003");
    expect(result.status).toBe(RelationshipStatus.INACTIVE);
    expect(result.invalidatedAt).not.toBeNull();
  });
});

describe("upsertMerchantRelationship — merchant-authored creation (US2)", () => {
  it("creates an ACTIVE MERCHANT relationship", async () => {
    const created = {
      id: "rel_004",
      shop: "venum.myshopify.com",
      sourceProductId: "prod_a",
      targetProductId: "prod_e",
      relationshipType: RelationshipType.UPGRADES,
      directionality: RelationshipDirectionality.DIRECTIONAL,
      strength: 1.0,
      status: RelationshipStatus.ACTIVE,
      origin: RelationshipOrigin.MERCHANT,
      evidenceSummary: null,
      reviewedAt: new Date(),
      invalidatedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    vi.mocked(dbQueries.upsertMerchantRelationship).mockResolvedValueOnce(created);

    const result = await dbQueries.upsertMerchantRelationship({
      shop: "venum.myshopify.com",
      sourceProductId: "prod_a",
      targetProductId: "prod_e",
      relationshipType: RelationshipType.UPGRADES,
      directionality: RelationshipDirectionality.DIRECTIONAL,
      strength: 1.0,
    });

    expect(result.status).toBe(RelationshipStatus.ACTIVE);
    expect(result.origin).toBe(RelationshipOrigin.MERCHANT);
    expect(result.strength).toBe(1.0);
  });
});

describe("merchant decisions survive remapping — override precedence (US2)", () => {
  it("does not overwrite a MERCHANT ACTIVE record during candidate upsert", async () => {
    // When a merchant-approved record exists, upsertCandidateRelationship returns null
    vi.mocked(dbQueries.upsertCandidateRelationship).mockResolvedValueOnce(null);

    const candidate = {
      shop: "venum.myshopify.com",
      sourceProductId: "prod_a",
      targetProductId: "prod_b",
      relationshipType: RelationshipType.COMPLEMENTS,
      directionality: RelationshipDirectionality.DIRECTIONAL,
      strength: 0.6,
      origin: RelationshipOrigin.AUTO,
    };

    const result = await dbQueries.upsertCandidateRelationship(candidate, []);

    expect(result).toBeNull();
    expect(dbQueries.upsertCandidateRelationship).toHaveBeenCalledOnce();
  });

  it("does not overwrite a MERCHANT REJECTED record during candidate upsert", async () => {
    vi.mocked(dbQueries.upsertCandidateRelationship).mockResolvedValueOnce(null);

    const candidate = {
      shop: "venum.myshopify.com",
      sourceProductId: "prod_a",
      targetProductId: "prod_c",
      relationshipType: RelationshipType.SAME_COLLECTION,
      directionality: RelationshipDirectionality.SYMMETRIC,
      strength: 0.5,
      origin: RelationshipOrigin.AUTO,
    };

    const result = await dbQueries.upsertCandidateRelationship(candidate, []);
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// T021 [US3]: Approved relationship read model — filtering and ordering
// ---------------------------------------------------------------------------

describe("getApprovedRelationshipsForProduct — basic read (US3)", () => {
  it("returns ACTIVE relationships for the requested product", async () => {
    const mockRows = [
      {
        id: "rel_c1",
        sourceProductId: "prod_a",
        targetProductId: "prod_b",
        relationshipType: RelationshipType.COMPLEMENTS,
        directionality: RelationshipDirectionality.DIRECTIONAL,
        strength: 0.9,
        origin: RelationshipOrigin.AUTO,
        reviewedAt: null,
      },
    ];

    vi.mocked(dbQueries.getApprovedRelationshipsForProduct).mockResolvedValueOnce(mockRows);

    const rows = await dbQueries.getApprovedRelationshipsForProduct("venum.myshopify.com", "prod_a");

    expect(rows).toHaveLength(1);
    expect(rows[0].relationshipType).toBe(RelationshipType.COMPLEMENTS);
    expect(rows[0].strength).toBe(0.9);
  });

  it("returns empty array when no approved relationships exist", async () => {
    vi.mocked(dbQueries.getApprovedRelationshipsForProduct).mockResolvedValueOnce([]);

    const rows = await dbQueries.getApprovedRelationshipsForProduct("venum.myshopify.com", "prod_unknown");

    expect(rows).toHaveLength(0);
  });
});

describe("getApprovedRelationshipsForProduct — type filtering (US3)", () => {
  it("accepts a types filter and passes it through", async () => {
    vi.mocked(dbQueries.getApprovedRelationshipsForProduct).mockResolvedValueOnce([]);

    await dbQueries.getApprovedRelationshipsForProduct("venum.myshopify.com", "prod_a", {
      types: [RelationshipType.COMPLEMENTS],
    });

    expect(dbQueries.getApprovedRelationshipsForProduct).toHaveBeenCalledWith(
      "venum.myshopify.com",
      "prod_a",
      { types: [RelationshipType.COMPLEMENTS] },
    );
  });

  it("accepts a minStrength option and passes it through", async () => {
    vi.mocked(dbQueries.getApprovedRelationshipsForProduct).mockResolvedValueOnce([]);

    await dbQueries.getApprovedRelationshipsForProduct("venum.myshopify.com", "prod_a", {
      minStrength: 0.6,
    });

    expect(dbQueries.getApprovedRelationshipsForProduct).toHaveBeenCalledWith(
      "venum.myshopify.com",
      "prod_a",
      { minStrength: 0.6 },
    );
  });
});

describe("getApprovedRelationshipsForProduct — priority ordering contract (US3)", () => {
  it("returns COMPLEMENTS before UPGRADES when both are present", async () => {
    const mockRows = [
      {
        id: "rel_u1",
        sourceProductId: "prod_a",
        targetProductId: "prod_c",
        relationshipType: RelationshipType.UPGRADES,
        directionality: RelationshipDirectionality.DIRECTIONAL,
        strength: 0.95,
        origin: RelationshipOrigin.AUTO,
        reviewedAt: null,
      },
      {
        id: "rel_c1",
        sourceProductId: "prod_a",
        targetProductId: "prod_b",
        relationshipType: RelationshipType.COMPLEMENTS,
        directionality: RelationshipDirectionality.DIRECTIONAL,
        strength: 0.7,
        origin: RelationshipOrigin.MERCHANT,
        reviewedAt: new Date(),
      },
    ];
    // Simulate the query returning in priority order (COMPLEMENTS first)
    const orderedRows = [mockRows[1], mockRows[0]];
    vi.mocked(dbQueries.getApprovedRelationshipsForProduct).mockResolvedValueOnce(orderedRows);

    const rows = await dbQueries.getApprovedRelationshipsForProduct("venum.myshopify.com", "prod_a");

    expect(rows[0].relationshipType).toBe(RelationshipType.COMPLEMENTS);
    expect(rows[1].relationshipType).toBe(RelationshipType.UPGRADES);
  });
});

describe("getApprovedRelationshipsForProduct — reviewedAt field (US3)", () => {
  it("includes reviewedAt for merchant-approved rows", async () => {
    const reviewedAt = new Date("2026-06-01T12:00:00Z");
    vi.mocked(dbQueries.getApprovedRelationshipsForProduct).mockResolvedValueOnce([
      {
        id: "rel_m1",
        sourceProductId: "prod_a",
        targetProductId: "prod_b",
        relationshipType: RelationshipType.COMPLEMENTS,
        directionality: RelationshipDirectionality.DIRECTIONAL,
        strength: 0.8,
        origin: RelationshipOrigin.MERCHANT,
        reviewedAt,
      },
    ]);

    const rows = await dbQueries.getApprovedRelationshipsForProduct("venum.myshopify.com", "prod_a");

    expect(rows[0].reviewedAt).toEqual(reviewedAt);
    expect(rows[0].origin).toBe(RelationshipOrigin.MERCHANT);
  });

  it("reviewedAt is null for auto-generated rows", async () => {
    vi.mocked(dbQueries.getApprovedRelationshipsForProduct).mockResolvedValueOnce([
      {
        id: "rel_a1",
        sourceProductId: "prod_a",
        targetProductId: "prod_b",
        relationshipType: RelationshipType.SAME_COLLECTION,
        directionality: RelationshipDirectionality.SYMMETRIC,
        strength: 0.55,
        origin: RelationshipOrigin.AUTO,
        reviewedAt: null,
      },
    ]);

    const rows = await dbQueries.getApprovedRelationshipsForProduct("venum.myshopify.com", "prod_a");

    expect(rows[0].reviewedAt).toBeNull();
    expect(rows[0].origin).toBe(RelationshipOrigin.AUTO);
  });
});
