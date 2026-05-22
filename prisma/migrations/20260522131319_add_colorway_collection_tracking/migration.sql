-- CreateEnum
CREATE TYPE "VisualProfileSource" AS ENUM ('AUTO', 'MERCHANT', 'HYBRID');

-- CreateEnum
CREATE TYPE "VisualReviewStatus" AS ENUM ('NEEDS_REVIEW', 'AUTO_APPROVED', 'MERCHANT_REVIEWED');

-- CreateEnum
CREATE TYPE "ColorCompatibility" AS ENUM ('MATCHING', 'COMPLEMENTARY', 'NEUTRAL', 'AVOID');

-- AlterEnum
ALTER TYPE "EvidenceType" ADD VALUE 'COLORWAY';

-- CreateTable
CREATE TABLE "ProductVisualProfile" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "dominantColors" JSONB NOT NULL,
    "detectedColorwayKeys" TEXT[],
    "overrideColorwayKeys" TEXT[],
    "detectedCollections" JSONB NOT NULL,
    "overrideCollections" JSONB,
    "visualConfidence" DOUBLE PRECISION,
    "reviewStatus" "VisualReviewStatus" NOT NULL DEFAULT 'NEEDS_REVIEW',
    "source" "VisualProfileSource" NOT NULL DEFAULT 'AUTO',
    "extractionSummary" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductVisualProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ColorCompatibilityRule" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "sourceColorwayKey" TEXT NOT NULL,
    "targetColorwayKey" TEXT NOT NULL,
    "compatibility" "ColorCompatibility" NOT NULL,
    "source" "VisualProfileSource" NOT NULL DEFAULT 'MERCHANT',
    "rationale" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ColorCompatibilityRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProductVisualProfile_productId_key" ON "ProductVisualProfile"("productId");

-- CreateIndex
CREATE INDEX "ProductVisualProfile_shop_reviewStatus_idx" ON "ProductVisualProfile"("shop", "reviewStatus");

-- CreateIndex
CREATE INDEX "ProductVisualProfile_shop_visualConfidence_idx" ON "ProductVisualProfile"("shop", "visualConfidence");

-- CreateIndex
CREATE INDEX "ColorCompatibilityRule_shop_sourceColorwayKey_idx" ON "ColorCompatibilityRule"("shop", "sourceColorwayKey");

-- CreateIndex
CREATE INDEX "ColorCompatibilityRule_shop_targetColorwayKey_idx" ON "ColorCompatibilityRule"("shop", "targetColorwayKey");

-- CreateIndex
CREATE UNIQUE INDEX "ColorCompatibilityRule_shop_sourceColorwayKey_targetColorwa_key" ON "ColorCompatibilityRule"("shop", "sourceColorwayKey", "targetColorwayKey");

-- AddForeignKey
ALTER TABLE "ProductVisualProfile" ADD CONSTRAINT "ProductVisualProfile_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
