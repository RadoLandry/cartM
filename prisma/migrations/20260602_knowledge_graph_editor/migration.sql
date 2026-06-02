-- Knowledge Graph Editor foundational persistence

CREATE TYPE "KnowledgeGraphOverrideDimension" AS ENUM ('DISCIPLINE', 'CATEGORY');
CREATE TYPE "KnowledgeGraphEntityType" AS ENUM (
  'PRODUCT_INTELLIGENCE',
  'CLASSIFICATION_OVERRIDE',
  'RELATIONSHIP_RULE',
  'SIZE_MAPPING_RULE',
  'BULK_OPERATION'
);
CREATE TYPE "KnowledgeGraphChangeAction" AS ENUM (
  'CREATE',
  'UPDATE',
  'DELETE',
  'ACTIVATE',
  'DEACTIVATE',
  'BULK_APPLY'
);
CREATE TYPE "KnowledgeGraphBulkOperationType" AS ENUM (
  'RECLASSIFY',
  'RELATIONSHIP_UPDATE',
  'TAG_APPLY',
  'TAG_REMOVE'
);
CREATE TYPE "KnowledgeGraphBulkOperationStatus" AS ENUM (
  'PREVIEWED',
  'CONFIRMED',
  'RUNNING',
  'PARTIAL',
  'COMPLETED',
  'FAILED',
  'CANCELLED'
);

CREATE TABLE "ProductClassificationOverride" (
  "id" TEXT NOT NULL,
  "shop" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "dimension" "KnowledgeGraphOverrideDimension" NOT NULL,
  "overrideValues" TEXT[] NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdBy" TEXT,
  "supersededAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProductClassificationOverride_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "KnowledgeGraphBulkOperation" (
  "id" TEXT NOT NULL,
  "shop" TEXT NOT NULL,
  "operationType" "KnowledgeGraphBulkOperationType" NOT NULL,
  "targetCount" INTEGER NOT NULL,
  "previewHash" TEXT NOT NULL,
  "initiatedBy" TEXT,
  "status" "KnowledgeGraphBulkOperationStatus" NOT NULL DEFAULT 'PREVIEWED',
  "startedAt" TIMESTAMP(3),
  "finishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "KnowledgeGraphBulkOperation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "KnowledgeGraphChangeLog" (
  "id" TEXT NOT NULL,
  "shop" TEXT NOT NULL,
  "actorId" TEXT,
  "entityType" "KnowledgeGraphEntityType" NOT NULL,
  "entityId" TEXT NOT NULL,
  "action" "KnowledgeGraphChangeAction" NOT NULL,
  "beforeSnapshot" JSONB,
  "afterSnapshot" JSONB,
  "reason" TEXT,
  "bulkOperationId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "KnowledgeGraphChangeLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProductClassificationOverride_shop_productId_idx"
  ON "ProductClassificationOverride"("shop", "productId");
CREATE INDEX "ProductClassificationOverride_shop_isActive_dimension_idx"
  ON "ProductClassificationOverride"("shop", "isActive", "dimension");
CREATE INDEX "KnowledgeGraphBulkOperation_shop_status_idx"
  ON "KnowledgeGraphBulkOperation"("shop", "status");
CREATE INDEX "KnowledgeGraphBulkOperation_shop_operationType_idx"
  ON "KnowledgeGraphBulkOperation"("shop", "operationType");
CREATE INDEX "KnowledgeGraphChangeLog_shop_entityType_entityId_idx"
  ON "KnowledgeGraphChangeLog"("shop", "entityType", "entityId");
CREATE INDEX "KnowledgeGraphChangeLog_shop_createdAt_idx"
  ON "KnowledgeGraphChangeLog"("shop", "createdAt");
CREATE INDEX "KnowledgeGraphChangeLog_bulkOperationId_idx"
  ON "KnowledgeGraphChangeLog"("bulkOperationId");

ALTER TABLE "ProductClassificationOverride"
  ADD CONSTRAINT "ProductClassificationOverride_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "KnowledgeGraphChangeLog"
  ADD CONSTRAINT "KnowledgeGraphChangeLog_bulkOperationId_fkey"
  FOREIGN KEY ("bulkOperationId") REFERENCES "KnowledgeGraphBulkOperation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
