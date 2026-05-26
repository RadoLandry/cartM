-- CreateEnum
CREATE TYPE "BundleRuleSource" AS ENUM ('AUTO', 'MERCHANT', 'HYBRID');

-- CreateEnum
CREATE TYPE "BundleRuleStatus" AS ENUM ('ACTIVE', 'DRAFT', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "BundleDiscountType" AS ENUM ('PERCENTAGE', 'FIXED');

-- CreateEnum
CREATE TYPE "BundleComponentMatchMode" AS ENUM ('CATEGORY', 'PRODUCT', 'VARIANT', 'CATEGORY_OR_PRODUCT');

-- CreateTable
CREATE TABLE "BundleRule" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "source" "BundleRuleSource" NOT NULL DEFAULT 'MERCHANT',
    "status" "BundleRuleStatus" NOT NULL DEFAULT 'DRAFT',
    "priority" INTEGER NOT NULL DEFAULT 100,
    "completionThreshold" DOUBLE PRECISION NOT NULL DEFAULT 0.8,
    "discountType" "BundleDiscountType" NOT NULL,
    "discountValue" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BundleRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BundleRuleComponent" (
    "id" TEXT NOT NULL,
    "bundleRuleId" TEXT NOT NULL,
    "componentKey" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 100,
    "matchMode" "BundleComponentMatchMode" NOT NULL DEFAULT 'CATEGORY_OR_PRODUCT',
    "acceptedCategoryTags" TEXT[],
    "acceptedShopifyProductIds" TEXT[],
    "acceptedShopifyVariantIds" TEXT[],
    "minQuantity" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BundleRuleComponent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BundleRule_shop_status_priority_idx" ON "BundleRule"("shop", "status", "priority");

-- CreateIndex
CREATE UNIQUE INDEX "BundleRule_shop_key_key" ON "BundleRule"("shop", "key");

-- CreateIndex
CREATE INDEX "BundleRuleComponent_bundleRuleId_sortOrder_idx" ON "BundleRuleComponent"("bundleRuleId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "BundleRuleComponent_bundleRuleId_componentKey_key" ON "BundleRuleComponent"("bundleRuleId", "componentKey");

-- AddForeignKey
ALTER TABLE "BundleRuleComponent" ADD CONSTRAINT "BundleRuleComponent_bundleRuleId_fkey" FOREIGN KEY ("bundleRuleId") REFERENCES "BundleRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;
