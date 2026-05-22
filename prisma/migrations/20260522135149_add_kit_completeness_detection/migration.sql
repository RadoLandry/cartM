-- CreateEnum
CREATE TYPE "KitDefinitionSource" AS ENUM ('AUTO', 'MERCHANT', 'HYBRID');

-- CreateEnum
CREATE TYPE "KitDefinitionStatus" AS ENUM ('ACTIVE', 'DRAFT', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "RequirementMatchMode" AS ENUM ('CATEGORY', 'PRODUCT', 'CATEGORY_OR_PRODUCT', 'PRODUCT_OR_ALTERNATIVE');

-- CreateTable
CREATE TABLE "KitDefinition" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "disciplineTag" TEXT NOT NULL,
    "description" TEXT,
    "source" "KitDefinitionSource" NOT NULL DEFAULT 'AUTO',
    "status" "KitDefinitionStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KitDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KitRequirement" (
    "id" TEXT NOT NULL,
    "kitDefinitionId" TEXT NOT NULL,
    "requirementKey" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "safetyCritical" BOOLEAN NOT NULL DEFAULT false,
    "matchMode" "RequirementMatchMode" NOT NULL DEFAULT 'CATEGORY',
    "acceptedCategoryTags" TEXT[],
    "acceptedShopifyProductIds" TEXT[],
    "acceptedRelationshipTypes" "RelationshipType"[],
    "minQuantity" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KitRequirement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "KitDefinition_shop_disciplineTag_status_idx" ON "KitDefinition"("shop", "disciplineTag", "status");

-- CreateIndex
CREATE UNIQUE INDEX "KitDefinition_shop_key_key" ON "KitDefinition"("shop", "key");

-- CreateIndex
CREATE INDEX "KitRequirement_kitDefinitionId_priority_idx" ON "KitRequirement"("kitDefinitionId", "priority");

-- CreateIndex
CREATE UNIQUE INDEX "KitRequirement_kitDefinitionId_requirementKey_key" ON "KitRequirement"("kitDefinitionId", "requirementKey");

-- AddForeignKey
ALTER TABLE "KitRequirement" ADD CONSTRAINT "KitRequirement_kitDefinitionId_fkey" FOREIGN KEY ("kitDefinitionId") REFERENCES "KitDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
