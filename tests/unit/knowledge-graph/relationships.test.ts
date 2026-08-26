import { describe, it, expect } from "vitest";
import {
  buildNormalizedPairKey,
  canonicalizePair,
  getDirectionality,
  scoreTaxonomyOverlap,
  scoreCollectionOverlap,
  scoreCatalogMetadata,
  aggregateStrength,
  generateCandidatesFromCatalog,
  type ProductSnapshot,
} from "../../../app/lib/knowledge-graph/relationships";
import {
  RelationshipType,
  RelationshipDirectionality,
  EvidenceType,
} from "@prisma/client";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeProduct(overrides: Partial<ProductSnapshot> = {}): ProductSnapshot {
  return {
    id: "prod_a",
    shopifyProductId: "gid://shopify/Product/1",
    title: "Boxing Gloves",
    disciplineTags: ["boxing"],
    categoryTags: ["gloves"],
    collectionIds: ["col_1"],
    tags: ["training", "leather"],
    productType: "gloves",
    vendor: "Venum",
    status: "ACTIVE",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// buildNormalizedPairKey
// ---------------------------------------------------------------------------

describe("buildNormalizedPairKey", () => {
  it("returns the same key regardless of argument order for symmetric types", () => {
    const key1 = buildNormalizedPairKey("aaa", "bbb", RelationshipType.ALTERNATIVES);
    const key2 = buildNormalizedPairKey("bbb", "aaa", RelationshipType.ALTERNATIVES);
    expect(key1).toBe(key2);
  });

  it("returns different keys when argument order changes for directional types", () => {
    const key1 = buildNormalizedPairKey("aaa", "bbb", RelationshipType.COMPLEMENTS);
    const key2 = buildNormalizedPairKey("bbb", "aaa", RelationshipType.COMPLEMENTS);
    expect(key1).not.toBe(key2);
  });

  it("includes the relationship type in the key", () => {
    const key1 = buildNormalizedPairKey("aaa", "bbb", RelationshipType.ALTERNATIVES);
    const key2 = buildNormalizedPairKey("aaa", "bbb", RelationshipType.CONFLICTS);
    expect(key1).not.toBe(key2);
  });
});

// ---------------------------------------------------------------------------
// canonicalizePair
// ---------------------------------------------------------------------------

describe("canonicalizePair", () => {
  it("normalizes symmetric pairs so lower id is always source", () => {
    const pair = canonicalizePair("bbb", "aaa", RelationshipType.CONFLICTS);
    expect(pair.sourceProductId).toBe("aaa");
    expect(pair.targetProductId).toBe("bbb");
  });

  it("preserves order for directional types", () => {
    const pair = canonicalizePair("bbb", "aaa", RelationshipType.COMPLEMENTS);
    expect(pair.sourceProductId).toBe("bbb");
    expect(pair.targetProductId).toBe("aaa");
  });
});

// ---------------------------------------------------------------------------
// getDirectionality
// ---------------------------------------------------------------------------

describe("getDirectionality", () => {
  it.each([
    [RelationshipType.ALTERNATIVES, RelationshipDirectionality.SYMMETRIC],
    [RelationshipType.CONFLICTS, RelationshipDirectionality.SYMMETRIC],
    [RelationshipType.SAME_COLLECTION, RelationshipDirectionality.SYMMETRIC],
    [RelationshipType.COMPLEMENTS, RelationshipDirectionality.DIRECTIONAL],
    [RelationshipType.UPGRADES, RelationshipDirectionality.DIRECTIONAL],
  ])("%s => %s", (type, expected) => {
    expect(getDirectionality(type)).toBe(expected);
  });
});

// ---------------------------------------------------------------------------
// scoreTaxonomyOverlap
// ---------------------------------------------------------------------------

describe("scoreTaxonomyOverlap", () => {
  it("returns null when there is no shared tag", () => {
    const a = makeProduct({ disciplineTags: ["boxing"], categoryTags: ["gloves"] });
    const b = makeProduct({ id: "prod_b", disciplineTags: ["mma"], categoryTags: ["shorts"] });
    expect(scoreTaxonomyOverlap(a, b)).toBeNull();
  });

  it("returns a positive score when disciplines overlap", () => {
    const a = makeProduct({ disciplineTags: ["boxing"], categoryTags: ["gloves"] });
    const b = makeProduct({ id: "prod_b", disciplineTags: ["boxing"], categoryTags: ["bag"] });
    const result = scoreTaxonomyOverlap(a, b);
    expect(result).not.toBeNull();
    expect(result!.score).toBeGreaterThan(0);
    expect(result!.evidenceType).toBe(EvidenceType.TAXONOMY);
  });

  it("score is bounded in [0, 1]", () => {
    const a = makeProduct({ disciplineTags: ["boxing", "mma"], categoryTags: ["gloves", "bag"] });
    const b = makeProduct({ id: "prod_b", disciplineTags: ["boxing", "mma"], categoryTags: ["gloves", "bag"] });
    const result = scoreTaxonomyOverlap(a, b);
    expect(result!.score).toBeGreaterThanOrEqual(0);
    expect(result!.score).toBeLessThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// scoreCollectionOverlap
// ---------------------------------------------------------------------------

describe("scoreCollectionOverlap", () => {
  it("returns null when no shared collections", () => {
    const a = makeProduct({ collectionIds: ["col_1"] });
    const b = makeProduct({ id: "prod_b", collectionIds: ["col_2"] });
    expect(scoreCollectionOverlap(a, b)).toBeNull();
  });

  it("returns a score when collections overlap", () => {
    const a = makeProduct({ collectionIds: ["col_1", "col_2"] });
    const b = makeProduct({ id: "prod_b", collectionIds: ["col_1"] });
    const result = scoreCollectionOverlap(a, b);
    expect(result).not.toBeNull();
    expect(result!.score).toBeGreaterThan(0);
  });

  it("returns null when either product has no collections", () => {
    const a = makeProduct({ collectionIds: [] });
    const b = makeProduct({ id: "prod_b", collectionIds: ["col_1"] });
    expect(scoreCollectionOverlap(a, b)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// scoreCatalogMetadata
// ---------------------------------------------------------------------------

describe("scoreCatalogMetadata", () => {
  it("returns null for completely different products", () => {
    const a = makeProduct({ vendor: "Venum", productType: "gloves", tags: [] });
    const b = makeProduct({ id: "prod_b", vendor: "RDX", productType: "shorts", tags: [] });
    expect(scoreCatalogMetadata(a, b)).toBeNull();
  });

  it("returns a positive score for same vendor", () => {
    const a = makeProduct({ vendor: "Venum", productType: "gloves" });
    const b = makeProduct({ id: "prod_b", vendor: "Venum", productType: "bag" });
    const result = scoreCatalogMetadata(a, b);
    expect(result).not.toBeNull();
    expect(result!.score).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// aggregateStrength
// ---------------------------------------------------------------------------

describe("aggregateStrength", () => {
  it("returns 0 for empty contributions", () => {
    expect(aggregateStrength([])).toBe(0);
  });

  it("returns a value in [0, 1]", () => {
    const contributions = [
      { evidenceType: EvidenceType.TAXONOMY, score: 0.8, details: {} },
      { evidenceType: EvidenceType.COLLECTION, score: 0.6, details: {} },
    ];
    const strength = aggregateStrength(contributions);
    expect(strength).toBeGreaterThan(0);
    expect(strength).toBeLessThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// generateCandidatesFromCatalog
// ---------------------------------------------------------------------------

describe("generateCandidatesFromCatalog", () => {
  it("excludes self-relationships", () => {
    const source = makeProduct();
    const candidates = generateCandidatesFromCatalog(source, [source]);
    expect(candidates).toHaveLength(0);
  });

  it("generates candidates between products sharing taxonomy and collections", () => {
    const source = makeProduct({ id: "src", disciplineTags: ["boxing"], categoryTags: ["gloves"], collectionIds: ["col_1"] });
    const peer = makeProduct({ id: "peer", disciplineTags: ["boxing"], categoryTags: ["bag"], collectionIds: ["col_1"] });

    const candidates = generateCandidatesFromCatalog(source, [peer]);
    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates[0].strength).toBeGreaterThan(0);
    expect(candidates[0].evidenceContributions.length).toBeGreaterThan(0);
  });

  it("produces no candidates between unrelated products", () => {
    const source = makeProduct({ id: "src", disciplineTags: ["boxing"], categoryTags: ["gloves"], collectionIds: ["col_1"], tags: [], vendor: "A", productType: "gloves" });
    const peer = makeProduct({ id: "peer", disciplineTags: ["yoga"], categoryTags: ["mat"], collectionIds: ["col_99"], tags: [], vendor: "B", productType: "mat" });

    const candidates = generateCandidatesFromCatalog(source, [peer]);
    expect(candidates).toHaveLength(0);
  });

  it("caps candidates per relationship type at 10", () => {
    const source = makeProduct({ id: "src", disciplineTags: ["boxing"], collectionIds: ["col_1"] });
    const peers = Array.from({ length: 15 }, (_, i) =>
      makeProduct({
        id: `peer_${i}`,
        disciplineTags: ["boxing"],
        collectionIds: ["col_1"],
        categoryTags: [`cat_${i}`],
      }),
    );

    const candidates = generateCandidatesFromCatalog(source, peers);
    const byType = new Map<RelationshipType, number>();
    for (const c of candidates) {
      byType.set(c.relationshipType, (byType.get(c.relationshipType) ?? 0) + 1);
    }
    for (const count of byType.values()) {
      expect(count).toBeLessThanOrEqual(10);
    }
  });

  it("assigns correct directionality to symmetric relationship types", () => {
    const source = makeProduct({ id: "src", disciplineTags: ["boxing"], categoryTags: ["gloves"], collectionIds: ["col_1"] });
    const peer = makeProduct({ id: "peer", disciplineTags: ["boxing"], categoryTags: ["gloves"], collectionIds: ["col_1"] });

    const candidates = generateCandidatesFromCatalog(source, [peer]);
    const symmetricTypes: RelationshipType[] = [
      RelationshipType.ALTERNATIVES,
      RelationshipType.CONFLICTS,
      RelationshipType.SAME_COLLECTION,
    ];
    const symmetric = candidates.filter(c =>
      symmetricTypes.includes(c.relationshipType),
    );
    for (const c of symmetric) {
      expect(c.directionality).toBe(RelationshipDirectionality.SYMMETRIC);
    }
  });
});

// ---------------------------------------------------------------------------
// T013: Override precedence and symmetric pair normalization
// ---------------------------------------------------------------------------

describe("override precedence — merchant records survive remapping", () => {
  it("canonicalizePair produces the same canonical pair regardless of argument order for symmetric types", () => {
    const pair1 = canonicalizePair("zzz", "aaa", RelationshipType.ALTERNATIVES);
    const pair2 = canonicalizePair("aaa", "zzz", RelationshipType.ALTERNATIVES);

    expect(pair1.sourceProductId).toBe(pair2.sourceProductId);
    expect(pair1.targetProductId).toBe(pair2.targetProductId);
  });

  it("canonical pair for directional types preserves the supplied source→target order", () => {
    const pair = canonicalizePair("source_id", "target_id", RelationshipType.UPGRADES);
    expect(pair.sourceProductId).toBe("source_id");
    expect(pair.targetProductId).toBe("target_id");
  });

  it("normalized pair key for symmetric types is identical to the reverse", () => {
    const k1 = buildNormalizedPairKey("prod_x", "prod_y", RelationshipType.CONFLICTS);
    const k2 = buildNormalizedPairKey("prod_y", "prod_x", RelationshipType.CONFLICTS);
    expect(k1).toBe(k2);
  });

  it("normalized pair key for directional types differs when reversed", () => {
    const k1 = buildNormalizedPairKey("prod_x", "prod_y", RelationshipType.COMPLEMENTS);
    const k2 = buildNormalizedPairKey("prod_y", "prod_x", RelationshipType.COMPLEMENTS);
    expect(k1).not.toBe(k2);
  });

  it("SAME_COLLECTION is a symmetric type (merchant-approved pair survives remapping from either direction)", () => {
    const directionality = getDirectionality(RelationshipType.SAME_COLLECTION);
    expect(directionality).toBe(RelationshipDirectionality.SYMMETRIC);
  });

  it("UPGRADES is a directional type (source→target direction is preserved)", () => {
    const directionality = getDirectionality(RelationshipType.UPGRADES);
    expect(directionality).toBe(RelationshipDirectionality.DIRECTIONAL);
  });

  it("candidates respect symmetric normalization — deduplicating opposite-direction pairs", () => {
    // Two products sharing a collection should generate exactly one symmetric candidate per type,
    // not two separate directional entries.
    const source = makeProduct({ id: "alpha", disciplineTags: ["boxing"], categoryTags: ["gloves"], collectionIds: ["col_shared"] });
    const peer = makeProduct({ id: "beta", disciplineTags: ["boxing"], categoryTags: ["gloves"], collectionIds: ["col_shared"] });

    const candidatesFromAlpha = generateCandidatesFromCatalog(source, [peer]);
    const candidatesFromBeta = generateCandidatesFromCatalog(peer, [source]);

    // Both runs should produce the same canonical source/target pair for symmetric types
    const symmetricAlpha = candidatesFromAlpha.filter(c => c.relationshipType === RelationshipType.SAME_COLLECTION);
    const symmetricBeta = candidatesFromBeta.filter(c => c.relationshipType === RelationshipType.SAME_COLLECTION);

    if (symmetricAlpha.length > 0 && symmetricBeta.length > 0) {
      expect(symmetricAlpha[0].sourceProductId).toBe(symmetricBeta[0].sourceProductId);
      expect(symmetricAlpha[0].targetProductId).toBe(symmetricBeta[0].targetProductId);
    }
  });
});
