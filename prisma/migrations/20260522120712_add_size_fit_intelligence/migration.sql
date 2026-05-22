-- CreateEnum
CREATE TYPE "SizeChartSource" AS ENUM ('AUTO', 'MERCHANT');

-- CreateEnum
CREATE TYPE "SizeConflictSeverity" AS ENUM ('WARNING', 'ERROR');

-- CreateTable
CREATE TABLE "SizeChart" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "categoryTag" TEXT NOT NULL,
    "sizeSystem" TEXT NOT NULL,
    "breakpoints" JSONB NOT NULL,
    "overrideBreakpoints" JSONB,
    "source" "SizeChartSource" NOT NULL DEFAULT 'AUTO',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SizeChart_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrossSizeMapping" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "sourceCategoryTag" TEXT NOT NULL,
    "sourceSize" TEXT NOT NULL,
    "targetCategoryTag" TEXT NOT NULL,
    "targetSize" TEXT NOT NULL,
    "severityOnMismatch" "SizeConflictSeverity" NOT NULL DEFAULT 'WARNING',
    "source" "SizeChartSource" NOT NULL DEFAULT 'AUTO',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrossSizeMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SizeReturnRecord" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "shopifyOrderId" TEXT NOT NULL,
    "shopifyProductId" TEXT NOT NULL,
    "categoryTag" TEXT NOT NULL,
    "returnedSize" TEXT NOT NULL,
    "returnReason" TEXT NOT NULL,
    "returnedAt" TIMESTAMP(3) NOT NULL,
    "processedForAdjustment" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SizeReturnRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SizeChart_shop_idx" ON "SizeChart"("shop");

-- CreateIndex
CREATE UNIQUE INDEX "SizeChart_shop_categoryTag_sizeSystem_key" ON "SizeChart"("shop", "categoryTag", "sizeSystem");

-- CreateIndex
CREATE INDEX "CrossSizeMapping_shop_sourceCategoryTag_idx" ON "CrossSizeMapping"("shop", "sourceCategoryTag");

-- CreateIndex
CREATE INDEX "CrossSizeMapping_shop_targetCategoryTag_idx" ON "CrossSizeMapping"("shop", "targetCategoryTag");

-- CreateIndex
CREATE UNIQUE INDEX "CrossSizeMapping_shop_sourceCategoryTag_sourceSize_targetCa_key" ON "CrossSizeMapping"("shop", "sourceCategoryTag", "sourceSize", "targetCategoryTag");

-- CreateIndex
CREATE INDEX "SizeReturnRecord_shop_categoryTag_idx" ON "SizeReturnRecord"("shop", "categoryTag");

-- CreateIndex
CREATE INDEX "SizeReturnRecord_shop_processedForAdjustment_idx" ON "SizeReturnRecord"("shop", "processedForAdjustment");
