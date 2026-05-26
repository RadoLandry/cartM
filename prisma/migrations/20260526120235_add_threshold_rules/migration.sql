-- CreateEnum
CREATE TYPE "ThresholdRuleSource" AS ENUM ('AUTO', 'MERCHANT', 'HYBRID');

-- CreateEnum
CREATE TYPE "ThresholdRuleStatus" AS ENUM ('ACTIVE', 'DRAFT', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ThresholdBenefitType" AS ENUM ('FREE_SHIPPING', 'DISCOUNT_TIER', 'CUSTOM');

-- CreateEnum
CREATE TYPE "ThresholdDuplicatePurchasePolicy" AS ENUM ('DISALLOW', 'ALLOW_REPEATABLE');

-- CreateTable
CREATE TABLE "ThresholdRule" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "source" "ThresholdRuleSource" NOT NULL DEFAULT 'MERCHANT',
    "status" "ThresholdRuleStatus" NOT NULL DEFAULT 'DRAFT',
    "priority" INTEGER NOT NULL DEFAULT 100,
    "benefitType" "ThresholdBenefitType" NOT NULL,
    "benefitLabel" TEXT NOT NULL,
    "targetSubtotal" DECIMAL(10,2) NOT NULL,
    "actionableWindow" DECIMAL(10,2) NOT NULL,
    "allowOvershoot" BOOLEAN NOT NULL DEFAULT false,
    "maxSuggestions" INTEGER NOT NULL DEFAULT 3,
    "supportedDisciplineTags" TEXT[],
    "supportedCategoryTags" TEXT[],
    "excludedShopifyProductIds" TEXT[],
    "duplicatePurchasePolicy" "ThresholdDuplicatePurchasePolicy" NOT NULL DEFAULT 'DISALLOW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ThresholdRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ThresholdRule_shop_status_priority_idx" ON "ThresholdRule"("shop", "status", "priority");

-- CreateIndex
CREATE UNIQUE INDEX "ThresholdRule_shop_key_key" ON "ThresholdRule"("shop", "key");
