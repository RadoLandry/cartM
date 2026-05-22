import {
  Prisma,
  SyncJobStatus,
  WebhookProcessingStatus,
  RelationshipType,
  RelationshipDirectionality,
  RelationshipStatus,
  RelationshipOrigin,
  EvidenceType,
} from "@prisma/client";
import db from "../../db.server";

export async function createSyncJob(shop: string) {
  return await db.syncJob.create({
    data: {
      shop,
      status: SyncJobStatus.IN_PROGRESS,
      startedAt: new Date(),
    },
  });
}

export async function updateSyncJobProgress(id: string, syncedCount: number, failedCount: number, totalCount?: number) {
  return await db.syncJob.update({
    where: { id },
    data: {
      status: SyncJobStatus.IN_PROGRESS,
      syncedCount,
      failedCount,
      ...(totalCount !== undefined ? { totalCount } : {}),
      updatedAt: new Date(),
    },
  });
}

export async function completeSyncJob(id: string) {
  return await db.syncJob.update({
    where: { id },
    data: {
      status: SyncJobStatus.COMPLETED,
      completedAt: new Date(),
    },
  });
}

export async function failSyncJob(id: string) {
  return await db.syncJob.update({
    where: { id },
    data: {
      status: SyncJobStatus.FAILED,
      completedAt: new Date(),
    },
  });
}

export async function getActiveSyncJob(shop: string) {
  return await db.syncJob.findFirst({
    where: {
      shop,
      status: SyncJobStatus.IN_PROGRESS,
    },
  });
}

export async function getLatestSyncJob(shop: string) {
  return await db.syncJob.findFirst({
    where: { shop },
    orderBy: { startedAt: "desc" },
  });
}

export async function countProductsForShop(shop: string) {
  return await db.product.count({
    where: { shop },
  });
}

export async function countProductVariantsForShop(shop: string) {
  return await db.productVariant.count({
    where: {
      product: {
        shop,
      },
    },
  });
}

import { NormalizedProduct } from "../knowledge-graph/normalization";

export async function upsertProduct(shop: string, productData: NormalizedProduct) {
  const { shopifyProductId, variants, ...rest } = productData;

  return await db.$transaction(async (tx: Prisma.TransactionClient) => {
    const product = await tx.product.upsert({
      where: { shopifyProductId },
      update: {
        ...rest,
        shop,
        updatedAt: new Date(),
      },
      create: {
        ...rest,
        shopifyProductId,
        shop,
      },
    });

    if (variants) {
      const variantIds = variants.map((variant) => variant.shopifyVariantId);

      await tx.productVariant.deleteMany({
        where: {
          productId: product.id,
          ...(variantIds.length > 0
            ? { shopifyVariantId: { notIn: variantIds } }
            : {}),
        },
      });

      for (const variant of variants) {
        const { shopifyVariantId, ...variantRest } = variant;
        await tx.productVariant.upsert({
          where: { shopifyVariantId },
          update: {
            ...variantRest,
            updatedAt: new Date(),
          },
          create: {
            ...variantRest,
            shopifyVariantId,
            productId: product.id,
          },
        });
      }
    }

    return product;
  });
}

export async function deleteProduct(shopifyProductId: string) {
  return await db.product.deleteMany({
    where: { shopifyProductId },
  });
}

/**
 * Find a product's internal record by its Shopify GID.
 * Returns null if not found.
 */
export async function findProductByShopifyId(shopifyProductId: string) {
  return await db.product.findUnique({
    where: { shopifyProductId },
    select: { id: true, shop: true, status: true },
  });
}

export async function createWebhookEvent(
  shop: string,
  eventId: string,
  topic: string,
  payload: Record<string, unknown>,
) {
  return await db.webhookEvent.upsert({
    where: { eventId },
    update: {
      processingStatus: WebhookProcessingStatus.DUPLICATE,
    },
    create: {
      eventId,
      shop,
      topic,
      payload: payload as Prisma.InputJsonValue,
      processingStatus: WebhookProcessingStatus.PENDING,
    },
  });
}

export async function markWebhookProcessed(eventId: string) {
  return await db.webhookEvent.update({
    where: { eventId },
    data: {
      processingStatus: WebhookProcessingStatus.PROCESSED,
      processedAt: new Date(),
    },
  });
}

// ---------------------------------------------------------------------------
// Taxonomy queries
// ---------------------------------------------------------------------------

/**
 * Update taxonomy classification for a product.
 * Only updates if the product is NOT manually classified (i.e., merchant has not locked it).
 */
export async function updateProductClassification(
  shopifyProductId: string,
  disciplineTags: string[],
  categoryTags: string[],
  classificationConfidence: number,
) {
  return await db.product.updateMany({
    where: {
      shopifyProductId,
      isManuallyClassified: false,
    },
    data: {
      disciplineTags,
      categoryTags,
      classificationConfidence,
      updatedAt: new Date(),
    },
  });
}

/**
 * Persist a vector embedding for a product.
 * Uses raw SQL because Prisma does not support Unsupported("vector") in update().
 * Expects exactly 1536 dimensions (OpenAI text-embedding-ada-002 / text-embedding-3-small).
 */
export async function updateProductEmbedding(shopifyProductId: string, embedding: number[]) {
  if (embedding.length !== 1536) {
    throw new Error(
      `Invalid embedding dimension: expected 1536, got ${embedding.length} for product ${shopifyProductId}`,
    );
  }

  // pgvector literal format: '[0.1,0.2,...]'::vector
  const literal = `[${embedding.join(",")}]`;
  await db.$executeRaw`
    UPDATE "Product"
    SET embedding = ${literal}::vector
    WHERE "shopifyProductId" = ${shopifyProductId}
  `;
}

/**
 * Apply a merchant override to a product's taxonomy classification.
 * Sets isManuallyClassified = true to prevent future automated overwrites.
 */
export async function applyMerchantTaxonomyOverride(
  shopifyProductId: string,
  disciplineTags: string[],
  categoryTags: string[],
) {
  return await db.product.updateMany({
    where: { shopifyProductId },
    data: {
      disciplineTags,
      categoryTags,
      classificationConfidence: 1.0,
      isManuallyClassified: true,
      updatedAt: new Date(),
    },
  });
}

/**
 * Get all products for a shop that need merchant review:
 * - Not manually classified AND confidence below threshold
 * Returns paginated results (cursor-based).
 */
export async function getLowConfidenceProducts(
  shop: string,
  confidenceThreshold: number,
  take = 50,
  cursor?: string,
) {
  return await db.product.findMany({
    where: {
      shop,
      isManuallyClassified: false,
      classificationConfidence: {
        lt: confidenceThreshold,
      },
    },
    select: {
      id: true,
      shopifyProductId: true,
      title: true,
      handle: true,
      disciplineTags: true,
      categoryTags: true,
      classificationConfidence: true,
      isManuallyClassified: true,
    },
    orderBy: { classificationConfidence: "asc" },
    take,
    ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
  });
}

/**
 * Get all products for a shop with their taxonomy classification.
 * Used for the admin knowledge graph editor overview.
 */
export async function getProductsWithTaxonomy(
  shop: string,
  take = 50,
  cursor?: string,
) {
  return await db.product.findMany({
    where: { shop },
    select: {
      id: true,
      shopifyProductId: true,
      title: true,
      handle: true,
      disciplineTags: true,
      categoryTags: true,
      classificationConfidence: true,
      isManuallyClassified: true,
    },
    orderBy: { updatedAt: "desc" },
    take,
    ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
  });
}

// ---------------------------------------------------------------------------
// Product Relationship Mapping — persistence helpers
// ---------------------------------------------------------------------------

export interface RelationshipCandidate {
  shop: string;
  sourceProductId: string;
  targetProductId: string;
  relationshipType: RelationshipType;
  directionality: RelationshipDirectionality;
  strength: number;
  origin: RelationshipOrigin;
  evidenceSummary?: Record<string, unknown>;
}

export interface EvidenceInput {
  evidenceType: EvidenceType;
  score: number;
  details?: Record<string, unknown>;
}

/**
 * Upsert a candidate relationship and replace its evidence rows.
 * Merchant-authored ACTIVE or REJECTED records are never overwritten by
 * AUTO candidates — auto candidates only touch records with origin AUTO and
 * status CANDIDATE or INACTIVE (unless no record exists yet).
 */
export async function upsertCandidateRelationship(
  candidate: RelationshipCandidate,
  evidence: EvidenceInput[],
) {
  const { shop, sourceProductId, targetProductId, relationshipType } = candidate;

  return await db.$transaction(async (tx: Prisma.TransactionClient) => {
    // Check for a merchant-authored record that takes precedence
    const existing = await tx.productRelationship.findFirst({
      where: { shop, sourceProductId, targetProductId, relationshipType },
      select: { id: true, origin: true, status: true },
    });

    if (
      existing &&
      existing.origin === RelationshipOrigin.MERCHANT &&
      (existing.status === RelationshipStatus.ACTIVE || existing.status === RelationshipStatus.REJECTED)
    ) {
      // Merchant decision wins — do not overwrite
      return null;
    }

    const rel = await tx.productRelationship.upsert({
      where: {
        shop_sourceProductId_targetProductId_relationshipType: {
          shop,
          sourceProductId,
          targetProductId,
          relationshipType,
        },
      },
      update: {
        directionality: candidate.directionality,
        strength: candidate.strength,
        origin: candidate.origin,
        evidenceSummary: candidate.evidenceSummary
          ? (candidate.evidenceSummary as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        status: RelationshipStatus.CANDIDATE,
        invalidatedAt: null,
        updatedAt: new Date(),
      },
      create: {
        shop,
        sourceProductId,
        targetProductId,
        relationshipType,
        directionality: candidate.directionality,
        strength: candidate.strength,
        origin: candidate.origin,
        status: RelationshipStatus.CANDIDATE,
        evidenceSummary: candidate.evidenceSummary
          ? (candidate.evidenceSummary as Prisma.InputJsonValue)
          : Prisma.JsonNull,
      },
    });

    // Replace evidence rows for this relationship
    if (evidence.length > 0) {
      await tx.relationshipEvidence.deleteMany({ where: { productRelationshipId: rel.id } });
      await tx.relationshipEvidence.createMany({
        data: evidence.map(e => ({
          productRelationshipId: rel.id,
          evidenceType: e.evidenceType,
          score: e.score,
          details: e.details ? (e.details as Prisma.InputJsonValue) : Prisma.JsonNull,
        })),
      });
    }

    return rel;
  });
}

/**
 * Mark all AUTO relationships for a product (source OR target) as INACTIVE
 * when the product is deleted or deactivated.
 */
export async function invalidateRelationshipsForProduct(
  shop: string,
  internalProductId: string,
): Promise<void> {
  await db.productRelationship.updateMany({
    where: {
      shop,
      origin: RelationshipOrigin.AUTO,
      status: { in: [RelationshipStatus.CANDIDATE, RelationshipStatus.ACTIVE] },
      OR: [
        { sourceProductId: internalProductId },
        { targetProductId: internalProductId },
      ],
    },
    data: {
      status: RelationshipStatus.INACTIVE,
      invalidatedAt: new Date(),
      updatedAt: new Date(),
    },
  });
}

/**
 * Fetch all ACTIVE relationships for a product (as source or target).
 * Used by downstream cart-intelligence consumers.
 */
export async function getActiveRelationshipsForProduct(
  shop: string,
  internalProductId: string,
  types?: RelationshipType[],
  limitPerType = 10,
) {
  const where: Prisma.ProductRelationshipWhereInput = {
    shop,
    status: RelationshipStatus.ACTIVE,
    invalidatedAt: null,
    OR: [
      { sourceProductId: internalProductId },
      { targetProductId: internalProductId },
    ],
    ...(types && types.length > 0 ? { relationshipType: { in: types } } : {}),
  };

  const rows = await db.productRelationship.findMany({
    where,
    orderBy: [{ relationshipType: "asc" }, { strength: "desc" }],
    select: {
      id: true,
      sourceProductId: true,
      targetProductId: true,
      relationshipType: true,
      directionality: true,
      strength: true,
      origin: true,
      status: true,
    },
  });

  // Cap per type
  const byType = new Map<RelationshipType, typeof rows>();
  for (const row of rows) {
    const group = byType.get(row.relationshipType) ?? [];
    if (group.length < limitPerType) {
      group.push(row);
      byType.set(row.relationshipType, group);
    }
  }

  return Array.from(byType.values()).flat();
}

/**
 * Return all active products for a shop as lightweight snapshots for
 * relationship candidate generation.
 */
export async function getProductSnapshotsForShop(shop: string) {
  return await db.product.findMany({
    where: { shop, status: "ACTIVE" },
    select: {
      id: true,
      shopifyProductId: true,
      title: true,
      disciplineTags: true,
      categoryTags: true,
      collectionIds: true,
      tags: true,
      productType: true,
      vendor: true,
      status: true,
    },
  });
}

/**
 * Return all candidate (non-rejected) relationships for a shop, used in the
 * admin review surface (US2 — partial loader used by T015).
 */
export async function getCandidateRelationships(
  shop: string,
  take = 50,
  cursor?: string,
) {
  return await db.productRelationship.findMany({
    where: { shop, status: RelationshipStatus.CANDIDATE },
    orderBy: [{ strength: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      sourceProductId: true,
      targetProductId: true,
      relationshipType: true,
      directionality: true,
      strength: true,
      origin: true,
      status: true,
      evidenceSummary: true,
      createdAt: true,
    },
    take,
    ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
  });
}

