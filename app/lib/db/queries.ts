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
