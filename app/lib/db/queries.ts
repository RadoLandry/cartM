import { Prisma, SyncJobStatus, WebhookProcessingStatus } from "@prisma/client";
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
