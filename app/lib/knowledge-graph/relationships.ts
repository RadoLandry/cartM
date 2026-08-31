/**
 * Product Relationship Mapping — knowledge-graph service layer.
 *
 * Responsibilities:
 *  - Canonical pair key normalization (symmetric vs directional).
 *  - Candidate generation from catalog evidence sources.
 *  - Evidence aggregation and strength ranking.
 *  - Persistence coordination (delegates to queries.ts).
 *  - Approved-relationship read helpers for downstream consumers.
 */

import {
  RelationshipType,
  RelationshipDirectionality,
  RelationshipStatus,
  RelationshipOrigin,
  EvidenceType,
} from "@prisma/client";
import {
  upsertCandidateRelationship,
  upsertMerchantRelationship,
  deactivateRelationshipRule,
  invalidateRelationshipsForProduct,
  getActiveRelationshipsForProduct,
  getApprovedRelationshipsForProduct,
  getProductSnapshotsForShop,
  type RelationshipCandidate,
  type EvidenceInput,
  type ApprovedRelationshipRow,
} from "../db/queries";

// ---------------------------------------------------------------------------
// Re-export Prisma enums so callers don't need a direct Prisma import
// ---------------------------------------------------------------------------
export {
  RelationshipType,
  RelationshipDirectionality,
  RelationshipStatus,
  RelationshipOrigin,
  EvidenceType,
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Relationship types that are symmetric at the business level. */
const SYMMETRIC_TYPES = new Set<RelationshipType>([
  RelationshipType.ALTERNATIVES,
  RelationshipType.CONFLICTS,
  RelationshipType.SAME_COLLECTION,
]);

/** Maximum number of candidates generated per product per relationship type. */
const MAX_CANDIDATES_PER_TYPE = 10;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ProductSnapshot {
  id: string;
  shopifyProductId: string;
  title: string;
  disciplineTags: string[];
  categoryTags: string[];
  collectionIds: string[];
  effectiveCollectionIds?: string[];
  colorwayKeys?: string[];
  tags: string[];
  productType: string | null;
  vendor: string | null;
  status: string;
}

export interface EvidenceContribution {
  evidenceType: EvidenceType;
  score: number;
  details: Record<string, unknown>;
}

export interface RankedCandidate {
  sourceProductId: string;
  targetProductId: string;
  relationshipType: RelationshipType;
  directionality: RelationshipDirectionality;
  strength: number;
  evidenceContributions: EvidenceContribution[];
}

// ---------------------------------------------------------------------------
// Pair key normalization
// ---------------------------------------------------------------------------

/**
 * Compute a canonical pair key for a product pair and relationship type.
 * For symmetric types the lower id comes first so duplicates collapse.
 */
export function buildNormalizedPairKey(
  productIdA: string,
  productIdB: string,
  type: RelationshipType,
): string {
  if (SYMMETRIC_TYPES.has(type)) {
    const [first, second] = productIdA < productIdB
      ? [productIdA, productIdB]
      : [productIdB, productIdA];
    return `${first}:${second}:${type}`;
  }
  return `${productIdA}:${productIdB}:${type}`;
}

/**
 * Return the canonical (source, target) pair for a relationship.
 * For symmetric types this ensures the canonical record is always stored
 * with the lower id as source.
 */
export function canonicalizePair(
  productIdA: string,
  productIdB: string,
  type: RelationshipType,
): { sourceProductId: string; targetProductId: string } {
  if (SYMMETRIC_TYPES.has(type)) {
    return productIdA < productIdB
      ? { sourceProductId: productIdA, targetProductId: productIdB }
      : { sourceProductId: productIdB, targetProductId: productIdA };
  }
  return { sourceProductId: productIdA, targetProductId: productIdB };
}

/**
 * Return the directionality flag for a relationship type.
 */
export function getDirectionality(type: RelationshipType): RelationshipDirectionality {
  return SYMMETRIC_TYPES.has(type)
    ? RelationshipDirectionality.SYMMETRIC
    : RelationshipDirectionality.DIRECTIONAL;
}

export async function upsertMerchantRelationshipRule(input: {
  shop: string;
  sourceProductId: string;
  targetProductId: string;
  relationshipType: RelationshipType;
  strength: number;
  evidenceSummary?: Record<string, unknown>;
}) {
  const { sourceProductId, targetProductId } = canonicalizePair(
    input.sourceProductId,
    input.targetProductId,
    input.relationshipType,
  );

  return await upsertMerchantRelationship({
    shop: input.shop,
    sourceProductId,
    targetProductId,
    relationshipType: input.relationshipType,
    directionality: getDirectionality(input.relationshipType),
    strength: Math.max(0, Math.min(1, input.strength)),
    evidenceSummary: input.evidenceSummary,
  });
}

export async function removeRelationshipRule(shop: string, relationshipId: string) {
  return await deactivateRelationshipRule(shop, relationshipId);
}

// ---------------------------------------------------------------------------
// Evidence scoring helpers
// ---------------------------------------------------------------------------

/**
 * Score taxonomy overlap between two products.
 * Returns a score in [0, 1] and a details payload.
 */
export function scoreTaxonomyOverlap(
  a: ProductSnapshot,
  b: ProductSnapshot,
): EvidenceContribution | null {
  const sharedDisciplines = a.disciplineTags.filter(t => b.disciplineTags.includes(t));
  const sharedCategories = a.categoryTags.filter(t => b.categoryTags.includes(t));

  if (sharedDisciplines.length === 0 && sharedCategories.length === 0) return null;

  const score = Math.min(
    1.0,
    (sharedDisciplines.length * 0.4 + sharedCategories.length * 0.6) /
      Math.max(
        1,
        Math.max(a.disciplineTags.length, b.disciplineTags.length) * 0.4 +
          Math.max(a.categoryTags.length, b.categoryTags.length) * 0.6,
      ),
  );

  return {
    evidenceType: EvidenceType.TAXONOMY,
    score,
    details: { sharedDisciplines, sharedCategories },
  };
}

/**
 * Score collection overlap between two products.
 * Returns a score in [0, 1].
 */
export function scoreCollectionOverlap(
  a: ProductSnapshot,
  b: ProductSnapshot,
): EvidenceContribution | null {
  const collectionsA = a.effectiveCollectionIds ?? a.collectionIds;
  const collectionsB = b.effectiveCollectionIds ?? b.collectionIds;
  if (collectionsA.length === 0 || collectionsB.length === 0) return null;

  const sharedCollections = collectionsA.filter(c => collectionsB.includes(c));
  if (sharedCollections.length === 0) return null;

  const score = sharedCollections.length / Math.min(collectionsA.length, collectionsB.length);

  return {
    evidenceType: EvidenceType.COLLECTION,
    score: Math.min(1.0, score),
    details: { sharedCollections },
  };
}

export function scoreColorwayOverlap(
  a: ProductSnapshot,
  b: ProductSnapshot,
): EvidenceContribution | null {
  const colorwaysA = a.colorwayKeys ?? [];
  const colorwaysB = b.colorwayKeys ?? [];
  if (colorwaysA.length === 0 || colorwaysB.length === 0) {
    return null;
  }

  const sharedColorways = colorwaysA.filter((colorway) => colorwaysB.includes(colorway));
  if (sharedColorways.length === 0) {
    return null;
  }

  return {
    evidenceType: EvidenceType.COLORWAY,
    score: Math.min(1, sharedColorways.length / Math.min(colorwaysA.length, colorwaysB.length)),
    details: { sharedColorways },
  };
}

/**
 * Score vendor / catalog-metadata similarity.
 * Simple heuristic: same vendor and same productType => moderate signal.
 */
export function scoreCatalogMetadata(
  a: ProductSnapshot,
  b: ProductSnapshot,
): EvidenceContribution | null {
  let score = 0;
  const matches: string[] = [];

  if (a.vendor && b.vendor && a.vendor === b.vendor) {
    score += 0.3;
    matches.push(`vendor:${a.vendor}`);
  }
  if (a.productType && b.productType && a.productType === b.productType) {
    score += 0.4;
    matches.push(`productType:${a.productType}`);
  }

  // Shared tags (beyond taxonomy)
  const sharedTags = a.tags.filter(t => b.tags.includes(t));
  if (sharedTags.length > 0) {
    score += Math.min(0.3, sharedTags.length * 0.05);
    matches.push(`tags:${sharedTags.join(",")}`);
  }

  if (score === 0) return null;

  return {
    evidenceType: EvidenceType.CATALOG_METADATA,
    score: Math.min(1.0, score),
    details: { matches },
  };
}

// ---------------------------------------------------------------------------
// Aggregate evidence into a final strength
// ---------------------------------------------------------------------------

const EVIDENCE_WEIGHTS: Record<EvidenceType, number> = {
  [EvidenceType.TAXONOMY]: 0.35,
  [EvidenceType.COLLECTION]: 0.25,
  [EvidenceType.COLORWAY]: 0.2,
  [EvidenceType.EMBEDDING]: 0.20,
  [EvidenceType.CATALOG_METADATA]: 0.15,
  [EvidenceType.MERCHANT_RULE]: 1.0, // merchant evidence always dominates
  [EvidenceType.COPURCHASE]: 0.30,
};

export function aggregateStrength(contributions: EvidenceContribution[]): number {
  if (contributions.length === 0) return 0;

  let totalWeight = 0;
  let weightedSum = 0;

  for (const c of contributions) {
    const w = EVIDENCE_WEIGHTS[c.evidenceType] ?? 0.1;
    weightedSum += c.score * w;
    totalWeight += w;
  }

  return totalWeight > 0 ? Math.min(1.0, weightedSum / totalWeight) : 0;
}

// ---------------------------------------------------------------------------
// Candidate generation
// ---------------------------------------------------------------------------

/**
 * Generate relationship candidates between `source` and a batch of `peers`
 * using catalog-based evidence (taxonomy, collection, catalog-metadata).
 *
 * Returns only the top `MAX_CANDIDATES_PER_TYPE` per relationship type,
 * sorted descending by strength.
 */
export function generateCandidatesFromCatalog(
  source: ProductSnapshot,
  peers: ProductSnapshot[],
): RankedCandidate[] {
  const rawCandidates: RankedCandidate[] = [];

  for (const peer of peers) {
    // Self-relationship guard
    if (peer.id === source.id) continue;

    const contributions: EvidenceContribution[] = [];

    const taxonomy = scoreTaxonomyOverlap(source, peer);
    if (taxonomy) contributions.push(taxonomy);

    const collection = scoreCollectionOverlap(source, peer);
    if (collection) contributions.push(collection);

    const colorway = scoreColorwayOverlap(source, peer);
    if (colorway) contributions.push(colorway);

    const catalog = scoreCatalogMetadata(source, peer);
    if (catalog) contributions.push(catalog);

    if (contributions.length === 0) continue;

    const strength = aggregateStrength(contributions);
    if (strength < 0.1) continue; // discard negligible signal

    // Infer relationship type from evidence pattern
    const type = inferRelationshipType(source, peer, contributions);
    const { sourceProductId, targetProductId } = canonicalizePair(source.id, peer.id, type);

    rawCandidates.push({
      sourceProductId,
      targetProductId,
      relationshipType: type,
      directionality: getDirectionality(type),
      strength,
      evidenceContributions: contributions,
    });
  }

  // Deduplicate by normalized pair key, keeping highest strength
  const deduplicated = deduplicateCandidates(rawCandidates);

  // Sort descending by strength and cap per type
  return capCandidatesPerType(deduplicated);
}

/**
 * Infer a relationship type from the evidence pattern.
 * - Same collection and matching taxonomy => SAME_COLLECTION or ALTERNATIVES
 * - Strong taxonomy + different types => COMPLEMENTS
 * - Matching category, possibly upgrade path => UPGRADES (placeholder heuristic)
 */
function inferRelationshipType(
  source: ProductSnapshot,
  peer: ProductSnapshot,
  contributions: EvidenceContribution[],
): RelationshipType {
  const hasCollection = contributions.some(c => c.evidenceType === EvidenceType.COLLECTION);
  const hasTaxonomy = contributions.some(c => c.evidenceType === EvidenceType.TAXONOMY);
  const hasColorway = contributions.some(c => c.evidenceType === EvidenceType.COLORWAY);

  if (hasCollection) {
    // If they share taxonomy too, it's likely alternatives or same-collection
    if (hasTaxonomy) {
      return RelationshipType.SAME_COLLECTION;
    }
    return RelationshipType.SAME_COLLECTION;
  }

  if (hasColorway && hasTaxonomy) {
    return RelationshipType.ALTERNATIVES;
  }

  if (hasTaxonomy) {
    // Same discipline but different category implies complement signal
    const sharedDisciplines = source.disciplineTags.filter(t => peer.disciplineTags.includes(t));
    const sharedCategories = source.categoryTags.filter(t => peer.categoryTags.includes(t));

    if (sharedDisciplines.length > 0 && sharedCategories.length === 0) {
      return RelationshipType.COMPLEMENTS;
    }
    return RelationshipType.ALTERNATIVES;
  }

  return RelationshipType.COMPLEMENTS;
}

function deduplicateCandidates(candidates: RankedCandidate[]): RankedCandidate[] {
  const map = new Map<string, RankedCandidate>();

  for (const c of candidates) {
    const key = buildNormalizedPairKey(c.sourceProductId, c.targetProductId, c.relationshipType);
    const existing = map.get(key);
    if (!existing || c.strength > existing.strength) {
      map.set(key, c);
    }
  }

  return Array.from(map.values());
}

function capCandidatesPerType(candidates: RankedCandidate[]): RankedCandidate[] {
  const byType = new Map<RelationshipType, RankedCandidate[]>();

  for (const c of candidates) {
    const group = byType.get(c.relationshipType) ?? [];
    group.push(c);
    byType.set(c.relationshipType, group);
  }

  const result: RankedCandidate[] = [];
  for (const [, group] of byType) {
    result.push(
      ...group
        .sort((a, b) => b.strength - a.strength)
        .slice(0, MAX_CANDIDATES_PER_TYPE),
    );
  }

  return result;
}

// ---------------------------------------------------------------------------
// Persistence coordination
// ---------------------------------------------------------------------------

/**
 * Persist a batch of ranked candidates.
 * Delegates to the DB layer; skips records blocked by merchant overrides.
 */
export async function persistCandidates(
  shop: string,
  candidates: RankedCandidate[],
): Promise<void> {
  for (const c of candidates) {
    const candidate: RelationshipCandidate = {
      shop,
      sourceProductId: c.sourceProductId,
      targetProductId: c.targetProductId,
      relationshipType: c.relationshipType,
      directionality: c.directionality,
      strength: c.strength,
      origin: RelationshipOrigin.AUTO,
      evidenceSummary: {
        contributions: c.evidenceContributions.map(e => ({
          type: e.evidenceType,
          score: e.score,
          details: e.details,
        })),
      },
    };

    const evidenceInputs: EvidenceInput[] = c.evidenceContributions.map(e => ({
      evidenceType: e.evidenceType,
      score: e.score,
      details: e.details,
    }));

    await upsertCandidateRelationship(candidate, evidenceInputs);
  }
}

// ---------------------------------------------------------------------------
// Invalidation
// ---------------------------------------------------------------------------

/**
 * Mark all AUTO relationships where the given product participates as
 * INACTIVE when the product is deleted or deactivated.
 */
export async function invalidateRelationshipsForDeletedProduct(
  shop: string,
  internalProductId: string,
): Promise<void> {
  await invalidateRelationshipsForProduct(shop, internalProductId);
}

// ---------------------------------------------------------------------------
// Downstream read helpers for cart-intelligence consumers (US3 — T023/T024)
// ---------------------------------------------------------------------------

export type { ApprovedRelationshipRow };

export interface TrustedRelationshipsOptions {
  /** Relationship types to include. Omit to include all types. */
  types?: RelationshipType[];
  /** Minimum strength threshold. Defaults to 0.3. */
  minStrength?: number;
  /** Maximum results per relationship type. Defaults to 10. */
  limitPerType?: number;
}

/**
 * Return approved, non-invalidated relationships for `productId` in
 * priority order (COMPLEMENTS > UPGRADES > ALTERNATIVES > CONFLICTS > SAME_COLLECTION).
 *
 * This is the canonical accessor for cart-intelligence consumers. Callers
 * receive only relationships that passed merchant review or were
 * auto-generated with ACTIVE status — no filtering logic required downstream.
 */
export async function getTrustedRelationshipsForProduct(
  shop: string,
  internalProductId: string,
  options?: TrustedRelationshipsOptions,
): Promise<ApprovedRelationshipRow[]> {
  return getApprovedRelationshipsForProduct(shop, internalProductId, options);
}

/**
 * Return trusted relationships of a specific type for `productId`.
 * Convenience wrapper for single-type lookups common in cart intelligence.
 */
export async function getTrustedRelationshipsOfType(
  shop: string,
  internalProductId: string,
  type: RelationshipType,
  minStrength = 0.3,
  limit = 10,
): Promise<ApprovedRelationshipRow[]> {
  return getApprovedRelationshipsForProduct(shop, internalProductId, {
    types: [type],
    minStrength,
    limitPerType: limit,
  });
}

/** Re-export the raw active-relationship query for callers that need unfiltered access. */
export { getActiveRelationshipsForProduct };

// ---------------------------------------------------------------------------
// Orchestration: full-shop and incremental generation
// ---------------------------------------------------------------------------

/**
 * Generate and persist relationship candidates for all active products in a shop.
 * Intended to run after a full catalog sync completes.
 */
export async function generateRelationshipsForShop(shop: string): Promise<void> {
  const products = await getProductSnapshotsForShop(shop);

  if (products.length < 2) {
    // No peers — nothing to generate
    return;
  }

  // Collect all candidates in a single pass to reduce round-trips
  const allCandidates: RankedCandidate[] = [];
  for (const source of products) {
    const peers = products.filter(p => p.id !== source.id);
    allCandidates.push(...generateCandidatesFromCatalog(source, peers));
  }

  // Deduplicate across the full batch before persisting
  const deduplicated = new Map<string, RankedCandidate>();
  for (const c of allCandidates) {
    const key = buildNormalizedPairKey(c.sourceProductId, c.targetProductId, c.relationshipType);
    const existing = deduplicated.get(key);
    if (!existing || c.strength > existing.strength) {
      deduplicated.set(key, c);
    }
  }

  if (deduplicated.size > 0) {
    await persistCandidates(shop, Array.from(deduplicated.values()));
  }
}

/**
 * Re-generate relationship candidates for a single product against its
 * shop peers. Called after an incremental (webhook) product sync.
 */
export async function regenerateRelationshipsForProduct(
  shop: string,
  internalProductId: string,
): Promise<void> {
  const allProducts = await getProductSnapshotsForShop(shop);
  const source = allProducts.find(p => p.id === internalProductId);

  if (!source) {
    // Product not yet visible (e.g. not ACTIVE) — skip silently
    return;
  }

  const peers = allProducts.filter(p => p.id !== internalProductId);
  const candidates = generateCandidatesFromCatalog(source, peers);

  if (candidates.length > 0) {
    await persistCandidates(shop, candidates);
  }
}
