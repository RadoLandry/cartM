import {
  AnalyticsCustomerType,
  AnalyticsEventSource,
  AnalyticsEventType,
  Prisma,
  BundleComponentMatchMode,
  BundleDiscountType,
  BundleRuleSource,
  BundleRuleStatus,
  ColorCompatibility,
  KitDefinitionSource,
  KitDefinitionStatus,
  ReplenishmentDefaultAction,
  ReplenishmentPreferredAction,
  ReplenishmentRuleSource,
  ThresholdBenefitType,
  ThresholdDuplicatePurchasePolicy,
  ThresholdRuleSource,
  ThresholdRuleStatus,
  SyncJobStatus,
  WebhookProcessingStatus,
  RelationshipType,
  RelationshipDirectionality,
  RelationshipStatus,
  RelationshipOrigin,
  EvidenceType,
  OverrideAction,
  RequirementMatchMode,
  SizeChartSource,
  SizeConflictSeverity,
  VisualProfileSource,
  VisualReviewStatus,
  KnowledgeGraphBulkOperationStatus,
  KnowledgeGraphBulkOperationType,
  KnowledgeGraphChangeAction,
  KnowledgeGraphEntityType,
  KnowledgeGraphOverrideDimension,
  ExportReportFormat,
  ExportReportStatus,
  AIBehaviorAuditAction,
  AIBehaviorSafetyPriority,
  AIBehaviorTone,
  AIBehaviorVersionStatus,
  AIBehaviorPreviewStatus,
} from "@prisma/client";
import db from "../../db.server";
import {
  AI_BEHAVIOR_DEFAULTS,
  clampAggressiveness,
  normalizeConversationStarters,
  normalizeCustomGuidance,
} from "../ai/behavior-config";
import type {
  BundleCompletionCandidateProduct,
  BundleProjectionRecord,
  BundleRuleComponentDefinition,
  BundleRuleRecord,
} from "../knowledge-graph/bundles";
import { toBundleProjection } from "../knowledge-graph/bundles";
import {
  resolveEffectiveVisualProfile,
  resolveSelectedColorwayKey,
  type CollectionSummary,
} from "../knowledge-graph/colorways";
import type { CartVisualItem } from "../cart-intelligence/style-coherence";
import type {
  CartThresholdItem,
  ThresholdCandidateProduct,
  ThresholdRuleRecord,
} from "../knowledge-graph/thresholds";

export interface UpsertAnalyticsEventInput {
  shop: string;
  eventType: AnalyticsEventType;
  occurredAt: Date;
  source: AnalyticsEventSource;
  idempotencyKey: string;
  sourceEventId?: string | null;
  sessionId?: string | null;
  customerId?: string | null;
  customerType?: AnalyticsCustomerType | null;
  payload?: Record<string, unknown> | null;
}

export async function upsertAnalyticsEvent(input: UpsertAnalyticsEventInput) {
  const {
    shop,
    eventType,
    occurredAt,
    source,
    idempotencyKey,
    sourceEventId,
    sessionId,
    customerId,
    customerType,
    payload,
  } = input;

  return await db.analyticsEvent.upsert({
    where: {
      shop_idempotencyKey: {
        shop,
        idempotencyKey,
      },
    },
    update: {
      eventType,
      occurredAt,
      source,
      sourceEventId,
      sessionId,
      customerId,
      customerType,
      payload: payload ? (payload as Prisma.InputJsonValue) : undefined,
      receivedAt: new Date(),
    },
    create: {
      shop,
      eventType,
      occurredAt,
      source,
      idempotencyKey,
      sourceEventId,
      sessionId,
      customerId,
      customerType,
      payload: payload ? (payload as Prisma.InputJsonValue) : undefined,
    },
  });
}

export interface UpsertKpiSnapshotInput {
  shop: string;
  kpiKey: string;
  periodStart: Date;
  periodEnd: Date;
  granularity: "DAY" | "WEEK" | "MONTH";
  value: Prisma.Decimal | number | string;
  sampleSize?: number;
  segment?: Record<string, unknown> | null;
  dataFreshUntil?: Date | null;
}

export async function upsertKpiSnapshot(input: UpsertKpiSnapshotInput) {
  const {
    shop,
    kpiKey,
    periodStart,
    periodEnd,
    granularity,
    value,
    sampleSize = 0,
    segment,
    dataFreshUntil,
  } = input;

  return await db.kpiSnapshot.upsert({
    where: {
      shop_kpiKey_periodStart_periodEnd: {
        shop,
        kpiKey,
        periodStart,
        periodEnd,
      },
    },
    update: {
      granularity,
      value: new Prisma.Decimal(value),
      sampleSize,
      segment: segment ? (segment as Prisma.InputJsonValue) : undefined,
      dataFreshUntil,
      computedAt: new Date(),
    },
    create: {
      shop,
      kpiKey,
      periodStart,
      periodEnd,
      granularity,
      value: new Prisma.Decimal(value),
      sampleSize,
      segment: segment ? (segment as Prisma.InputJsonValue) : undefined,
      dataFreshUntil,
    },
  });
}

export async function getKpiSnapshots(
  shop: string,
  startDate: Date,
  endDate: Date,
  kpiKeys?: string[],
) {
  return await db.kpiSnapshot.findMany({
    where: {
      shop,
      periodStart: {
        gte: startDate,
      },
      periodEnd: {
        lte: endDate,
      },
      ...(kpiKeys && kpiKeys.length > 0 ? { kpiKey: { in: kpiKeys } } : {}),
    },
    orderBy: [{ periodStart: "asc" }, { kpiKey: "asc" }],
  });
}

export interface CreateAttributionRecordInput {
  shop: string;
  attributionType: "RECOMMENDATION" | "CHAT" | "BUNDLE";
  sourceEventId: string;
  outcomeEventId: string;
  attributionWindowMinutes: number;
  confidence: Prisma.Decimal | number | string;
  sessionId?: string | null;
  customerId?: string | null;
}

export async function createAttributionRecord(input: CreateAttributionRecordInput) {
  return await db.attributionRecord.create({
    data: {
      shop: input.shop,
      attributionType: input.attributionType,
      sourceEventId: input.sourceEventId,
      outcomeEventId: input.outcomeEventId,
      attributionWindowMinutes: input.attributionWindowMinutes,
      confidence: new Prisma.Decimal(input.confidence),
      sessionId: input.sessionId,
      customerId: input.customerId,
    },
  });
}

export interface CreateExportReportInput {
  shop: string;
  requestedBy: string;
  periodStart: Date;
  periodEnd: Date;
  format?: ExportReportFormat;
  filters?: Record<string, unknown> | null;
}

export async function createExportReport(input: CreateExportReportInput) {
  return await db.exportReport.create({
    data: {
      shop: input.shop,
      requestedBy: input.requestedBy,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      format: input.format ?? ExportReportFormat.CSV,
      filters: input.filters ? (input.filters as Prisma.InputJsonValue) : undefined,
      status: ExportReportStatus.PENDING,
    },
  });
}

export async function updateExportReportStatus(
  id: string,
  status: ExportReportStatus,
  options?: {
    downloadUrl?: string | null;
    expiresAt?: Date | null;
    errorCode?: string | null;
    completedAt?: Date | null;
  },
) {
  return await db.exportReport.update({
    where: { id },
    data: {
      status,
      downloadUrl: options?.downloadUrl,
      expiresAt: options?.expiresAt,
      errorCode: options?.errorCode,
      completedAt: options?.completedAt,
      updatedAt: new Date(),
    },
  });
}

export async function getExportReportById(id: string, shop: string) {
  return await db.exportReport.findFirst({
    where: {
      id,
      shop,
    },
  });
}

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
  const { shopifyProductId, variants, collectionSummaries: _collectionSummaries, ...rest } = productData;

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

export interface SimilarProduct {
  shopifyProductId: string;
  title: string;
  description: string | null;
  handle: string;
  disciplineTags: string[];
  categoryTags: string[];
  productType: string | null;
  shopifyVariantId: string | null;
  variantTitle: string | null;
  variantImageUrl: string | null;
}

// Returns the top-k products nearest to the query vector using cosine distance (<=>).
export async function findSimilarProducts(
  shop: string,
  queryEmbedding: number[],
  limit = 5,
  excludeShopifyProductIds: string[] = [],
): Promise<SimilarProduct[]> {
  const literal = `[${queryEmbedding.join(",")}]`;
  const excludedProductIds = Array.from(new Set(excludeShopifyProductIds));
  const excludeClause = excludedProductIds.length > 0
    ? Prisma.sql`AND "shopifyProductId" NOT IN (${Prisma.join(excludedProductIds)})`
    : Prisma.empty;

  return db.$queryRaw<SimilarProduct[]>`
    SELECT
      p."shopifyProductId",
      p.title,
      p.description,
      p.handle,
      p."disciplineTags",
      p."categoryTags",
      p."productType",
      (
        SELECT v."shopifyVariantId"
        FROM "ProductVariant" v
        WHERE v."productId" = p.id AND COALESCE(v."inventoryQuantity", 0) > 0
        ORDER BY v."inventoryQuantity" DESC NULLS LAST
        LIMIT 1
      ) AS "shopifyVariantId",
      (
        SELECT v.title
        FROM "ProductVariant" v
        WHERE v."productId" = p.id AND COALESCE(v."inventoryQuantity", 0) > 0
        ORDER BY v."inventoryQuantity" DESC NULLS LAST
        LIMIT 1
      ) AS "variantTitle",
      (
        SELECT v."imageUrl"
        FROM "ProductVariant" v
        WHERE v."productId" = p.id AND COALESCE(v."inventoryQuantity", 0) > 0
        ORDER BY v."inventoryQuantity" DESC NULLS LAST
        LIMIT 1
      ) AS "variantImageUrl"
    FROM "Product" p
    WHERE p.shop = ${shop}
      AND p.embedding IS NOT NULL
      AND p.status = 'ACTIVE'
      ${excludeClause}
    ORDER BY p.embedding <=> ${literal}::vector
    LIMIT ${limit}
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

export async function upsertMerchantRelationship(input: {
  shop: string;
  sourceProductId: string;
  targetProductId: string;
  relationshipType: RelationshipType;
  directionality: RelationshipDirectionality;
  strength: number;
  evidenceSummary?: Record<string, unknown>;
}) {
  const {
    shop,
    sourceProductId,
    targetProductId,
    relationshipType,
    directionality,
    strength,
    evidenceSummary,
  } = input;

  return await db.productRelationship.upsert({
    where: {
      shop_sourceProductId_targetProductId_relationshipType: {
        shop,
        sourceProductId,
        targetProductId,
        relationshipType,
      },
    },
    update: {
      directionality,
      strength,
      status: RelationshipStatus.ACTIVE,
      origin: RelationshipOrigin.MERCHANT,
      evidenceSummary: evidenceSummary
        ? (evidenceSummary as Prisma.InputJsonValue)
        : Prisma.JsonNull,
      reviewedAt: new Date(),
      invalidatedAt: null,
      updatedAt: new Date(),
    },
    create: {
      shop,
      sourceProductId,
      targetProductId,
      relationshipType,
      directionality,
      strength,
      status: RelationshipStatus.ACTIVE,
      origin: RelationshipOrigin.MERCHANT,
      evidenceSummary: evidenceSummary
        ? (evidenceSummary as Prisma.InputJsonValue)
        : Prisma.JsonNull,
      reviewedAt: new Date(),
    },
  });
}

export async function deactivateRelationshipRule(shop: string, relationshipId: string) {
  return await db.productRelationship.updateMany({
    where: {
      id: relationshipId,
      shop,
    },
    data: {
      status: RelationshipStatus.INACTIVE,
      invalidatedAt: new Date(),
      updatedAt: new Date(),
    },
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
 * Relationship type priority order for downstream cart-intelligence consumers.
 * Lower index = higher priority.
 */
const RELATIONSHIP_TYPE_PRIORITY: Record<RelationshipType, number> = {
  [RelationshipType.COMPLEMENTS]: 0,
  [RelationshipType.UPGRADES]: 1,
  [RelationshipType.ALTERNATIVES]: 2,
  [RelationshipType.CONFLICTS]: 3,
  [RelationshipType.SAME_COLLECTION]: 4,
};

export interface ApprovedRelationshipRow {
  id: string;
  sourceProductId: string;
  targetProductId: string;
  relationshipType: RelationshipType;
  directionality: RelationshipDirectionality;
  strength: number;
  origin: RelationshipOrigin;
  reviewedAt: Date | null;
}

/**
 * Read-model query for downstream cart-intelligence consumers.
 * Returns only ACTIVE, non-invalidated relationships above a minimum strength threshold,
 * ordered by relationship type priority then strength descending.
 */
export async function getApprovedRelationshipsForProduct(
  shop: string,
  internalProductId: string,
  options?: {
    types?: RelationshipType[];
    minStrength?: number;
    limitPerType?: number;
  },
): Promise<ApprovedRelationshipRow[]> {
  const { types, minStrength = 0.3, limitPerType = 10 } = options ?? {};

  const where: Prisma.ProductRelationshipWhereInput = {
    shop,
    status: RelationshipStatus.ACTIVE,
    invalidatedAt: null,
    strength: { gte: minStrength },
    OR: [
      { sourceProductId: internalProductId },
      { targetProductId: internalProductId },
    ],
    ...(types && types.length > 0 ? { relationshipType: { in: types } } : {}),
  };

  const rows = await db.productRelationship.findMany({
    where,
    orderBy: [{ strength: "desc" }],
    select: {
      id: true,
      sourceProductId: true,
      targetProductId: true,
      relationshipType: true,
      directionality: true,
      strength: true,
      origin: true,
      reviewedAt: true,
    },
  });

  // Cap per type while preserving priority ordering
  const byType = new Map<RelationshipType, ApprovedRelationshipRow[]>();
  for (const row of rows) {
    const group = byType.get(row.relationshipType) ?? [];
    if (group.length < limitPerType) {
      group.push(row);
      byType.set(row.relationshipType, group);
    }
  }

  return Array.from(byType.entries())
    .sort(([a], [b]) => (RELATIONSHIP_TYPE_PRIORITY[a] ?? 99) - (RELATIONSHIP_TYPE_PRIORITY[b] ?? 99))
    .flatMap(([, rows]) => rows);
}

// ---------------------------------------------------------------------------
// Colorway & Collection Tracking — query helpers
// ---------------------------------------------------------------------------

export interface CollectionSummaryRow {
  shopifyCollectionId: string;
  title: string;
  handle: string;
}

export interface UpsertProductVisualProfileInput {
  productId: string;
  shop: string;
  dominantColors: string[];
  detectedColorwayKeys: string[];
  overrideColorwayKeys?: string[];
  detectedCollections: CollectionSummaryRow[];
  overrideCollections?: CollectionSummaryRow[] | null;
  visualConfidence?: number | null;
  reviewStatus?: VisualReviewStatus;
  source?: VisualProfileSource;
  extractionSummary?: Record<string, unknown> | null;
}

export interface CreateColorCompatibilityRuleInput {
  shop: string;
  sourceColorwayKey: string;
  targetColorwayKey: string;
  compatibility: ColorCompatibility;
  source?: VisualProfileSource;
  rationale?: string | null;
}

export async function upsertProductVisualProfile(input: UpsertProductVisualProfileInput) {
  const {
    productId,
    shop,
    dominantColors,
    detectedColorwayKeys,
    overrideColorwayKeys = [],
    detectedCollections,
    overrideCollections,
    visualConfidence = null,
    reviewStatus = VisualReviewStatus.NEEDS_REVIEW,
    source = VisualProfileSource.AUTO,
    extractionSummary = null,
  } = input;

  return await db.productVisualProfile.upsert({
    where: { productId },
    update: {
      shop,
      dominantColors: dominantColors as unknown as Prisma.InputJsonValue,
      detectedColorwayKeys,
      detectedCollections: detectedCollections as unknown as Prisma.InputJsonValue,
      visualConfidence,
      extractionSummary: extractionSummary
        ? (extractionSummary as Prisma.InputJsonValue)
        : Prisma.JsonNull,
      updatedAt: new Date(),
      ...(overrideColorwayKeys.length > 0 ? { overrideColorwayKeys } : {}),
      ...(overrideCollections !== undefined
        ? {
            overrideCollections: overrideCollections
              ? (overrideCollections as unknown as Prisma.InputJsonValue)
              : Prisma.JsonNull,
          }
        : {}),
      ...(source !== VisualProfileSource.AUTO ? { source } : {}),
      ...(reviewStatus !== VisualReviewStatus.NEEDS_REVIEW ? { reviewStatus } : {}),
    },
    create: {
      productId,
      shop,
      dominantColors: dominantColors as unknown as Prisma.InputJsonValue,
      detectedColorwayKeys,
      overrideColorwayKeys,
      detectedCollections: detectedCollections as unknown as Prisma.InputJsonValue,
      overrideCollections: overrideCollections
        ? (overrideCollections as unknown as Prisma.InputJsonValue)
        : Prisma.JsonNull,
      visualConfidence,
      reviewStatus,
      source,
      extractionSummary: extractionSummary
        ? (extractionSummary as Prisma.InputJsonValue)
        : Prisma.JsonNull,
    },
    include: {
      product: {
        select: {
          shopifyProductId: true,
          title: true,
          handle: true,
        },
      },
    },
  });
}

export async function getProductVisualProfile(productId: string) {
  return await db.productVisualProfile.findUnique({
    where: { productId },
    include: {
      product: {
        select: {
          id: true,
          shopifyProductId: true,
          title: true,
          handle: true,
        },
      },
    },
  });
}

export async function listVisualProfilesForReview(shop: string, take = 50) {
  return await db.productVisualProfile.findMany({
    where: { shop },
    include: {
      product: {
        select: {
          id: true,
          shopifyProductId: true,
          title: true,
          handle: true,
        },
      },
    },
    orderBy: [
      { reviewStatus: "asc" },
      { visualConfidence: "asc" },
      { updatedAt: "desc" },
    ],
    take,
  });
}

export async function saveProductVisualOverride(
  productId: string,
  overrideColorwayKeys: string[],
  overrideCollections: CollectionSummaryRow[] | null,
) {
  return await db.productVisualProfile.update({
    where: { productId },
    data: {
      overrideColorwayKeys,
      overrideCollections: overrideCollections
        ? (overrideCollections as unknown as Prisma.InputJsonValue)
        : Prisma.JsonNull,
      reviewStatus: VisualReviewStatus.MERCHANT_REVIEWED,
      source: VisualProfileSource.HYBRID,
      updatedAt: new Date(),
    },
  });
}

export async function resetProductVisualOverride(productId: string) {
  return await db.productVisualProfile.update({
    where: { productId },
    data: {
      overrideColorwayKeys: [],
      overrideCollections: Prisma.JsonNull,
      source: VisualProfileSource.AUTO,
      updatedAt: new Date(),
    },
  });
}

export async function listColorCompatibilityRules(shop: string) {
  return await db.colorCompatibilityRule.findMany({
    where: { shop },
    orderBy: [
      { sourceColorwayKey: "asc" },
      { targetColorwayKey: "asc" },
    ],
  });
}

export async function getColorCompatibilityRulesForKeys(
  shop: string,
  colorwayKeys: string[],
) {
  return await db.colorCompatibilityRule.findMany({
    where: {
      shop,
      OR: [
        { sourceColorwayKey: { in: colorwayKeys } },
        { targetColorwayKey: { in: colorwayKeys } },
      ],
    },
  });
}

export async function createColorCompatibilityRule(input: CreateColorCompatibilityRuleInput) {
  const {
    shop,
    sourceColorwayKey,
    targetColorwayKey,
    compatibility,
    source = VisualProfileSource.MERCHANT,
    rationale = null,
  } = input;

  return await db.colorCompatibilityRule.create({
    data: {
      shop,
      sourceColorwayKey,
      targetColorwayKey,
      compatibility,
      source,
      rationale,
    },
  });
}

export async function deleteColorCompatibilityRule(id: string) {
  return await db.colorCompatibilityRule.delete({ where: { id } });
}

export async function getProductsForVisualBackfill(
  shop: string,
  take = 100,
  cursor?: string,
) {
  return await db.product.findMany({
    where: { shop, status: "ACTIVE" },
    select: {
      id: true,
      shop: true,
      shopifyProductId: true,
      title: true,
      handle: true,
      tags: true,
      metafields: true,
      dominantColors: true,
      collectionIds: true,
      variants: {
        select: {
          title: true,
          imageUrl: true,
        },
      },
      visualProfile: {
        select: {
          overrideColorwayKeys: true,
          overrideCollections: true,
        },
      },
    },
    orderBy: { updatedAt: "desc" },
    take,
    ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
  });
}

export interface StyleCartLineInput {
  productId: string;
  variantId?: string | null;
  quantity?: number;
}

function mapCollectionsForCart(
  collections: CollectionSummary[],
  source: "shopify" | "merchant",
) {
  return collections.map((collection) => ({
    key: collection.handle || collection.shopifyCollectionId,
    label: collection.title,
    source,
  }));
}

function mapProductRecordToCartVisualItem(product: {
  id: string;
  title: string;
  categoryTags: string[];
  variants: Array<{
    id: string;
    title: string;
    inventoryQuantity: number | null;
  }>;
  visualProfile: {
    productId: string;
    dominantColors: Prisma.JsonValue;
    detectedColorwayKeys: string[];
    overrideColorwayKeys: string[];
    detectedCollections: Prisma.JsonValue;
    overrideCollections: Prisma.JsonValue | null;
    visualConfidence: number | null;
    reviewStatus: VisualReviewStatus;
    source: VisualProfileSource;
    extractionSummary: Prisma.JsonValue | null;
  } | null;
}, selection?: StyleCartLineInput): CartVisualItem | null {
  if (!product.visualProfile) {
    return null;
  }

  const effective = resolveEffectiveVisualProfile({
    productId: product.visualProfile.productId,
    dominantColors: (product.visualProfile.dominantColors as string[]) ?? [],
    detectedColorwayKeys: product.visualProfile.detectedColorwayKeys,
    overrideColorwayKeys: product.visualProfile.overrideColorwayKeys,
    detectedCollections: (product.visualProfile.detectedCollections as unknown as CollectionSummary[]) ?? [],
    overrideCollections: (product.visualProfile.overrideCollections as CollectionSummary[] | null) ?? null,
    visualConfidence: product.visualProfile.visualConfidence,
    reviewStatus: product.visualProfile.reviewStatus,
    source: product.visualProfile.source,
    extractionSummary: {
      tokenMatches: [],
      paletteSource: "none",
      notes: [],
    },
  });

  const selectedVariant = selection?.variantId
    ? product.variants.find((variant) => variant.id === selection.variantId)
    : product.variants.find((variant) => (variant.inventoryQuantity ?? 0) > 0) ?? product.variants[0];

  const collectionSource = product.visualProfile.overrideCollections ? "merchant" : "shopify";

  return {
    productId: product.id,
    title: product.title,
    categoryTags: product.categoryTags,
    availableForSale: (selectedVariant?.inventoryQuantity ?? 0) > 0,
    selectedVariantId: selectedVariant?.id,
    selectedColorwayKey: resolveSelectedColorwayKey(selectedVariant?.title, effective.colorwayKeys, {
      preferFallback: product.visualProfile.overrideColorwayKeys.length > 0,
    }),
    visualProfile: {
      dominantColors: effective.dominantColors,
      effectiveColorwayKeys: effective.colorwayKeys,
      effectiveCollections: mapCollectionsForCart(effective.collections, collectionSource),
      visualConfidence: effective.visualConfidence,
    },
  };
}

export async function listCartVisualItems(
  shop: string,
  cartLines: StyleCartLineInput[],
): Promise<CartVisualItem[]> {
  const productIds = Array.from(new Set(cartLines.map((line) => line.productId)));

  if (productIds.length === 0) {
    return [];
  }

  const products = await db.product.findMany({
    where: {
      shop,
      id: { in: productIds },
    },
    select: {
      id: true,
      title: true,
      categoryTags: true,
      variants: {
        select: {
          id: true,
          title: true,
          inventoryQuantity: true,
        },
      },
      visualProfile: {
        select: {
          productId: true,
          dominantColors: true,
          detectedColorwayKeys: true,
          overrideColorwayKeys: true,
          detectedCollections: true,
          overrideCollections: true,
          visualConfidence: true,
          reviewStatus: true,
          source: true,
          extractionSummary: true,
        },
      },
    },
  });

  const productMap = new Map(products.map((product) => [product.id, product]));

  return cartLines
    .map((line) => mapProductRecordToCartVisualItem(productMap.get(line.productId)!, line))
    .filter((item): item is CartVisualItem => Boolean(item));
}

export async function listStyleCandidateProducts(
  shop: string,
  input: {
    categoryTags: string[];
    excludeProductIds?: string[];
    swapProductSelections?: Array<{
      productId: string;
      variantId?: string | null;
    }>;
    take?: number;
  },
): Promise<CartVisualItem[]> {
  const take = input.take ?? 50;
  const swapProductIds = new Set((input.swapProductSelections ?? []).map((selection) => selection.productId));
  const excludedProductIds = (input.excludeProductIds ?? []).filter((productId) => !swapProductIds.has(productId));

  if (input.categoryTags.length === 0) {
    return [];
  }

  const products = await db.product.findMany({
    where: {
      shop,
      status: "ACTIVE",
      id: {
        notIn: excludedProductIds,
      },
      categoryTags: {
        hasSome: input.categoryTags,
      },
      visualProfile: {
        isNot: null,
      },
    },
    select: {
      id: true,
      title: true,
      categoryTags: true,
      variants: {
        select: {
          id: true,
          title: true,
          inventoryQuantity: true,
        },
        orderBy: [
          { inventoryQuantity: "desc" },
          { createdAt: "asc" },
        ],
      },
      visualProfile: {
        select: {
          productId: true,
          dominantColors: true,
          detectedColorwayKeys: true,
          overrideColorwayKeys: true,
          detectedCollections: true,
          overrideCollections: true,
          visualConfidence: true,
          reviewStatus: true,
          source: true,
          extractionSummary: true,
        },
      },
    },
    orderBy: { updatedAt: "desc" },
    take,
  });

  const swapSelectionMap = new Map(
    (input.swapProductSelections ?? []).map((selection) => [selection.productId, selection]),
  );

  const candidates = products.flatMap((product) => {
    const swapSelection = swapSelectionMap.get(product.id);

    if (!swapSelection) {
      const primaryCandidate = mapProductRecordToCartVisualItem(product);
      return primaryCandidate ? [primaryCandidate] : [];
    }

    return product.variants
      .filter((variant) => variant.id !== swapSelection.variantId)
      .map((variant) => mapProductRecordToCartVisualItem(product, {
        productId: product.id,
        variantId: variant.id,
      }))
      .filter((item): item is CartVisualItem => item != null && item.availableForSale);
  });

  const seen = new Set<string>();

  return candidates
    .filter((item) => {
      const key = `${item.productId}:${item.selectedVariantId ?? "default"}`;
      if (seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    })
    .filter((item): item is CartVisualItem => Boolean(item));
}

/**
 * Return all active products for a shop as lightweight snapshots for
 * relationship candidate generation.
 */
export async function getProductSnapshotsForShop(shop: string) {
  const products = await db.product.findMany({
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
      visualProfile: {
        select: {
          detectedColorwayKeys: true,
          overrideColorwayKeys: true,
          detectedCollections: true,
          overrideCollections: true,
        },
      },
    },
  });

  return products.map((product) => {
    const detectedCollections = ((product.visualProfile?.detectedCollections as CollectionSummaryRow[] | null) ?? [])
      .map((collection) => collection.shopifyCollectionId);
    const overrideCollections = ((product.visualProfile?.overrideCollections as CollectionSummaryRow[] | null) ?? [])
      .map((collection) => collection.shopifyCollectionId);

    return {
      id: product.id,
      shopifyProductId: product.shopifyProductId,
      title: product.title,
      disciplineTags: product.disciplineTags,
      categoryTags: product.categoryTags,
      collectionIds: product.collectionIds,
      effectiveCollectionIds: overrideCollections.length > 0
        ? overrideCollections
        : detectedCollections.length > 0
          ? detectedCollections
          : product.collectionIds,
      colorwayKeys: product.visualProfile
        ? product.visualProfile.overrideColorwayKeys.length > 0
          ? product.visualProfile.overrideColorwayKeys
          : product.visualProfile.detectedColorwayKeys
        : [],
      tags: product.tags,
      productType: product.productType,
      vendor: product.vendor,
      status: product.status,
    };
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

// ---------------------------------------------------------------------------
// Size & Fit Intelligence — query helpers
// ---------------------------------------------------------------------------

/** JSON schema for a single size breakpoint stored in SizeChart.breakpoints */
export interface SizeBreakpointRow {
  label: string;
  attributeType: "weightKg" | "chestCm" | "waistCm" | "weightClass" | string;
  min: number | null;
  max: number | null;
  note?: string;
}

export interface UpsertSizeChartInput {
  shop: string;
  categoryTag: string;
  sizeSystem: string;
  breakpoints: SizeBreakpointRow[];
  source?: SizeChartSource;
}

export interface CreateCrossSizeMappingInput {
  shop: string;
  sourceCategoryTag: string;
  sourceSize: string;
  targetCategoryTag: string;
  targetSize: string;
  severityOnMismatch?: SizeConflictSeverity;
  source?: SizeChartSource;
}

export async function getSizeChartForCategory(
  shop: string,
  categoryTag: string,
  sizeSystem: string,
) {
  return await db.sizeChart.findUnique({
    where: { shop_categoryTag_sizeSystem: { shop, categoryTag, sizeSystem } },
  });
}

export async function getCrossSizeMappingsForPair(
  shop: string,
  catA: string,
  catB: string,
) {
  return await db.crossSizeMapping.findMany({
    where: {
      shop,
      OR: [
        { sourceCategoryTag: catA, targetCategoryTag: catB },
        { sourceCategoryTag: catB, targetCategoryTag: catA },
      ],
    },
  });
}

export interface VariantAvailabilityRow {
  id: string;
  productId: string;
  shopifyVariantId: string;
  title: string;
  sizeValue: string | null;
  sizeCategory: string | null;
  sizeNumeric: number | null;
  inventoryQuantity: number | null;
}

export interface CrossSizeMappingPreviewResult {
  evaluated: boolean;
  severity?: SizeConflictSeverity;
  expectedSize?: string;
  message?: string;
}

export async function findVariantByProductAndSize(
  productId: string,
  sizeValue: string,
): Promise<VariantAvailabilityRow | null> {
  return await db.productVariant.findFirst({
    where: { productId, sizeValue },
    select: {
      id: true,
      productId: true,
      shopifyVariantId: true,
      title: true,
      sizeValue: true,
      sizeCategory: true,
      sizeNumeric: true,
      inventoryQuantity: true,
    },
  });
}

export async function listVariantsForProduct(productId: string): Promise<VariantAvailabilityRow[]> {
  return await db.productVariant.findMany({
    where: { productId },
    orderBy: [{ sizeCategory: "asc" }, { sizeNumeric: "asc" }, { sizeValue: "asc" }],
    select: {
      id: true,
      productId: true,
      shopifyVariantId: true,
      title: true,
      sizeValue: true,
      sizeCategory: true,
      sizeNumeric: true,
      inventoryQuantity: true,
    },
  });
}

export async function previewCrossSizeConflict(
  shop: string,
  sourceCategoryTag: string,
  sourceSize: string,
  targetCategoryTag: string,
  targetSize: string,
): Promise<CrossSizeMappingPreviewResult> {
  const mappings = await getCrossSizeMappingsForPair(shop, sourceCategoryTag, targetCategoryTag);

  const mapping = mappings.find(
    (row) =>
      row.sourceCategoryTag === sourceCategoryTag &&
      row.sourceSize === sourceSize &&
      row.targetCategoryTag === targetCategoryTag,
  );

  if (!mapping) {
    return {
      evaluated: false,
      message: "No compatibility mapping exists for the selected category pair.",
    };
  }

  if (mapping.targetSize === targetSize) {
    return {
      evaluated: true,
      severity: mapping.severityOnMismatch,
      expectedSize: mapping.targetSize,
      message: `${sourceCategoryTag} size ${sourceSize} is compatible with ${targetCategoryTag} size ${targetSize}.`,
    };
  }

  return {
    evaluated: true,
    severity: mapping.severityOnMismatch,
    expectedSize: mapping.targetSize,
    message: `${sourceCategoryTag} size ${sourceSize} typically pairs with ${targetCategoryTag} size ${mapping.targetSize}, not ${targetSize}.`,
  };
}

export async function getSizeChartsForCategories(shop: string, categoryTags: string[]) {
  if (categoryTags.length === 0) {
    return [];
  }

  return await db.sizeChart.findMany({
    where: {
      shop,
      categoryTag: { in: categoryTags },
    },
    orderBy: [{ categoryTag: "asc" }, { sizeSystem: "asc" }],
  });
}

export async function upsertSizeChart(data: UpsertSizeChartInput) {
  const { shop, categoryTag, sizeSystem, breakpoints, source = SizeChartSource.AUTO } = data;
  return await db.sizeChart.upsert({
    where: { shop_categoryTag_sizeSystem: { shop, categoryTag, sizeSystem } },
    update: {
      breakpoints: breakpoints as unknown as Prisma.InputJsonValue,
      source,
      version: { increment: 1 },
      updatedAt: new Date(),
    },
    create: {
      shop,
      categoryTag,
      sizeSystem,
      breakpoints: breakpoints as unknown as Prisma.InputJsonValue,
      source,
    },
  });
}

export async function saveSizeChartOverride(id: string, overrideBreakpoints: SizeBreakpointRow[]) {
  return await db.sizeChart.update({
    where: { id },
    data: {
      overrideBreakpoints: overrideBreakpoints as unknown as Prisma.InputJsonValue,
      source: SizeChartSource.MERCHANT,
      updatedAt: new Date(),
    },
  });
}

export async function resetSizeChartOverride(id: string) {
  return await db.sizeChart.update({
    where: { id },
    data: {
      overrideBreakpoints: Prisma.JsonNull,
      source: SizeChartSource.AUTO,
      updatedAt: new Date(),
    },
  });
}

export async function createCrossSizeMapping(data: CreateCrossSizeMappingInput) {
  const {
    shop,
    sourceCategoryTag,
    sourceSize,
    targetCategoryTag,
    targetSize,
    severityOnMismatch = SizeConflictSeverity.WARNING,
    source = SizeChartSource.AUTO,
  } = data;
  return await db.crossSizeMapping.create({
    data: { shop, sourceCategoryTag, sourceSize, targetCategoryTag, targetSize, severityOnMismatch, source },
  });
}

export async function deleteCrossSizeMapping(id: string) {
  return await db.crossSizeMapping.delete({ where: { id } });
}

export async function getSizeChartsForShop(shop: string) {
  return await db.sizeChart.findMany({
    where: { shop },
    orderBy: [{ categoryTag: "asc" }, { sizeSystem: "asc" }],
  });
}

export async function getCrossSizeMappingsForShop(shop: string) {
  return await db.crossSizeMapping.findMany({
    where: { shop },
    orderBy: [{ sourceCategoryTag: "asc" }, { sourceSize: "asc" }],
  });
}

export async function getDistinctSizeCategoryTagsForShop(shop: string): Promise<string[]> {
  const rows = await db.productVariant.findMany({
    where: { product: { shop }, sizeCategory: { not: null } },
    select: { sizeCategory: true },
    distinct: ["sizeCategory"],
  });
  return rows.map((r) => r.sizeCategory as string);
}

export async function getDistinctDisciplineTagsForShop(shop: string): Promise<string[]> {
  const rows = await db.product.findMany({
    where: { shop },
    select: { disciplineTags: true },
  });

  const tagSet = new Set<string>();
  for (const row of rows) {
    for (const tag of row.disciplineTags) {
      if (tag) {
        tagSet.add(tag);
      }
    }
  }

  return Array.from(tagSet).sort();
}

// ---------------------------------------------------------------------------
// Knowledge Graph Editor — foundational query helpers
// ---------------------------------------------------------------------------

export async function createProductClassificationOverride(input: {
  shop: string;
  productId: string;
  dimension: KnowledgeGraphOverrideDimension;
  overrideValues: string[];
  createdBy?: string | null;
}) {
  return await db.$transaction(async (tx) => {
    await tx.productClassificationOverride.updateMany({
      where: {
        shop: input.shop,
        productId: input.productId,
        dimension: input.dimension,
        isActive: true,
      },
      data: {
        isActive: false,
        supersededAt: new Date(),
        updatedAt: new Date(),
      },
    });

    return await tx.productClassificationOverride.create({
      data: {
        shop: input.shop,
        productId: input.productId,
        dimension: input.dimension,
        overrideValues: input.overrideValues,
        createdBy: input.createdBy ?? null,
      },
    });
  });
}

export async function listActiveProductClassificationOverrides(
  shop: string,
  productIds: string[],
) {
  if (productIds.length === 0) {
    return [];
  }

  return await db.productClassificationOverride.findMany({
    where: {
      shop,
      productId: { in: productIds },
      isActive: true,
    },
    orderBy: { updatedAt: "desc" },
  });
}

export async function createKnowledgeGraphBulkOperation(input: {
  shop: string;
  operationType: KnowledgeGraphBulkOperationType;
  targetCount: number;
  previewHash: string;
  initiatedBy?: string | null;
}) {
  return await db.knowledgeGraphBulkOperation.create({
    data: {
      shop: input.shop,
      operationType: input.operationType,
      targetCount: input.targetCount,
      previewHash: input.previewHash,
      initiatedBy: input.initiatedBy ?? null,
      status: KnowledgeGraphBulkOperationStatus.PREVIEWED,
    },
  });
}

export async function updateKnowledgeGraphBulkOperationStatus(input: {
  id: string;
  status: KnowledgeGraphBulkOperationStatus;
  startedAt?: Date | null;
  finishedAt?: Date | null;
}) {
  return await db.knowledgeGraphBulkOperation.update({
    where: { id: input.id },
    data: {
      status: input.status,
      startedAt: input.startedAt ?? undefined,
      finishedAt: input.finishedAt ?? undefined,
      updatedAt: new Date(),
    },
  });
}

export async function createKnowledgeGraphChangeLog(input: {
  shop: string;
  actorId?: string | null;
  entityType: KnowledgeGraphEntityType;
  entityId: string;
  action: KnowledgeGraphChangeAction;
  beforeSnapshot?: Prisma.InputJsonValue | null;
  afterSnapshot?: Prisma.InputJsonValue | null;
  reason?: string | null;
  bulkOperationId?: string | null;
}) {
  return await db.knowledgeGraphChangeLog.create({
    data: {
      shop: input.shop,
      actorId: input.actorId ?? null,
      entityType: input.entityType,
      entityId: input.entityId,
      action: input.action,
      beforeSnapshot: input.beforeSnapshot ?? Prisma.JsonNull,
      afterSnapshot: input.afterSnapshot ?? Prisma.JsonNull,
      reason: input.reason ?? null,
      bulkOperationId: input.bulkOperationId ?? null,
    },
  });
}

export async function listKnowledgeGraphChangeLogForEntity(input: {
  shop: string;
  entityType: KnowledgeGraphEntityType;
  entityId: string;
  take?: number;
}) {
  return await db.knowledgeGraphChangeLog.findMany({
    where: {
      shop: input.shop,
      entityType: input.entityType,
      entityId: input.entityId,
    },
    orderBy: { createdAt: "desc" },
    take: input.take ?? 50,
  });
}

// ---------------------------------------------------------------------------
// Kit Completeness Detection — query helpers
// ---------------------------------------------------------------------------

export interface UpsertKitDefinitionInput {
  id?: string;
  shop: string;
  key: string;
  label: string;
  disciplineTag: string;
  description?: string | null;
  source?: KitDefinitionSource;
  status?: KitDefinitionStatus;
}

export interface UpsertKitRequirementInput {
  id?: string;
  kitDefinitionId: string;
  requirementKey: string;
  label: string;
  description?: string | null;
  isRequired?: boolean;
  priority?: number;
  safetyCritical?: boolean;
  matchMode?: RequirementMatchMode;
  acceptedCategoryTags?: string[];
  acceptedShopifyProductIds?: string[];
  acceptedRelationshipTypes?: RelationshipType[];
  minQuantity?: number;
}

export async function upsertKitDefinition(input: UpsertKitDefinitionInput) {
  const {
    id,
    shop,
    key,
    label,
    disciplineTag,
    description = null,
    source = KitDefinitionSource.AUTO,
    status = KitDefinitionStatus.ACTIVE,
  } = input;

  if (id) {
    return await db.kitDefinition.update({
      where: { id },
      data: {
        key,
        label,
        disciplineTag,
        description,
        source,
        status,
        updatedAt: new Date(),
      },
      include: {
        requirements: {
          orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
        },
      },
    });
  }

  return await db.kitDefinition.upsert({
    where: {
      shop_key: {
        shop,
        key,
      },
    },
    update: {
      label,
      disciplineTag,
      description,
      source,
      status,
      updatedAt: new Date(),
    },
    create: {
      shop,
      key,
      label,
      disciplineTag,
      description,
      source,
      status,
    },
    include: {
      requirements: {
        orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
      },
    },
  });
}

export async function upsertKitRequirement(input: UpsertKitRequirementInput) {
  const {
    id,
    kitDefinitionId,
    requirementKey,
    label,
    description = null,
    isRequired = true,
    priority = 100,
    safetyCritical = false,
    matchMode = RequirementMatchMode.CATEGORY,
    acceptedCategoryTags = [],
    acceptedShopifyProductIds = [],
    acceptedRelationshipTypes = [],
    minQuantity = 1,
  } = input;

  if (id) {
    return await db.kitRequirement.update({
      where: { id },
      data: {
        requirementKey,
        label,
        description,
        isRequired,
        priority,
        safetyCritical,
        matchMode,
        acceptedCategoryTags,
        acceptedShopifyProductIds,
        acceptedRelationshipTypes,
        minQuantity,
        updatedAt: new Date(),
      },
    });
  }

  return await db.kitRequirement.upsert({
    where: {
      kitDefinitionId_requirementKey: {
        kitDefinitionId,
        requirementKey,
      },
    },
    update: {
      label,
      description,
      isRequired,
      priority,
      safetyCritical,
      matchMode,
      acceptedCategoryTags,
      acceptedShopifyProductIds,
      acceptedRelationshipTypes,
      minQuantity,
      updatedAt: new Date(),
    },
    create: {
      kitDefinitionId,
      requirementKey,
      label,
      description,
      isRequired,
      priority,
      safetyCritical,
      matchMode,
      acceptedCategoryTags,
      acceptedShopifyProductIds,
      acceptedRelationshipTypes,
      minQuantity,
    },
  });
}

export async function deleteKitRequirement(requirementId: string) {
  return await db.kitRequirement.delete({
    where: { id: requirementId },
  });
}

export async function archiveKitDefinition(kitId: string) {
  return await db.kitDefinition.update({
    where: { id: kitId },
    data: {
      status: KitDefinitionStatus.ARCHIVED,
      updatedAt: new Date(),
    },
    include: {
      requirements: {
        orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
      },
    },
  });
}

export async function listKitDefinitionsForShop(shop: string, take = 50) {
  return await db.kitDefinition.findMany({
    where: { shop },
    orderBy: [{ status: "asc" }, { disciplineTag: "asc" }, { label: "asc" }],
    take,
    include: {
      requirements: {
        orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
      },
    },
  });
}

export async function listActiveKitDefinitions(shop: string, disciplineTags?: string[]) {
  return await db.kitDefinition.findMany({
    where: {
      shop,
      status: KitDefinitionStatus.ACTIVE,
      ...(disciplineTags && disciplineTags.length > 0
        ? { disciplineTag: { in: disciplineTags } }
        : {}),
    },
    orderBy: [{ disciplineTag: "asc" }, { label: "asc" }],
    include: {
      requirements: {
        orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
      },
    },
  });
}

type BundleRuleWithComponents = Prisma.BundleRuleGetPayload<{
  include: {
    components: {
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }];
    };
  };
}>;

function formatDecimal(value: Prisma.Decimal): string {
  return value.toFixed(2);
}

function mapBundleRuleRecord(rule: BundleRuleWithComponents): BundleRuleRecord {
  return {
    id: rule.id,
    key: rule.key,
    label: rule.label,
    description: rule.description,
    source: rule.source,
    status: rule.status,
    priority: rule.priority,
    completionThreshold: rule.completionThreshold,
    discountType: rule.discountType,
    discountValue: formatDecimal(rule.discountValue),
    components: rule.components.map((component) => ({
      id: component.id,
      componentKey: component.componentKey,
      label: component.label,
      description: component.description,
      isRequired: component.isRequired,
      sortOrder: component.sortOrder,
      minQuantity: component.minQuantity,
      matchMode: component.matchMode,
      acceptedCategoryTags: component.acceptedCategoryTags,
      acceptedShopifyProductIds: component.acceptedShopifyProductIds,
      acceptedShopifyVariantIds: component.acceptedShopifyVariantIds,
    })),
  };
}

type ThresholdRuleRow = Prisma.ThresholdRuleGetPayload<{
  select: {
    id: true;
    key: true;
    label: true;
    description: true;
    source: true;
    status: true;
    priority: true;
    benefitType: true;
    benefitLabel: true;
    targetSubtotal: true;
    actionableWindow: true;
    allowOvershoot: true;
    maxSuggestions: true;
    supportedDisciplineTags: true;
    supportedCategoryTags: true;
    excludedShopifyProductIds: true;
    duplicatePurchasePolicy: true;
  };
}>;

function mapThresholdRuleRecord(rule: ThresholdRuleRow): ThresholdRuleRecord {
  return {
    id: rule.id,
    key: rule.key,
    label: rule.label,
    description: rule.description,
    source: rule.source,
    status: rule.status,
    priority: rule.priority,
    benefitType: rule.benefitType,
    benefitLabel: rule.benefitLabel,
    targetSubtotal: Number(rule.targetSubtotal),
    actionableWindow: Number(rule.actionableWindow),
    allowOvershoot: rule.allowOvershoot,
    maxSuggestions: rule.maxSuggestions,
    supportedDisciplineTags: rule.supportedDisciplineTags,
    supportedCategoryTags: rule.supportedCategoryTags,
    excludedShopifyProductIds: rule.excludedShopifyProductIds,
    duplicatePurchasePolicy: rule.duplicatePurchasePolicy,
  };
}

export interface UpsertBundleRuleInput {
  id?: string;
  shop: string;
  key: string;
  label: string;
  description?: string | null;
  source?: BundleRuleSource;
  status?: BundleRuleStatus;
  priority?: number;
  completionThreshold?: number;
  discountType: BundleDiscountType;
  discountValue: Prisma.Decimal | number | string;
}

export interface CreateBundleRuleInput extends Omit<UpsertBundleRuleInput, "id"> {
  status?: BundleRuleStatus;
}

export interface UpdateBundleRuleInput {
  id: string;
  shop: string;
  key?: string;
  label?: string;
  description?: string | null;
  source?: BundleRuleSource;
  status?: BundleRuleStatus;
  priority?: number;
  completionThreshold?: number;
  discountType?: BundleDiscountType;
  discountValue?: Prisma.Decimal | number | string;
}

export interface UpsertBundleRuleComponentInput {
  id?: string;
  bundleRuleId: string;
  componentKey: string;
  label: string;
  description?: string | null;
  isRequired?: boolean;
  sortOrder?: number;
  matchMode?: BundleComponentMatchMode;
  acceptedCategoryTags?: string[];
  acceptedShopifyProductIds?: string[];
  acceptedShopifyVariantIds?: string[];
  minQuantity?: number;
}

export interface LogBundleRuleAuditEventInput {
  bundleRuleId: string;
  actionType: "CREATED" | "UPDATED" | "STATUS_CHANGED" | "DUPLICATED" | "ARCHIVED";
  actorId: string;
  fromStatus?: BundleRuleStatus | null;
  toStatus?: BundleRuleStatus | null;
  changeSummary: Prisma.JsonValue;
}

export async function logBundleRuleAuditEvent(input: LogBundleRuleAuditEventInput) {
  const {
    bundleRuleId,
    actionType,
    actorId,
    fromStatus = null,
    toStatus = null,
    changeSummary,
  } = input;

  const id = `bra_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  const payload = JSON.stringify(changeSummary ?? {});

  return await db.$executeRaw(Prisma.sql`
    INSERT INTO "BundleRuleAuditRecord"
      ("id", "bundleRuleId", "actionType", "actorId", "fromStatus", "toStatus", "changeSummary", "createdAt")
    VALUES
      (
        ${id},
        ${bundleRuleId},
        CAST(${actionType} AS "BundleRuleAuditAction"),
        ${actorId},
        CAST(${fromStatus} AS "BundleRuleStatus"),
        CAST(${toStatus} AS "BundleRuleStatus"),
        CAST(${payload} AS jsonb),
        NOW()
      )
  `);
}

export async function createBundleRule(input: CreateBundleRuleInput) {
  const {
    shop,
    key,
    label,
    description = null,
    source = BundleRuleSource.MERCHANT,
    status = BundleRuleStatus.DRAFT,
    priority = 100,
    completionThreshold = 0.8,
    discountType,
    discountValue,
  } = input;

  return await db.bundleRule.create({
    data: {
      shop,
      key,
      label,
      description,
      source,
      status,
      priority,
      completionThreshold,
      discountType,
      discountValue,
    },
    include: {
      components: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      },
    },
  });
}

export async function updateBundleRule(input: UpdateBundleRuleInput) {
  const {
    id,
    shop,
    key,
    label,
    description,
    source,
    status,
    priority,
    completionThreshold,
    discountType,
    discountValue,
  } = input;

  const rule = await db.bundleRule.findFirst({
    where: { id, shop },
    select: { id: true },
  });

  if (!rule) {
    return null;
  }

  const data: Prisma.BundleRuleUpdateInput = {
    updatedAt: new Date(),
  };

  if (key !== undefined) {
    data.key = key;
  }
  if (label !== undefined) {
    data.label = label;
  }
  if (description !== undefined) {
    data.description = description;
  }
  if (source !== undefined) {
    data.source = source;
  }
  if (status !== undefined) {
    data.status = status;
  }
  if (priority !== undefined) {
    data.priority = priority;
  }
  if (completionThreshold !== undefined) {
    data.completionThreshold = completionThreshold;
  }
  if (discountType !== undefined) {
    data.discountType = discountType;
  }
  if (discountValue !== undefined) {
    data.discountValue = discountValue;
  }

  return await db.bundleRule.update({
    where: { id: rule.id },
    data,
    include: {
      components: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      },
    },
  });
}

export async function upsertBundleRule(input: UpsertBundleRuleInput) {
  const {
    id,
    shop,
    key,
    label,
    description = null,
    source = BundleRuleSource.MERCHANT,
    status = BundleRuleStatus.DRAFT,
    priority = 100,
    completionThreshold = 0.8,
    discountType,
    discountValue,
  } = input;

  if (id) {
      return await updateBundleRule({
        id,
        shop,
        key,
        label,
        description,
        source,
        status,
        priority,
        completionThreshold,
        discountType,
        discountValue,
      });
  }

  return await db.bundleRule.upsert({
    where: {
      shop_key: {
        shop,
        key,
      },
    },
    update: {
      label,
      description,
      source,
      status,
      priority,
      completionThreshold,
      discountType,
      discountValue,
      updatedAt: new Date(),
    },
    create: {
      shop,
      key,
      label,
      description,
      source,
      status,
      priority,
      completionThreshold,
      discountType,
      discountValue,
    },
    include: {
      components: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      },
    },
  });
}

export async function upsertBundleRuleComponent(input: UpsertBundleRuleComponentInput) {
  const {
    id,
    bundleRuleId,
    componentKey,
    label,
    description = null,
    isRequired = true,
    sortOrder = 100,
    matchMode = BundleComponentMatchMode.CATEGORY_OR_PRODUCT,
    acceptedCategoryTags = [],
    acceptedShopifyProductIds = [],
    acceptedShopifyVariantIds = [],
    minQuantity = 1,
  } = input;

  if (id) {
    return await db.bundleRuleComponent.update({
      where: { id },
      data: {
        componentKey,
        label,
        description,
        isRequired,
        sortOrder,
        matchMode,
        acceptedCategoryTags,
        acceptedShopifyProductIds,
        acceptedShopifyVariantIds,
        minQuantity,
        updatedAt: new Date(),
      },
    });
  }

  return await db.bundleRuleComponent.upsert({
    where: {
      bundleRuleId_componentKey: {
        bundleRuleId,
        componentKey,
      },
    },
    update: {
      label,
      description,
      isRequired,
      sortOrder,
      matchMode,
      acceptedCategoryTags,
      acceptedShopifyProductIds,
      acceptedShopifyVariantIds,
      minQuantity,
      updatedAt: new Date(),
    },
    create: {
      bundleRuleId,
      componentKey,
      label,
      description,
      isRequired,
      sortOrder,
      matchMode,
      acceptedCategoryTags,
      acceptedShopifyProductIds,
      acceptedShopifyVariantIds,
      minQuantity,
    },
  });
}

export async function deleteBundleRuleComponent(componentId: string) {
  return await db.bundleRuleComponent.delete({
    where: { id: componentId },
  });
}

export async function archiveBundleRule(bundleRuleId: string) {
  return await db.bundleRule.update({
    where: { id: bundleRuleId },
    data: {
      status: BundleRuleStatus.ARCHIVED,
      updatedAt: new Date(),
    },
    include: {
      components: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      },
    },
  });
}

export async function getBundleRuleById(bundleRuleId: string): Promise<BundleRuleRecord | null> {
  const rule = await db.bundleRule.findUnique({
    where: { id: bundleRuleId },
    include: {
      components: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      },
    },
  });

  return rule ? mapBundleRuleRecord(rule) : null;
}

export async function listBundleRulesForShop(shop: string, take = 50): Promise<BundleRuleRecord[]> {
  const rules = await db.bundleRule.findMany({
    where: { shop },
    orderBy: [{ status: "asc" }, { priority: "asc" }, { label: "asc" }],
    take,
    include: {
      components: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      },
    },
  });

  return rules.map(mapBundleRuleRecord);
}

export async function listActiveBundleRules(shop: string): Promise<BundleRuleRecord[]> {
  const rules = await db.bundleRule.findMany({
    where: {
      shop,
      status: BundleRuleStatus.ACTIVE,
    },
    orderBy: [{ priority: "asc" }, { label: "asc" }],
    include: {
      components: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      },
    },
  });

  return rules.map(mapBundleRuleRecord);
}

export async function listActiveBundleRuleProjections(
  shop: string,
): Promise<BundleProjectionRecord[]> {
  const rules = await listActiveBundleRules(shop);
  return rules.map((rule) => toBundleProjection(rule));
}

export async function listProductsForBundleEditor(shop: string, take = 200) {
  return await db.product.findMany({
    where: { shop },
    select: {
      id: true,
      shopifyProductId: true,
      title: true,
      disciplineTags: true,
      categoryTags: true,
      status: true,
      variants: {
        select: {
          id: true,
          shopifyVariantId: true,
          title: true,
          inventoryQuantity: true,
        },
        orderBy: [{ title: "asc" }, { createdAt: "asc" }],
      },
    },
    orderBy: { updatedAt: "desc" },
    take,
  });
}

export async function listBundleCompletionCandidateProducts(
  shop: string,
  component: Pick<
    BundleRuleComponentDefinition,
    "acceptedCategoryTags" | "acceptedShopifyProductIds" | "acceptedShopifyVariantIds"
  >,
  take = 25,
): Promise<BundleCompletionCandidateProduct[]> {
  const filters: Prisma.ProductWhereInput[] = [];

  if (component.acceptedCategoryTags.length > 0) {
    filters.push({ categoryTags: { hasSome: component.acceptedCategoryTags } });
  }

  if (component.acceptedShopifyProductIds.length > 0) {
    filters.push({ shopifyProductId: { in: component.acceptedShopifyProductIds } });
  }

  if (component.acceptedShopifyVariantIds.length > 0) {
    filters.push({ variants: { some: { shopifyVariantId: { in: component.acceptedShopifyVariantIds } } } });
  }

  if (filters.length === 0) {
    return [];
  }

  const rows = await db.product.findMany({
    where: {
      shop,
      status: "ACTIVE",
      OR: filters,
    },
    select: {
      id: true,
      shopifyProductId: true,
      title: true,
      categoryTags: true,
      variants: {
        select: {
          id: true,
          shopifyVariantId: true,
          title: true,
          inventoryQuantity: true,
        },
        orderBy: [{ title: "asc" }, { createdAt: "asc" }],
      },
    },
    orderBy: { updatedAt: "desc" },
    take,
  });

  return rows.map((row) => ({
    productId: row.id,
    shopifyProductId: row.shopifyProductId,
    title: row.title,
    categoryTags: row.categoryTags,
    variants: row.variants,
  }));
}

export interface BundlePreviewCartFixtureLine {
  productId: string;
  variantId: string;
  quantity: number;
}

export async function listBundlePreviewCartItems(
  shop: string,
  fixture: BundlePreviewCartFixtureLine[],
) {
  if (fixture.length === 0) {
    return [];
  }

  const products = await db.product.findMany({
    where: {
      shop,
      id: { in: fixture.map((line) => line.productId) },
    },
    select: {
      id: true,
      shopifyProductId: true,
      title: true,
      categoryTags: true,
      disciplineTags: true,
      variants: {
        select: {
          id: true,
          shopifyVariantId: true,
          title: true,
          inventoryQuantity: true,
        },
      },
    },
  });

  const productsById = new Map(products.map((product) => [product.id, product]));

  return fixture.flatMap((line) => {
    const product = productsById.get(line.productId);
    const variant = product?.variants.find((candidate) => candidate.id === line.variantId);

    if (!product || !variant) {
      return [];
    }

    return [{
      productId: product.id,
      shopifyProductId: product.shopifyProductId,
      variantId: variant.id,
      shopifyVariantId: variant.shopifyVariantId,
      title: product.title,
      quantity: line.quantity,
      availableForSale: (variant.inventoryQuantity ?? 1) > 0,
      categoryTags: product.categoryTags,
      disciplineTags: product.disciplineTags,
    }];
  });
}

export async function getDistinctProductCategoryTagsForShop(shop: string): Promise<string[]> {
  const rows = await db.product.findMany({
    where: { shop },
    select: { categoryTags: true },
  });

  const tags = new Set<string>();
  for (const row of rows) {
    for (const tag of row.categoryTags) {
      tags.add(tag);
    }
  }

  return Array.from(tags).sort();
}

export interface UpsertThresholdRuleInput {
  id?: string;
  shop: string;
  key: string;
  label: string;
  description?: string | null;
  source?: ThresholdRuleSource;
  status?: ThresholdRuleStatus;
  priority?: number;
  benefitType: ThresholdBenefitType;
  benefitLabel: string;
  targetSubtotal: Prisma.Decimal | number | string;
  actionableWindow: Prisma.Decimal | number | string;
  allowOvershoot?: boolean;
  maxSuggestions?: number;
  supportedDisciplineTags?: string[];
  supportedCategoryTags?: string[];
  excludedShopifyProductIds?: string[];
  duplicatePurchasePolicy?: ThresholdDuplicatePurchasePolicy;
}

export async function upsertThresholdRule(input: UpsertThresholdRuleInput) {
  const {
    id,
    shop,
    key,
    label,
    description = null,
    source = ThresholdRuleSource.MERCHANT,
    status = ThresholdRuleStatus.DRAFT,
    priority = 100,
    benefitType,
    benefitLabel,
    targetSubtotal,
    actionableWindow,
    allowOvershoot = false,
    maxSuggestions = 3,
    supportedDisciplineTags = [],
    supportedCategoryTags = [],
    excludedShopifyProductIds = [],
    duplicatePurchasePolicy = ThresholdDuplicatePurchasePolicy.DISALLOW,
  } = input;

  if (id) {
    return await db.thresholdRule.update({
      where: { id },
      data: {
        key,
        label,
        description,
        source,
        status,
        priority,
        benefitType,
        benefitLabel,
        targetSubtotal,
        actionableWindow,
        allowOvershoot,
        maxSuggestions,
        supportedDisciplineTags,
        supportedCategoryTags,
        excludedShopifyProductIds,
        duplicatePurchasePolicy,
        updatedAt: new Date(),
      },
    });
  }

  return await db.thresholdRule.upsert({
    where: {
      shop_key: {
        shop,
        key,
      },
    },
    update: {
      label,
      description,
      source,
      status,
      priority,
      benefitType,
      benefitLabel,
      targetSubtotal,
      actionableWindow,
      allowOvershoot,
      maxSuggestions,
      supportedDisciplineTags,
      supportedCategoryTags,
      excludedShopifyProductIds,
      duplicatePurchasePolicy,
      updatedAt: new Date(),
    },
    create: {
      shop,
      key,
      label,
      description,
      source,
      status,
      priority,
      benefitType,
      benefitLabel,
      targetSubtotal,
      actionableWindow,
      allowOvershoot,
      maxSuggestions,
      supportedDisciplineTags,
      supportedCategoryTags,
      excludedShopifyProductIds,
      duplicatePurchasePolicy,
    },
  });
}

export async function archiveThresholdRule(thresholdRuleId: string) {
  return await db.thresholdRule.update({
    where: { id: thresholdRuleId },
    data: {
      status: ThresholdRuleStatus.ARCHIVED,
      updatedAt: new Date(),
    },
  });
}

export async function getThresholdRuleById(thresholdRuleId: string): Promise<ThresholdRuleRecord | null> {
  const rule = await db.thresholdRule.findUnique({
    where: { id: thresholdRuleId },
    select: {
      id: true,
      key: true,
      label: true,
      description: true,
      source: true,
      status: true,
      priority: true,
      benefitType: true,
      benefitLabel: true,
      targetSubtotal: true,
      actionableWindow: true,
      allowOvershoot: true,
      maxSuggestions: true,
      supportedDisciplineTags: true,
      supportedCategoryTags: true,
      excludedShopifyProductIds: true,
      duplicatePurchasePolicy: true,
    },
  });

  return rule ? mapThresholdRuleRecord(rule) : null;
}

export async function listThresholdRulesForShop(shop: string, take = 50): Promise<ThresholdRuleRecord[]> {
  const rules = await db.thresholdRule.findMany({
    where: { shop },
    orderBy: [{ status: "asc" }, { priority: "asc" }, { label: "asc" }],
    take,
    select: {
      id: true,
      key: true,
      label: true,
      description: true,
      source: true,
      status: true,
      priority: true,
      benefitType: true,
      benefitLabel: true,
      targetSubtotal: true,
      actionableWindow: true,
      allowOvershoot: true,
      maxSuggestions: true,
      supportedDisciplineTags: true,
      supportedCategoryTags: true,
      excludedShopifyProductIds: true,
      duplicatePurchasePolicy: true,
    },
  });

  return rules.map(mapThresholdRuleRecord);
}

export async function listActiveThresholdRules(shop: string): Promise<ThresholdRuleRecord[]> {
  const rules = await db.thresholdRule.findMany({
    where: {
      shop,
      status: ThresholdRuleStatus.ACTIVE,
    },
    orderBy: [{ priority: "asc" }, { label: "asc" }],
    select: {
      id: true,
      key: true,
      label: true,
      description: true,
      source: true,
      status: true,
      priority: true,
      benefitType: true,
      benefitLabel: true,
      targetSubtotal: true,
      actionableWindow: true,
      allowOvershoot: true,
      maxSuggestions: true,
      supportedDisciplineTags: true,
      supportedCategoryTags: true,
      excludedShopifyProductIds: true,
      duplicatePurchasePolicy: true,
    },
  });

  return rules.map(mapThresholdRuleRecord);
}

export async function listProductsForThresholdEditor(shop: string, take = 200) {
  return await db.product.findMany({
    where: { shop },
    select: {
      id: true,
      shopifyProductId: true,
      title: true,
      disciplineTags: true,
      categoryTags: true,
      status: true,
      variants: {
        select: {
          id: true,
          shopifyVariantId: true,
          title: true,
          price: true,
          inventoryQuantity: true,
        },
        orderBy: [{ title: "asc" }, { createdAt: "asc" }],
      },
    },
    orderBy: { updatedAt: "desc" },
    take,
  });
}

export async function listThresholdCandidateProducts(
  shop: string,
  rule: Pick<
    ThresholdRuleRecord,
    "supportedCategoryTags" | "supportedDisciplineTags" | "excludedShopifyProductIds"
  >,
  take = 50,
): Promise<ThresholdCandidateProduct[]> {
  const andFilters: Prisma.ProductWhereInput[] = [];

  if (rule.supportedCategoryTags.length > 0) {
    andFilters.push({ categoryTags: { hasSome: rule.supportedCategoryTags } });
  }

  if (rule.supportedDisciplineTags.length > 0) {
    andFilters.push({ disciplineTags: { hasSome: rule.supportedDisciplineTags } });
  }

  if (rule.excludedShopifyProductIds.length > 0) {
    andFilters.push({ shopifyProductId: { notIn: rule.excludedShopifyProductIds } });
  }

  const rows = await db.product.findMany({
    where: {
      shop,
      status: "ACTIVE",
      ...(andFilters.length > 0 ? { AND: andFilters } : {}),
    },
    select: {
      id: true,
      shopifyProductId: true,
      title: true,
      categoryTags: true,
      disciplineTags: true,
      variants: {
        select: {
          id: true,
          shopifyVariantId: true,
          title: true,
          price: true,
          inventoryQuantity: true,
        },
        orderBy: [{ title: "asc" }, { createdAt: "asc" }],
      },
    },
    orderBy: { updatedAt: "desc" },
    take,
  });

  return rows.map((row) => ({
    productId: row.id,
    shopifyProductId: row.shopifyProductId,
    title: row.title,
    categoryTags: row.categoryTags,
    disciplineTags: row.disciplineTags,
    variants: row.variants.map((variant) => ({
      id: variant.id,
      shopifyVariantId: variant.shopifyVariantId,
      title: variant.title,
      price: variant.price !== null ? Number(variant.price) : null,
      inventoryQuantity: variant.inventoryQuantity,
    })),
  }));
}

export interface ThresholdPreviewCartFixtureLine {
  productId: string;
  variantId: string;
  quantity: number;
}

export async function listThresholdPreviewCartItems(
  shop: string,
  fixture: ThresholdPreviewCartFixtureLine[],
): Promise<CartThresholdItem[]> {
  if (fixture.length === 0) {
    return [];
  }

  const products = await db.product.findMany({
    where: {
      shop,
      id: { in: fixture.map((line) => line.productId) },
    },
    select: {
      id: true,
      shopifyProductId: true,
      title: true,
      categoryTags: true,
      disciplineTags: true,
      variants: {
        select: {
          id: true,
          shopifyVariantId: true,
          title: true,
          price: true,
          inventoryQuantity: true,
        },
      },
    },
  });

  const productsById = new Map(products.map((product) => [product.id, product]));

  return fixture.flatMap((line) => {
    const product = productsById.get(line.productId);
    const variant = product?.variants.find((candidate) => candidate.id === line.variantId);

    if (!product || !variant) {
      return [];
    }

    return [{
      productId: product.id,
      shopifyProductId: product.shopifyProductId,
      variantId: variant.id,
      shopifyVariantId: variant.shopifyVariantId,
      title: product.title,
      quantity: line.quantity,
      availableForSale: (variant.inventoryQuantity ?? 1) > 0,
      categoryTags: product.categoryTags,
      disciplineTags: product.disciplineTags,
      unitPrice: variant.price !== null ? Number(variant.price) : null,
    }];
  });
}

export async function listProductsForKitEditor(shop: string, take = 200) {
  return await db.product.findMany({
    where: { shop },
    select: {
      id: true,
      shopifyProductId: true,
      title: true,
      disciplineTags: true,
      categoryTags: true,
      status: true,
    },
    orderBy: { updatedAt: "desc" },
    take,
  });
}

// ---------------------------------------------------------------------------
// Size Return Records
// ---------------------------------------------------------------------------

export interface InsertSizeReturnRecordInput {
  shop: string;
  shopifyOrderId: string;
  shopifyProductId: string;
  categoryTag: string;
  returnedSize: string;
  returnReason: string;
  returnedAt: Date;
}

export async function insertSizeReturnRecord(data: InsertSizeReturnRecordInput) {
  return await db.sizeReturnRecord.create({ data });
}

export async function getUnprocessedReturnsByCategoryForShop(
  shop: string,
  categoryTag: string,
) {
  return await db.sizeReturnRecord.findMany({
    where: { shop, categoryTag, processedForAdjustment: false },
    orderBy: { returnedAt: "asc" },
  });
}

export async function markReturnRecordsProcessed(ids: string[]) {
  return await db.sizeReturnRecord.updateMany({
    where: { id: { in: ids } },
    data: { processedForAdjustment: true },
  });
}

// ---------------------------------------------------------------------------
// Customer Profile & History
// ---------------------------------------------------------------------------

const customerProfileSelect = Prisma.validator<Prisma.CustomerProfileSelect>()({
  id: true,
  shop: true,
  shopifyCustomerId: true,
  sessionId: true,
  sizeProfile: true,
  disciplineProfile: true,
  explicitProfile: true,
  purchaseSummary: true,
  behaviorSummary: true,
  confidenceSummary: true,
  lastActiveAt: true,
  createdAt: true,
  updatedAt: true,
});

type SelectedCustomerProfile = Prisma.CustomerProfileGetPayload<{
  select: typeof customerProfileSelect;
}>;

const replenishmentLifecycleRuleSelect = Prisma.validator<Prisma.ReplenishmentLifecycleRuleSelect>()({
  id: true,
  shop: true,
  categoryTag: true,
  label: true,
  windowMinDays: true,
  windowMaxDays: true,
  priority: true,
  defaultAction: true,
  source: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
});

const customerPurchaseSnapshotSelect = Prisma.validator<Prisma.CustomerPurchaseSnapshotSelect>()({
  id: true,
  shop: true,
  shopifyCustomerId: true,
  productId: true,
  variantId: true,
  categoryTag: true,
  firstPurchasedAt: true,
  lastPurchasedAt: true,
  lastOrderId: true,
  orderCount: true,
  totalQuantity: true,
  latestTitle: true,
  latestVariantTitle: true,
  currencyCode: true,
  lastUnitPrice: true,
  inferredCadenceDays: true,
  preferredAction: true,
  createdAt: true,
  updatedAt: true,
});

type SelectedReplenishmentLifecycleRule = Prisma.ReplenishmentLifecycleRuleGetPayload<{
  select: typeof replenishmentLifecycleRuleSelect;
}>;

type SelectedCustomerPurchaseSnapshot = Prisma.CustomerPurchaseSnapshotGetPayload<{
  select: typeof customerPurchaseSnapshotSelect;
}>;

type JsonRecord = Record<string, unknown>;

export interface CustomerProfileRecord {
  id: string;
  shop: string;
  shopifyCustomerId?: string;
  sessionId?: string;
  sizeProfile: Record<string, string>;
  disciplineProfile: JsonRecord;
  explicitProfile: JsonRecord;
  purchaseSummary: JsonRecord;
  behaviorSummary: JsonRecord;
  confidenceSummary: JsonRecord;
  lastActiveAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CustomerProfilePatch {
  sizeProfile?: Record<string, string>;
  disciplineProfile?: JsonRecord;
  explicitProfile?: JsonRecord;
  purchaseSummary?: JsonRecord;
  behaviorSummary?: JsonRecord;
  confidenceSummary?: JsonRecord;
  lastActiveAt?: Date | null;
}

export interface CustomerPurchaseSummaryUpdate {
  orderId?: string;
  processedAt?: Date;
  totalSpent?: number;
  currencyCode?: string;
  productTitles?: string[];
}

export interface ReplenishmentLifecycleRuleRecord {
  id: string;
  shop: string;
  categoryTag: string;
  label: string;
  windowMinDays: number;
  windowMaxDays: number;
  priority: number;
  defaultAction: "reorder" | "upgrade_optional";
  source: "seeded" | "merchant";
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CustomerPurchaseSnapshotRecord {
  id: string;
  shop: string;
  shopifyCustomerId: string;
  productId: string;
  variantId?: string;
  categoryTag: string;
  firstPurchasedAt: Date;
  lastPurchasedAt: Date;
  lastOrderId?: string;
  orderCount: number;
  totalQuantity: number;
  latestTitle: string;
  latestVariantTitle?: string;
  currencyCode?: string;
  lastUnitPrice?: number;
  inferredCadenceDays?: number;
  preferredAction: "reorder" | "upgrade";
  createdAt: Date;
  updatedAt: Date;
}

export interface ReplenishmentShopperSummary {
  lastEvaluatedAt?: string;
  eligibleCategoryCount?: number;
  cadenceHintDays?: number;
  reminderSuppressedUntil?: string;
}

function asJsonRecord(value: unknown): JsonRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as JsonRecord;
}

function asStringRecord(value: Prisma.JsonValue | null | undefined): Record<string, string> {
  const record = asJsonRecord(value);

  return Object.fromEntries(
    Object.entries(record).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
  );
}

function serializeJsonRecord(value: JsonRecord): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function toReplenishmentDefaultAction(value: ReplenishmentDefaultAction): ReplenishmentLifecycleRuleRecord["defaultAction"] {
  return value === ReplenishmentDefaultAction.UPGRADE_OPTIONAL ? "upgrade_optional" : "reorder";
}

function toReplenishmentRuleSource(value: ReplenishmentRuleSource): ReplenishmentLifecycleRuleRecord["source"] {
  return value === ReplenishmentRuleSource.MERCHANT ? "merchant" : "seeded";
}

function toReplenishmentPreferredAction(value: ReplenishmentPreferredAction): CustomerPurchaseSnapshotRecord["preferredAction"] {
  return value === ReplenishmentPreferredAction.UPGRADE ? "upgrade" : "reorder";
}

function toReplenishmentLifecycleRuleRecord(
  row: SelectedReplenishmentLifecycleRule,
): ReplenishmentLifecycleRuleRecord {
  return {
    id: row.id,
    shop: row.shop,
    categoryTag: row.categoryTag,
    label: row.label,
    windowMinDays: row.windowMinDays,
    windowMaxDays: row.windowMaxDays,
    priority: row.priority,
    defaultAction: toReplenishmentDefaultAction(row.defaultAction),
    source: toReplenishmentRuleSource(row.source),
    isActive: row.isActive,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toCustomerPurchaseSnapshotRecord(
  row: SelectedCustomerPurchaseSnapshot,
): CustomerPurchaseSnapshotRecord {
  return {
    id: row.id,
    shop: row.shop,
    shopifyCustomerId: row.shopifyCustomerId,
    productId: row.productId,
    variantId: row.variantId ?? undefined,
    categoryTag: row.categoryTag,
    firstPurchasedAt: row.firstPurchasedAt,
    lastPurchasedAt: row.lastPurchasedAt,
    lastOrderId: row.lastOrderId ?? undefined,
    orderCount: row.orderCount,
    totalQuantity: row.totalQuantity,
    latestTitle: row.latestTitle,
    latestVariantTitle: row.latestVariantTitle ?? undefined,
    currencyCode: row.currencyCode ?? undefined,
    lastUnitPrice: row.lastUnitPrice === null ? undefined : Number(row.lastUnitPrice.toString()),
    inferredCadenceDays: row.inferredCadenceDays ?? undefined,
    preferredAction: toReplenishmentPreferredAction(row.preferredAction),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toCustomerProfileRecord(row: SelectedCustomerProfile): CustomerProfileRecord {
  return {
    id: row.id,
    shop: row.shop,
    shopifyCustomerId: row.shopifyCustomerId ?? undefined,
    sessionId: row.sessionId ?? undefined,
    sizeProfile: asStringRecord(row.sizeProfile),
    disciplineProfile: asJsonRecord(row.disciplineProfile),
    explicitProfile: asJsonRecord(row.explicitProfile),
    purchaseSummary: asJsonRecord(row.purchaseSummary),
    behaviorSummary: asJsonRecord(row.behaviorSummary),
    confidenceSummary: asJsonRecord(row.confidenceSummary),
    lastActiveAt: row.lastActiveAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mergeCustomerProfilePatch(
  existing: CustomerProfileRecord | null,
  patch: CustomerProfilePatch,
) {
  const current = existing ?? {
    sizeProfile: {},
    disciplineProfile: {},
    explicitProfile: {},
    purchaseSummary: {},
    behaviorSummary: {},
    confidenceSummary: {},
    lastActiveAt: null,
  };

  return {
    sizeProfile: { ...current.sizeProfile, ...(patch.sizeProfile ?? {}) },
    disciplineProfile: { ...current.disciplineProfile, ...(patch.disciplineProfile ?? {}) },
    explicitProfile: { ...current.explicitProfile, ...(patch.explicitProfile ?? {}) },
    purchaseSummary: { ...current.purchaseSummary, ...(patch.purchaseSummary ?? {}) },
    behaviorSummary: { ...current.behaviorSummary, ...(patch.behaviorSummary ?? {}) },
    confidenceSummary: { ...current.confidenceSummary, ...(patch.confidenceSummary ?? {}) },
    lastActiveAt: patch.lastActiveAt === undefined ? current.lastActiveAt : patch.lastActiveAt,
  };
}

function customerProfileSelectArgs() {
  return { select: customerProfileSelect };
}

export async function getCustomerProfile(
  shop: string,
  shopifyCustomerId?: string,
  sessionId?: string,
): Promise<CustomerProfileRecord | null> {
  if (!shopifyCustomerId && !sessionId) {
    return null;
  }

  if (shopifyCustomerId) {
    const customerRow = await db.customerProfile.findUnique({
      where: { shop_shopifyCustomerId: { shop, shopifyCustomerId } },
      ...customerProfileSelectArgs(),
    });

    if (customerRow) {
      return toCustomerProfileRecord(customerRow);
    }
  }

  if (sessionId) {
    const sessionRow = await db.customerProfile.findUnique({
      where: { shop_sessionId: { shop, sessionId } },
      ...customerProfileSelectArgs(),
    });

    if (sessionRow) {
      return toCustomerProfileRecord(sessionRow);
    }
  }

  return null;
}

export async function upsertCustomerProfile(
  shop: string,
  patch: CustomerProfilePatch,
  shopifyCustomerId?: string,
  sessionId?: string,
): Promise<CustomerProfileRecord | null> {
  if (!shopifyCustomerId && !sessionId) {
    return null;
  }

  const existing = await getCustomerProfile(shop, shopifyCustomerId, sessionId);
  const merged = mergeCustomerProfilePatch(existing, patch);

  if (shopifyCustomerId) {
    const row = await db.customerProfile.upsert({
      where: { shop_shopifyCustomerId: { shop, shopifyCustomerId } },
      update: {
        sizeProfile: serializeJsonRecord(merged.sizeProfile),
        disciplineProfile: serializeJsonRecord(merged.disciplineProfile),
        explicitProfile: serializeJsonRecord(merged.explicitProfile),
        purchaseSummary: serializeJsonRecord(merged.purchaseSummary),
        behaviorSummary: serializeJsonRecord(merged.behaviorSummary),
        confidenceSummary: serializeJsonRecord(merged.confidenceSummary),
        lastActiveAt: merged.lastActiveAt,
        updatedAt: new Date(),
      },
      create: {
        shop,
        shopifyCustomerId,
        sizeProfile: serializeJsonRecord(merged.sizeProfile),
        disciplineProfile: serializeJsonRecord(merged.disciplineProfile),
        explicitProfile: serializeJsonRecord(merged.explicitProfile),
        purchaseSummary: serializeJsonRecord(merged.purchaseSummary),
        behaviorSummary: serializeJsonRecord(merged.behaviorSummary),
        confidenceSummary: serializeJsonRecord(merged.confidenceSummary),
        lastActiveAt: merged.lastActiveAt,
      },
      ...customerProfileSelectArgs(),
    });

    return toCustomerProfileRecord(row);
  }

  if (!sessionId) {
    return null;
  }

  const row = await db.customerProfile.upsert({
    where: { shop_sessionId: { shop, sessionId } },
    update: {
      sizeProfile: serializeJsonRecord(merged.sizeProfile),
      disciplineProfile: serializeJsonRecord(merged.disciplineProfile),
      explicitProfile: serializeJsonRecord(merged.explicitProfile),
      purchaseSummary: serializeJsonRecord(merged.purchaseSummary),
      behaviorSummary: serializeJsonRecord(merged.behaviorSummary),
      confidenceSummary: serializeJsonRecord(merged.confidenceSummary),
      lastActiveAt: merged.lastActiveAt,
      updatedAt: new Date(),
    },
    create: {
      shop,
      sessionId,
      sizeProfile: serializeJsonRecord(merged.sizeProfile),
      disciplineProfile: serializeJsonRecord(merged.disciplineProfile),
      explicitProfile: serializeJsonRecord(merged.explicitProfile),
      purchaseSummary: serializeJsonRecord(merged.purchaseSummary),
      behaviorSummary: serializeJsonRecord(merged.behaviorSummary),
      confidenceSummary: serializeJsonRecord(merged.confidenceSummary),
      lastActiveAt: merged.lastActiveAt,
    },
    ...customerProfileSelectArgs(),
  });

  return toCustomerProfileRecord(row);
}

export async function mergeAnonymousCustomerProfile(
  shop: string,
  shopifyCustomerId: string,
  anonymousSessionId: string,
): Promise<CustomerProfileRecord | null> {
  const [customerProfile, anonymousProfile] = await Promise.all([
    getCustomerProfile(shop, shopifyCustomerId),
    getCustomerProfile(shop, undefined, anonymousSessionId),
  ]);

  if (!anonymousProfile) {
    return customerProfile;
  }

  const mergedProfile = await upsertCustomerProfile(
    shop,
    {
      sizeProfile: {
        ...(customerProfile?.sizeProfile ?? {}),
        ...anonymousProfile.sizeProfile,
      },
      disciplineProfile: {
        ...(customerProfile?.disciplineProfile ?? {}),
        ...anonymousProfile.disciplineProfile,
      },
      explicitProfile: {
        ...(customerProfile?.explicitProfile ?? {}),
        ...anonymousProfile.explicitProfile,
      },
      purchaseSummary: {
        ...(customerProfile?.purchaseSummary ?? {}),
        ...anonymousProfile.purchaseSummary,
      },
      behaviorSummary: {
        ...(customerProfile?.behaviorSummary ?? {}),
        ...anonymousProfile.behaviorSummary,
      },
      confidenceSummary: {
        ...(customerProfile?.confidenceSummary ?? {}),
        ...anonymousProfile.confidenceSummary,
      },
      lastActiveAt: anonymousProfile.lastActiveAt ?? customerProfile?.lastActiveAt ?? null,
    },
    shopifyCustomerId,
  );

  await db.customerProfile.delete({
    where: { shop_sessionId: { shop, sessionId: anonymousSessionId } },
  }).catch(() => null);

  return mergedProfile;
}

export async function getRecognizedCustomerProfile(
  shop: string,
  shopifyCustomerId: string,
): Promise<CustomerProfileRecord | null> {
  return getCustomerProfile(shop, shopifyCustomerId);
}

export async function getSessionCustomerProfile(
  shop: string,
  sessionId: string,
): Promise<CustomerProfileRecord | null> {
  return getCustomerProfile(shop, undefined, sessionId);
}

export async function upsertSessionCustomerProfile(
  shop: string,
  sessionId: string,
  patch: CustomerProfilePatch,
): Promise<CustomerProfileRecord | null> {
  return upsertCustomerProfile(shop, patch, undefined, sessionId);
}

export async function updateCustomerPurchaseSummary(
  shop: string,
  shopifyCustomerId: string,
  update: CustomerPurchaseSummaryUpdate,
): Promise<CustomerProfileRecord | null> {
  const existing = await getRecognizedCustomerProfile(shop, shopifyCustomerId);
  const existingSummary = existing?.purchaseSummary ?? {};
  const existingTotalOrders = typeof existingSummary.totalOrders === "number"
    ? existingSummary.totalOrders
    : 0;
  const existingTitles = Array.isArray(existingSummary.recentProductTitles)
    ? existingSummary.recentProductTitles.filter((value): value is string => typeof value === "string")
    : [];
  const nextTitles = Array.from(new Set([...(update.productTitles ?? []), ...existingTitles])).slice(0, 8);
  const existingLifetimeSpend = typeof existingSummary.lifetimeSpend === "number"
    ? existingSummary.lifetimeSpend
    : 0;

  return upsertCustomerProfile(
    shop,
    {
      purchaseSummary: {
        ...existingSummary,
        totalOrders: existingTotalOrders + 1,
        ...(update.orderId ? { lastOrderId: update.orderId } : {}),
        ...(update.processedAt ? { lastOrderAt: update.processedAt.toISOString() } : {}),
        ...(update.totalSpent !== undefined
          ? { lifetimeSpend: existingLifetimeSpend + update.totalSpent }
          : {}),
        ...(update.currencyCode ? { currencyCode: update.currencyCode } : {}),
        ...(nextTitles.length > 0 ? { recentProductTitles: nextTitles } : {}),
      },
      lastActiveAt: update.processedAt ?? new Date(),
    },
    shopifyCustomerId,
  );
}

export async function listActiveReplenishmentLifecycleRules(
  shop: string,
  categoryTags?: string[],
): Promise<ReplenishmentLifecycleRuleRecord[]> {
  const rows = await db.replenishmentLifecycleRule.findMany({
    where: {
      shop,
      isActive: true,
      ...(categoryTags && categoryTags.length > 0
        ? { categoryTag: { in: categoryTags } }
        : {}),
    },
    orderBy: [
      { priority: "asc" },
      { categoryTag: "asc" },
    ],
    select: replenishmentLifecycleRuleSelect,
  });

  return rows.map(toReplenishmentLifecycleRuleRecord);
}

export async function listCustomerPurchaseSnapshots(
  shop: string,
  shopifyCustomerId: string,
  categoryTags?: string[],
): Promise<CustomerPurchaseSnapshotRecord[]> {
  const rows = await db.customerPurchaseSnapshot.findMany({
    where: {
      shop,
      shopifyCustomerId,
      ...(categoryTags && categoryTags.length > 0
        ? { categoryTag: { in: categoryTags } }
        : {}),
    },
    orderBy: [
      { lastPurchasedAt: "desc" },
      { updatedAt: "desc" },
    ],
    select: customerPurchaseSnapshotSelect,
  });

  return rows.map(toCustomerPurchaseSnapshotRecord);
}

export async function getReplenishmentShopperSummary(
  shop: string,
  shopifyCustomerId: string,
): Promise<ReplenishmentShopperSummary | null> {
  const profile = await getRecognizedCustomerProfile(shop, shopifyCustomerId);
  const replenishment = asJsonRecord(profile?.purchaseSummary?.replenishment);

  if (Object.keys(replenishment).length === 0) {
    return null;
  }

  return {
    ...(typeof replenishment.lastEvaluatedAt === "string"
      ? { lastEvaluatedAt: replenishment.lastEvaluatedAt }
      : {}),
    ...(typeof replenishment.eligibleCategoryCount === "number"
      ? { eligibleCategoryCount: replenishment.eligibleCategoryCount }
      : {}),
    ...(typeof replenishment.cadenceHintDays === "number"
      ? { cadenceHintDays: replenishment.cadenceHintDays }
      : {}),
    ...(typeof replenishment.reminderSuppressedUntil === "string"
      ? { reminderSuppressedUntil: replenishment.reminderSuppressedUntil }
      : {}),
  };
}

export async function updateReplenishmentShopperSummary(
  shop: string,
  shopifyCustomerId: string,
  patch: ReplenishmentShopperSummary,
): Promise<CustomerProfileRecord | null> {
  const existing = await getRecognizedCustomerProfile(shop, shopifyCustomerId);
  const existingReplenishment = asJsonRecord(existing?.purchaseSummary?.replenishment);

  return upsertCustomerProfile(
    shop,
    {
      purchaseSummary: {
        ...(existing?.purchaseSummary ?? {}),
        replenishment: {
          ...existingReplenishment,
          ...patch,
        },
      },
      lastActiveAt: existing?.lastActiveAt ?? new Date(),
    },
    shopifyCustomerId,
  );
}

/**
 * Return the sizeProfile JSON map for a customer or anonymous session.
 * Priority: shopifyCustomerId > sessionId. Returns {} if no profile found.
 */
export async function getSizeProfileForSession(
  shop: string,
  shopifyCustomerId?: string,
  sessionId?: string,
): Promise<Record<string, string>> {
  const profile = await getCustomerProfile(shop, shopifyCustomerId, sessionId);

  return profile?.sizeProfile ?? {};
}

/**
 * Merge `updates` into the existing sizeProfile for a customer/session.
 * Creates the row if it doesn't exist yet.
 */
export async function updateSizeProfile(
  shop: string,
  updates: Record<string, string>,
  shopifyCustomerId?: string,
  sessionId?: string,
): Promise<void> {
  await upsertCustomerProfile(
    shop,
    {
      sizeProfile: updates,
      lastActiveAt: new Date(),
    },
    shopifyCustomerId,
    sessionId,
  );
}

const aiBehaviorDraftSelect = Prisma.validator<Prisma.AIBehaviorDraftSelect>()({
  id: true,
  shop: true,
  versionToken: true,
  tone: true,
  aggressiveness: true,
  safetyPriority: true,
  customGuidance: true,
  conversationStarters: true,
  updatedBy: true,
  updatedAt: true,
  createdAt: true,
});

const aiBehaviorVersionSelect = Prisma.validator<Prisma.AIBehaviorPublishedVersionSelect>()({
  id: true,
  shop: true,
  versionNumber: true,
  status: true,
  snapshot: true,
  publishedBy: true,
  publishedAt: true,
  archivedAt: true,
  createdAt: true,
  updatedAt: true,
});

type SelectedAIBehaviorDraft = Prisma.AIBehaviorDraftGetPayload<{
  select: typeof aiBehaviorDraftSelect;
}>;

type SelectedAIBehaviorPublishedVersion = Prisma.AIBehaviorPublishedVersionGetPayload<{
  select: typeof aiBehaviorVersionSelect;
}>;

export interface AIBehaviorConfigPayload {
  tone: AIBehaviorTone;
  aggressiveness: number;
  safetyPriority: AIBehaviorSafetyPriority;
  customGuidance: string;
  conversationStarters: string[];
}

export interface AIBehaviorDraftRecord {
  id: string;
  shop: string;
  versionToken: string;
  config: AIBehaviorConfigPayload;
  updatedBy: string;
  updatedAt: Date;
  createdAt: Date;
}

export interface AIBehaviorVersionSummaryRecord {
  id: string;
  shop: string;
  versionNumber: number;
  status: AIBehaviorVersionStatus;
  publishedBy: string;
  publishedAt: Date;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AIBehaviorAuditWriteInput {
  shop: string;
  actorId: string;
  actionType: AIBehaviorAuditAction;
  draftId?: string;
  targetVersionId?: string;
  beforeSnapshot?: Prisma.InputJsonValue;
  afterSnapshot?: Prisma.InputJsonValue;
  reason?: string;
}

export interface AIBehaviorPreviewRunInput {
  shop: string;
  draftId?: string;
  status?: AIBehaviorPreviewStatus;
  inputSnapshot: Prisma.InputJsonValue;
  scenarioSet: Prisma.InputJsonValue;
  requestedBy: string;
}

export class AIBehaviorVersionConflictError extends Error {
  constructor(message = "AI behavior draft version token conflict") {
    super(message);
    this.name = "AIBehaviorVersionConflictError";
  }
}

function createAIBehaviorVersionToken(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function parseConversationStarters(value: Prisma.JsonValue | null | undefined): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return normalizeConversationStarters(value);
}

function isSnapshotTone(value: unknown): value is AIBehaviorTone {
  return Object.values(AIBehaviorTone).includes(value as AIBehaviorTone);
}

function isSnapshotSafetyPriority(value: unknown): value is AIBehaviorSafetyPriority {
  return Object.values(AIBehaviorSafetyPriority).includes(value as AIBehaviorSafetyPriority);
}

function parseConfigFromSnapshotStrict(value: Prisma.JsonValue | null | undefined): {
  valid: boolean;
  config: AIBehaviorConfigPayload;
} {
  const snapshot = asJsonRecord(value);

  const tone = snapshot.tone;
  const safetyPriority = snapshot.safetyPriority;
  const aggressivenessRaw = Number(snapshot.aggressiveness);

  const valid = isSnapshotTone(tone)
    && isSnapshotSafetyPriority(safetyPriority)
    && Number.isFinite(aggressivenessRaw)
    && aggressivenessRaw >= 0
    && aggressivenessRaw <= 1;

  return {
    valid,
    config: {
      tone: isSnapshotTone(tone) ? tone : AIBehaviorDefaultConfig.tone,
      aggressiveness: clampAggressiveness(aggressivenessRaw),
      safetyPriority: isSnapshotSafetyPriority(safetyPriority)
        ? safetyPriority
        : AIBehaviorDefaultConfig.safetyPriority,
      customGuidance: normalizeCustomGuidance(snapshot.customGuidance),
      conversationStarters: parseConversationStarters(snapshot.conversationStarters as Prisma.JsonValue),
    },
  };
}

function parseConfigFromSnapshot(value: Prisma.JsonValue | null | undefined): AIBehaviorConfigPayload {
  return parseConfigFromSnapshotStrict(value).config;
}

const AIBehaviorDefaultConfig: AIBehaviorConfigPayload = {
  tone: AI_BEHAVIOR_DEFAULTS.tone,
  aggressiveness: AI_BEHAVIOR_DEFAULTS.aggressiveness,
  safetyPriority: AI_BEHAVIOR_DEFAULTS.safetyPriority,
  customGuidance: AI_BEHAVIOR_DEFAULTS.customGuidance,
  conversationStarters: [...AI_BEHAVIOR_DEFAULTS.conversationStarters],
};

function toAIBehaviorConfigPayload(row: SelectedAIBehaviorDraft): AIBehaviorConfigPayload {
  return {
    tone: row.tone,
    aggressiveness: row.aggressiveness.toNumber(),
    safetyPriority: row.safetyPriority,
    customGuidance: normalizeCustomGuidance(row.customGuidance),
    conversationStarters: parseConversationStarters(row.conversationStarters),
  };
}

function toAIBehaviorDraftRecord(row: SelectedAIBehaviorDraft): AIBehaviorDraftRecord {
  return {
    id: row.id,
    shop: row.shop,
    versionToken: row.versionToken,
    config: toAIBehaviorConfigPayload(row),
    updatedBy: row.updatedBy,
    updatedAt: row.updatedAt,
    createdAt: row.createdAt,
  };
}

function toAIBehaviorVersionSummaryRecord(
  row: SelectedAIBehaviorPublishedVersion,
): AIBehaviorVersionSummaryRecord {
  return {
    id: row.id,
    shop: row.shop,
    versionNumber: row.versionNumber,
    status: row.status,
    publishedBy: row.publishedBy,
    publishedAt: row.publishedAt,
    archivedAt: row.archivedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function serializeBehaviorConfigSnapshot(config: AIBehaviorConfigPayload): Prisma.InputJsonValue {
  return {
    tone: config.tone,
    aggressiveness: clampAggressiveness(config.aggressiveness),
    safetyPriority: config.safetyPriority,
    customGuidance: normalizeCustomGuidance(config.customGuidance),
    conversationStarters: normalizeConversationStarters(config.conversationStarters),
  } as Prisma.InputJsonValue;
}

export async function getAIBehaviorDraft(shop: string): Promise<AIBehaviorDraftRecord | null> {
  const row = await db.aiBehaviorDraft.findUnique({
    where: { shop },
    select: aiBehaviorDraftSelect,
  });

  return row ? toAIBehaviorDraftRecord(row) : null;
}

export async function getAIBehaviorVersionHistory(shop: string): Promise<AIBehaviorVersionSummaryRecord[]> {
  const rows = await db.aiBehaviorPublishedVersion.findMany({
    where: { shop },
    select: aiBehaviorVersionSelect,
    orderBy: [{ versionNumber: "desc" }, { publishedAt: "desc" }],
  });

  return rows.map(toAIBehaviorVersionSummaryRecord);
}

export async function saveAIBehaviorDraft(input: {
  shop: string;
  actorId: string;
  config: AIBehaviorConfigPayload;
  expectedVersionToken?: string;
}): Promise<AIBehaviorDraftRecord> {
  const { shop, actorId, config, expectedVersionToken } = input;

  const nextToken = createAIBehaviorVersionToken();

  const row = await db.$transaction(async (tx) => {
    const existing = await tx.aiBehaviorDraft.findUnique({
      where: { shop },
      select: aiBehaviorDraftSelect,
    });

    if (existing && expectedVersionToken && existing.versionToken !== expectedVersionToken) {
      throw new AIBehaviorVersionConflictError();
    }

    const normalized = {
      tone: config.tone,
      aggressiveness: clampAggressiveness(config.aggressiveness),
      safetyPriority: config.safetyPriority,
      customGuidance: normalizeCustomGuidance(config.customGuidance) || null,
      conversationStarters: normalizeConversationStarters(config.conversationStarters) as Prisma.InputJsonValue,
    };

    if (!existing) {
      return await tx.aiBehaviorDraft.create({
        data: {
          shop,
          versionToken: nextToken,
          updatedBy: actorId,
          ...normalized,
        },
        select: aiBehaviorDraftSelect,
      });
    }

    return await tx.aiBehaviorDraft.update({
      where: { id: existing.id },
      data: {
        versionToken: nextToken,
        updatedBy: actorId,
        ...normalized,
      },
      select: aiBehaviorDraftSelect,
    });
  });

  return toAIBehaviorDraftRecord(row);
}

export async function createAIBehaviorAuditEntry(input: AIBehaviorAuditWriteInput) {
  return await db.aiBehaviorAuditEntry.create({
    data: {
      shop: input.shop,
      actionType: input.actionType,
      actorId: input.actorId,
      draftId: input.draftId,
      targetVersionId: input.targetVersionId,
      beforeSnapshot: input.beforeSnapshot,
      afterSnapshot: input.afterSnapshot,
      reason: input.reason,
    },
  });
}

export async function writeAIBehaviorDraftSavedAudit(input: {
  shop: string;
  actorId: string;
  draftId: string;
  beforeSnapshot?: AIBehaviorConfigPayload;
  afterSnapshot: AIBehaviorConfigPayload;
}) {
  return createAIBehaviorAuditEntry({
    shop: input.shop,
    actorId: input.actorId,
    actionType: AIBehaviorAuditAction.DRAFT_SAVED,
    draftId: input.draftId,
    beforeSnapshot: input.beforeSnapshot
      ? serializeBehaviorConfigSnapshot(input.beforeSnapshot)
      : undefined,
    afterSnapshot: serializeBehaviorConfigSnapshot(input.afterSnapshot),
  });
}

export async function publishAIBehaviorDraft(input: {
  shop: string;
  actorId: string;
  reason?: string;
}): Promise<AIBehaviorVersionSummaryRecord> {
  const { shop, actorId, reason } = input;

  return await db.$transaction(async (tx) => {
    const draft = await tx.aiBehaviorDraft.findUnique({
      where: { shop },
      select: aiBehaviorDraftSelect,
    });

    if (!draft) {
      throw new Error("No AI behavior draft found for shop");
    }

    const [latestVersion, activeVersion] = await Promise.all([
      tx.aiBehaviorPublishedVersion.findFirst({
        where: { shop },
        orderBy: { versionNumber: "desc" },
        select: aiBehaviorVersionSelect,
      }),
      tx.aiBehaviorPublishedVersion.findFirst({
        where: { shop, status: AIBehaviorVersionStatus.ACTIVE },
        select: aiBehaviorVersionSelect,
      }),
    ]);

    await tx.aiBehaviorPublishedVersion.updateMany({
      where: { shop, status: AIBehaviorVersionStatus.ACTIVE },
      data: {
        status: AIBehaviorVersionStatus.ARCHIVED,
        archivedAt: new Date(),
      },
    });

    const created = await tx.aiBehaviorPublishedVersion.create({
      data: {
        shop,
        versionNumber: (latestVersion?.versionNumber ?? 0) + 1,
        status: AIBehaviorVersionStatus.ACTIVE,
        snapshot: serializeBehaviorConfigSnapshot(toAIBehaviorConfigPayload(draft)),
        publishedBy: actorId,
      },
      select: aiBehaviorVersionSelect,
    });

    await tx.aiBehaviorAuditEntry.create({
      data: {
        shop,
        actorId,
        actionType: AIBehaviorAuditAction.PUBLISHED,
        draftId: draft.id,
        targetVersionId: created.id,
        beforeSnapshot: activeVersion?.snapshot ?? null,
        afterSnapshot: created.snapshot,
        reason,
      },
    });

    return toAIBehaviorVersionSummaryRecord(created);
  });
}

export async function rollbackAIBehaviorVersion(input: {
  shop: string;
  actorId: string;
  targetVersionId: string;
  reason?: string;
}): Promise<AIBehaviorVersionSummaryRecord> {
  const { shop, actorId, targetVersionId, reason } = input;

  return await db.$transaction(async (tx) => {
    const targetVersion = await tx.aiBehaviorPublishedVersion.findFirst({
      where: {
        id: targetVersionId,
        shop,
      },
      select: aiBehaviorVersionSelect,
    });

    if (!targetVersion) {
      throw new Error("Target AI behavior version not found");
    }

    const [latestVersion, activeVersion] = await Promise.all([
      tx.aiBehaviorPublishedVersion.findFirst({
        where: { shop },
        orderBy: { versionNumber: "desc" },
        select: aiBehaviorVersionSelect,
      }),
      tx.aiBehaviorPublishedVersion.findFirst({
        where: { shop, status: AIBehaviorVersionStatus.ACTIVE },
        select: aiBehaviorVersionSelect,
      }),
    ]);

    await tx.aiBehaviorPublishedVersion.updateMany({
      where: { shop, status: AIBehaviorVersionStatus.ACTIVE },
      data: {
        status: AIBehaviorVersionStatus.ARCHIVED,
        archivedAt: new Date(),
      },
    });

    const restored = await tx.aiBehaviorPublishedVersion.create({
      data: {
        shop,
        versionNumber: (latestVersion?.versionNumber ?? 0) + 1,
        status: AIBehaviorVersionStatus.ACTIVE,
        snapshot: targetVersion.snapshot as Prisma.InputJsonValue,
        publishedBy: actorId,
      },
      select: aiBehaviorVersionSelect,
    });

    await tx.aiBehaviorAuditEntry.create({
      data: {
        shop,
        actorId,
        actionType: AIBehaviorAuditAction.ROLLED_BACK,
        targetVersionId: restored.id,
        beforeSnapshot: activeVersion?.snapshot ?? null,
        afterSnapshot: restored.snapshot,
        reason,
      },
    });

    return toAIBehaviorVersionSummaryRecord(restored);
  });
}

export async function createAIBehaviorPreviewRun(input: AIBehaviorPreviewRunInput) {
  return await db.aiBehaviorPreviewRun.create({
    data: {
      shop: input.shop,
      draftId: input.draftId,
      status: input.status ?? AIBehaviorPreviewStatus.RUNNING,
      inputSnapshot: input.inputSnapshot,
      scenarioSet: input.scenarioSet,
      requestedBy: input.requestedBy,
      requestedAt: new Date(),
    },
  });
}

export async function getActiveAIBehaviorConfigWithFallback(shop: string): Promise<{
  source: "active" | "draft" | "defaults";
  versionId?: string;
  versionNumber?: number;
  config: AIBehaviorConfigPayload;
}> {
  const versions = await db.aiBehaviorPublishedVersion.findMany({
    where: {
      shop,
    },
    orderBy: [{ status: "asc" }, { publishedAt: "desc" }],
    select: aiBehaviorVersionSelect,
  });

  const active = versions.find((version) => version.status === AIBehaviorVersionStatus.ACTIVE);

  if (active) {
    const parsedActive = parseConfigFromSnapshotStrict(active.snapshot);

    if (parsedActive.valid) {
      return {
        source: "active",
        versionId: active.id,
        versionNumber: active.versionNumber,
        config: parsedActive.config,
      };
    }
  }

  const lastValidPublished = versions
    .map((version) => ({
      version,
      parsed: parseConfigFromSnapshotStrict(version.snapshot),
    }))
    .find((entry) => entry.parsed.valid);

  if (lastValidPublished) {
    return {
      source: "active",
      versionId: lastValidPublished.version.id,
      versionNumber: lastValidPublished.version.versionNumber,
      config: lastValidPublished.parsed.config,
    };
  }

  const draft = await getAIBehaviorDraft(shop);

  if (draft) {
    return {
      source: "draft",
      config: draft.config,
    };
  }

  return {
    source: "defaults",
    config: {
      ...AIBehaviorDefaultConfig,
      conversationStarters: [...AIBehaviorDefaultConfig.conversationStarters],
    },
  };
}

// ---------------------------------------------------------------------------
// Sync-status dashboard helpers (Feature 001 — US4)
// ---------------------------------------------------------------------------

/**
 * Return products that have never been marked as synced (syncedAt = null).
 * Used by the admin dashboard to surface un-synced or permanently-failed products.
 */
export async function getProductsNotYetSynced(shop: string, take = 50) {
  return await db.product.findMany({
    where: { shop, syncedAt: null },
    select: { id: true, shopifyProductId: true, title: true },
    orderBy: { createdAt: "desc" },
    take,
  });
}

// ---------------------------------------------------------------------------
// Product Relationship Mapping — admin review helpers (Feature 004 — US2)
// ---------------------------------------------------------------------------

export interface RelationshipAdminRow {
  id: string;
  sourceProductId: string;
  targetProductId: string;
  sourceProductTitle: string;
  targetProductTitle: string;
  relationshipType: RelationshipType;
  directionality: RelationshipDirectionality;
  strength: number;
  status: RelationshipStatus;
  origin: RelationshipOrigin;
  createdAt: Date;
  reviewedAt: Date | null;
}

/**
 * Return candidate relationships for admin review, joined with product titles.
 * Used by the Relationships tab in the Knowledge Graph editor.
 */
export async function getRelationshipCandidatesForAdmin(
  shop: string,
  take = 50,
): Promise<RelationshipAdminRow[]> {
  const rows = await db.productRelationship.findMany({
    where: { shop, status: RelationshipStatus.CANDIDATE },
    orderBy: [{ strength: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      sourceProductId: true,
      targetProductId: true,
      relationshipType: true,
      directionality: true,
      strength: true,
      status: true,
      origin: true,
      createdAt: true,
      reviewedAt: true,
    },
    take,
  });

  const productIds = [...new Set(rows.flatMap(r => [r.sourceProductId, r.targetProductId]))];
  const products = await db.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, title: true },
  });
  const titleMap = new Map(products.map(p => [p.id, p.title]));

  return rows.map(r => ({
    ...r,
    sourceProductTitle: titleMap.get(r.sourceProductId) ?? r.sourceProductId,
    targetProductTitle: titleMap.get(r.targetProductId) ?? r.targetProductId,
  }));
}

/**
 * Return merchant-authored and auto-approved ACTIVE relationships for admin review.
 */
export async function getMerchantActiveRelationships(
  shop: string,
  take = 50,
): Promise<RelationshipAdminRow[]> {
  const rows = await db.productRelationship.findMany({
    where: { shop, status: RelationshipStatus.ACTIVE },
    orderBy: [{ reviewedAt: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      sourceProductId: true,
      targetProductId: true,
      relationshipType: true,
      directionality: true,
      strength: true,
      status: true,
      origin: true,
      createdAt: true,
      reviewedAt: true,
    },
    take,
  });

  const productIds = [...new Set(rows.flatMap(r => [r.sourceProductId, r.targetProductId]))];
  const products = await db.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, title: true },
  });
  const titleMap = new Map(products.map(p => [p.id, p.title]));

  return rows.map(r => ({
    ...r,
    sourceProductTitle: titleMap.get(r.sourceProductId) ?? r.sourceProductId,
    targetProductTitle: titleMap.get(r.targetProductId) ?? r.targetProductId,
  }));
}

/**
 * Approve a candidate relationship and log the merchant override.
 * Sets status to ACTIVE, origin to MERCHANT, and records a CREATE/REACTIVATE override.
 */
export async function approveRelationship(
  shop: string,
  relationshipId: string,
  createdBy?: string,
) {
  return await db.$transaction(async (tx: Prisma.TransactionClient) => {
    const rel = await tx.productRelationship.update({
      where: { id: relationshipId, shop },
      data: {
        status: RelationshipStatus.ACTIVE,
        origin: RelationshipOrigin.MERCHANT,
        reviewedAt: new Date(),
        updatedAt: new Date(),
      },
    });

    await tx.relationshipOverride.create({
      data: {
        shop,
        normalizedPairKey: `${rel.sourceProductId}:${rel.targetProductId}:${rel.relationshipType}`,
        relationshipType: rel.relationshipType,
        action: OverrideAction.REACTIVATE,
        appliedState: { status: RelationshipStatus.ACTIVE },
        createdBy: createdBy ?? null,
      },
    });

    return rel;
  });
}

/**
 * Reject a candidate relationship and log the merchant override.
 * Sets status to REJECTED, origin to MERCHANT.
 */
export async function rejectRelationship(
  shop: string,
  relationshipId: string,
  createdBy?: string,
) {
  return await db.$transaction(async (tx: Prisma.TransactionClient) => {
    const rel = await tx.productRelationship.update({
      where: { id: relationshipId, shop },
      data: {
        status: RelationshipStatus.REJECTED,
        origin: RelationshipOrigin.MERCHANT,
        reviewedAt: new Date(),
        updatedAt: new Date(),
      },
    });

    await tx.relationshipOverride.create({
      data: {
        shop,
        normalizedPairKey: `${rel.sourceProductId}:${rel.targetProductId}:${rel.relationshipType}`,
        relationshipType: rel.relationshipType,
        action: OverrideAction.REJECT,
        appliedState: { status: RelationshipStatus.REJECTED },
        createdBy: createdBy ?? null,
      },
    });

    return rel;
  });
}

/**
 * Disable an active relationship and log the merchant override.
 */
export async function disableRelationship(
  shop: string,
  relationshipId: string,
  createdBy?: string,
) {
  return await db.$transaction(async (tx: Prisma.TransactionClient) => {
    const rel = await tx.productRelationship.update({
      where: { id: relationshipId, shop },
      data: {
        status: RelationshipStatus.INACTIVE,
        invalidatedAt: new Date(),
        updatedAt: new Date(),
      },
    });

    await tx.relationshipOverride.create({
      data: {
        shop,
        normalizedPairKey: `${rel.sourceProductId}:${rel.targetProductId}:${rel.relationshipType}`,
        relationshipType: rel.relationshipType,
        action: OverrideAction.DISABLE,
        appliedState: { status: RelationshipStatus.INACTIVE },
        createdBy: createdBy ?? null,
      },
    });

    return rel;
  });
}
