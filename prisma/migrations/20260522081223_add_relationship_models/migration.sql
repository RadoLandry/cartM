-- CreateEnum
CREATE TYPE "RelationshipType" AS ENUM ('COMPLEMENTS', 'UPGRADES', 'ALTERNATIVES', 'CONFLICTS', 'SAME_COLLECTION');

-- CreateEnum
CREATE TYPE "RelationshipDirectionality" AS ENUM ('DIRECTIONAL', 'SYMMETRIC');

-- CreateEnum
CREATE TYPE "RelationshipStatus" AS ENUM ('CANDIDATE', 'ACTIVE', 'REJECTED', 'INACTIVE');

-- CreateEnum
CREATE TYPE "RelationshipOrigin" AS ENUM ('AUTO', 'MERCHANT');

-- CreateEnum
CREATE TYPE "EvidenceType" AS ENUM ('TAXONOMY', 'COLLECTION', 'EMBEDDING', 'MERCHANT_RULE', 'COPURCHASE', 'CATALOG_METADATA');

-- CreateEnum
CREATE TYPE "OverrideAction" AS ENUM ('CREATE', 'UPDATE', 'REJECT', 'REACTIVATE', 'DISABLE');

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "classificationConfidence" DOUBLE PRECISION,
ADD COLUMN     "isManuallyClassified" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "ProductRelationship" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "sourceProductId" TEXT NOT NULL,
    "targetProductId" TEXT NOT NULL,
    "relationshipType" "RelationshipType" NOT NULL,
    "directionality" "RelationshipDirectionality" NOT NULL,
    "strength" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" "RelationshipStatus" NOT NULL DEFAULT 'CANDIDATE',
    "origin" "RelationshipOrigin" NOT NULL DEFAULT 'AUTO',
    "evidenceSummary" JSONB,
    "reviewedAt" TIMESTAMP(3),
    "invalidatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductRelationship_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RelationshipEvidence" (
    "id" TEXT NOT NULL,
    "productRelationshipId" TEXT NOT NULL,
    "evidenceType" "EvidenceType" NOT NULL,
    "score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RelationshipEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RelationshipOverride" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "normalizedPairKey" TEXT NOT NULL,
    "relationshipType" "RelationshipType" NOT NULL,
    "action" "OverrideAction" NOT NULL,
    "appliedState" JSONB,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RelationshipOverride_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductRelationship_shop_status_idx" ON "ProductRelationship"("shop", "status");

-- CreateIndex
CREATE INDEX "ProductRelationship_shop_sourceProductId_idx" ON "ProductRelationship"("shop", "sourceProductId");

-- CreateIndex
CREATE INDEX "ProductRelationship_shop_targetProductId_idx" ON "ProductRelationship"("shop", "targetProductId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductRelationship_shop_sourceProductId_targetProductId_re_key" ON "ProductRelationship"("shop", "sourceProductId", "targetProductId", "relationshipType");

-- CreateIndex
CREATE INDEX "RelationshipEvidence_productRelationshipId_idx" ON "RelationshipEvidence"("productRelationshipId");

-- CreateIndex
CREATE INDEX "RelationshipOverride_shop_normalizedPairKey_relationshipTyp_idx" ON "RelationshipOverride"("shop", "normalizedPairKey", "relationshipType");

-- AddForeignKey
ALTER TABLE "RelationshipEvidence" ADD CONSTRAINT "RelationshipEvidence_productRelationshipId_fkey" FOREIGN KEY ("productRelationshipId") REFERENCES "ProductRelationship"("id") ON DELETE CASCADE ON UPDATE CASCADE;
