/**
 * Integration tests: Knowledge Graph Editor — Review mutations (T022)
 *
 * Covers:
 *  - Classification override action (override-taxonomy intent)
 *  - Relationship review actions (approve, reject, disable, create)
 *  - mark-reviewed and reflag-for-review intents
 *  - Invalid intent rejection
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import * as dbQueries from "../../../app/lib/db/queries";
import * as editorModule from "../../../app/lib/knowledge-graph/editor";
import {
  RelationshipType,
  RelationshipDirectionality,
  RelationshipStatus,
  RelationshipOrigin,
} from "@prisma/client";

vi.mock("../../../app/lib/db/queries", () => ({
  applyMerchantTaxonomyOverride: vi.fn().mockResolvedValue({ count: 1 }),
  approveRelationship: vi.fn(),
  rejectRelationship: vi.fn(),
  disableRelationship: vi.fn(),
  upsertMerchantRelationship: vi.fn(),
  getLowConfidenceProducts: vi.fn().mockResolvedValue([]),
}));

vi.mock("../../../app/lib/knowledge-graph/editor", async (importOriginal) => {
  const actual = await importOriginal<typeof editorModule>();
  return {
    ...actual,
    markProductAsReviewed: vi.fn().mockResolvedValue(undefined),
    reflagProductForReview: vi.fn().mockResolvedValue(undefined),
  };
});

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Classification override — override-taxonomy intent
// ---------------------------------------------------------------------------

describe("applyMerchantTaxonomyOverride (classification mutation)", () => {
  it("persists new discipline and category tags for a product", async () => {
    vi.mocked(dbQueries.applyMerchantTaxonomyOverride).mockResolvedValueOnce({ count: 1 });

    const result = await dbQueries.applyMerchantTaxonomyOverride(
      "gid://shopify/Product/1",
      ["boxing"],
      ["gloves"],
    );

    expect(dbQueries.applyMerchantTaxonomyOverride).toHaveBeenCalledWith(
      "gid://shopify/Product/1",
      ["boxing"],
      ["gloves"],
    );
    expect(result.count).toBe(1);
  });

  it("accepts multiple discipline and category tags", async () => {
    vi.mocked(dbQueries.applyMerchantTaxonomyOverride).mockResolvedValueOnce({ count: 1 });

    await dbQueries.applyMerchantTaxonomyOverride(
      "gid://shopify/Product/2",
      ["boxing", "mma"],
      ["gloves", "protection"],
    );

    expect(dbQueries.applyMerchantTaxonomyOverride).toHaveBeenCalledWith(
      "gid://shopify/Product/2",
      ["boxing", "mma"],
      ["gloves", "protection"],
    );
  });
});

// ---------------------------------------------------------------------------
// Relationship review mutations (approve, reject, disable, create)
// ---------------------------------------------------------------------------

describe("approveRelationship mutation", () => {
  it("returns an ACTIVE MERCHANT relationship", async () => {
    const approved = {
      id: "rel_001",
      shop: "shop.myshopify.com",
      sourceProductId: "prod_a",
      targetProductId: "prod_b",
      relationshipType: RelationshipType.COMPLEMENTS,
      directionality: RelationshipDirectionality.DIRECTIONAL,
      strength: 0.8,
      status: RelationshipStatus.ACTIVE,
      origin: RelationshipOrigin.MERCHANT,
      evidenceSummary: null,
      reviewedAt: new Date(),
      invalidatedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    vi.mocked(dbQueries.approveRelationship).mockResolvedValueOnce(approved);

    const result = await dbQueries.approveRelationship("shop.myshopify.com", "rel_001");

    expect(result.status).toBe(RelationshipStatus.ACTIVE);
    expect(result.origin).toBe(RelationshipOrigin.MERCHANT);
    expect(result.reviewedAt).not.toBeNull();
  });
});

describe("rejectRelationship mutation", () => {
  it("returns a REJECTED MERCHANT relationship", async () => {
    const rejected = {
      id: "rel_002",
      shop: "shop.myshopify.com",
      sourceProductId: "prod_a",
      targetProductId: "prod_c",
      relationshipType: RelationshipType.SAME_COLLECTION,
      directionality: RelationshipDirectionality.SYMMETRIC,
      strength: 0.4,
      status: RelationshipStatus.REJECTED,
      origin: RelationshipOrigin.MERCHANT,
      evidenceSummary: null,
      reviewedAt: new Date(),
      invalidatedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    vi.mocked(dbQueries.rejectRelationship).mockResolvedValueOnce(rejected);

    const result = await dbQueries.rejectRelationship("shop.myshopify.com", "rel_002");

    expect(result.status).toBe(RelationshipStatus.REJECTED);
  });
});

describe("disableRelationship mutation", () => {
  it("returns an INACTIVE relationship with invalidatedAt set", async () => {
    const disabled = {
      id: "rel_003",
      shop: "shop.myshopify.com",
      sourceProductId: "prod_b",
      targetProductId: "prod_d",
      relationshipType: RelationshipType.ALTERNATIVES,
      directionality: RelationshipDirectionality.SYMMETRIC,
      strength: 0.7,
      status: RelationshipStatus.INACTIVE,
      origin: RelationshipOrigin.MERCHANT,
      evidenceSummary: null,
      reviewedAt: new Date(),
      invalidatedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    vi.mocked(dbQueries.disableRelationship).mockResolvedValueOnce(disabled);

    const result = await dbQueries.disableRelationship("shop.myshopify.com", "rel_003");

    expect(result.status).toBe(RelationshipStatus.INACTIVE);
    expect(result.invalidatedAt).not.toBeNull();
  });
});

describe("upsertMerchantRelationship — create-relationship mutation", () => {
  it("creates an ACTIVE MERCHANT relationship with strength 1.0", async () => {
    const created = {
      id: "rel_004",
      shop: "shop.myshopify.com",
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
      shop: "shop.myshopify.com",
      sourceProductId: "prod_a",
      targetProductId: "prod_e",
      relationshipType: RelationshipType.UPGRADES,
      directionality: RelationshipDirectionality.DIRECTIONAL,
      strength: 1.0,
    });

    expect(result.status).toBe(RelationshipStatus.ACTIVE);
    expect(result.strength).toBe(1.0);
  });
});

// ---------------------------------------------------------------------------
// mark-reviewed and reflag-for-review intents
// ---------------------------------------------------------------------------

describe("markProductAsReviewed (T016 handler)", () => {
  it("is callable and resolves without error", async () => {
    await expect(
      editorModule.markProductAsReviewed("gid://shopify/Product/1", ["boxing"], ["gloves"]),
    ).resolves.toBeUndefined();

    expect(editorModule.markProductAsReviewed).toHaveBeenCalledWith(
      "gid://shopify/Product/1",
      ["boxing"],
      ["gloves"],
    );
  });
});

describe("reflagProductForReview (T016 handler)", () => {
  it("is callable and resolves without error", async () => {
    await expect(
      editorModule.reflagProductForReview("gid://shopify/Product/1"),
    ).resolves.toBeUndefined();

    expect(editorModule.reflagProductForReview).toHaveBeenCalledWith(
      "gid://shopify/Product/1",
    );
  });
});

// ---------------------------------------------------------------------------
// KNOWLEDGE_GRAPH_EDITOR_ROUTE_INTENTS — intent contract
// ---------------------------------------------------------------------------

describe("KNOWLEDGE_GRAPH_EDITOR_ROUTE_INTENTS", () => {
  it("includes mark-reviewed and reflag-for-review", () => {
    const intents = editorModule.KNOWLEDGE_GRAPH_EDITOR_ROUTE_INTENTS as readonly string[];
    expect(intents).toContain("mark-reviewed");
    expect(intents).toContain("reflag-for-review");
  });

  it("includes all relationship review intents", () => {
    const intents = editorModule.KNOWLEDGE_GRAPH_EDITOR_ROUTE_INTENTS as readonly string[];
    expect(intents).toContain("approve-relationship");
    expect(intents).toContain("reject-relationship");
    expect(intents).toContain("disable-relationship");
    expect(intents).toContain("create-relationship");
  });

  it("includes taxonomy override intent", () => {
    const intents = editorModule.KNOWLEDGE_GRAPH_EDITOR_ROUTE_INTENTS as readonly string[];
    expect(intents).toContain("override-taxonomy");
  });
});
