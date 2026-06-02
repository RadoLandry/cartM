-- CreateEnum
CREATE TYPE "ReplenishmentDefaultAction" AS ENUM ('REORDER', 'UPGRADE_OPTIONAL');

-- CreateEnum
CREATE TYPE "ReplenishmentRuleSource" AS ENUM ('SEEDED', 'MERCHANT');

-- CreateEnum
CREATE TYPE "ReplenishmentPreferredAction" AS ENUM ('REORDER', 'UPGRADE');

-- CreateEnum
CREATE TYPE "AnalyticsEventType" AS ENUM ('RECOMMENDATION_SHOWN', 'RECOMMENDATION_CLICKED', 'CHAT_STARTED', 'CHAT_CART_MODIFICATION', 'BUNDLE_OPPORTUNITY_DETECTED', 'BUNDLE_COMPLETED', 'PURCHASE_COMPLETED', 'CART_UPDATED', 'RETURN_RECORDED');

-- CreateEnum
CREATE TYPE "AnalyticsEventSource" AS ENUM ('WEBHOOK', 'CHAT_TOOL', 'APP_ROUTE', 'JOB');

-- CreateEnum
CREATE TYPE "AnalyticsCustomerType" AS ENUM ('ANONYMOUS', 'LOGGED_IN');

-- CreateEnum
CREATE TYPE "ExportReportFormat" AS ENUM ('CSV');

-- CreateEnum
CREATE TYPE "ExportReportStatus" AS ENUM ('PENDING', 'RUNNING', 'READY', 'FAILED', 'EXPIRED');

-- AlterTable
ALTER TABLE "CustomerProfile" ADD COLUMN     "behaviorSummary" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "confidenceSummary" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "disciplineProfile" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "explicitProfile" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "lastActiveAt" TIMESTAMP(3),
ADD COLUMN     "purchaseSummary" JSONB NOT NULL DEFAULT '{}';

-- AlterTable
ALTER TABLE "KnowledgeGraphBulkOperation" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "ProductClassificationOverride" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateTable
CREATE TABLE "ReplenishmentLifecycleRule" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "categoryTag" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "windowMinDays" INTEGER NOT NULL,
    "windowMaxDays" INTEGER NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "defaultAction" "ReplenishmentDefaultAction" NOT NULL DEFAULT 'REORDER',
    "source" "ReplenishmentRuleSource" NOT NULL DEFAULT 'SEEDED',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReplenishmentLifecycleRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerPurchaseSnapshot" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "shopifyCustomerId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "variantId" TEXT,
    "categoryTag" TEXT NOT NULL,
    "firstPurchasedAt" TIMESTAMP(3) NOT NULL,
    "lastPurchasedAt" TIMESTAMP(3) NOT NULL,
    "lastOrderId" TEXT,
    "orderCount" INTEGER NOT NULL DEFAULT 1,
    "totalQuantity" INTEGER NOT NULL DEFAULT 1,
    "latestTitle" TEXT NOT NULL,
    "latestVariantTitle" TEXT,
    "currencyCode" TEXT,
    "lastUnitPrice" DECIMAL(10,2),
    "inferredCadenceDays" INTEGER,
    "preferredAction" "ReplenishmentPreferredAction" NOT NULL DEFAULT 'REORDER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerPurchaseSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnalyticsEvent" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "eventType" "AnalyticsEventType" NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" "AnalyticsEventSource" NOT NULL,
    "sourceEventId" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "sessionId" TEXT,
    "customerId" TEXT,
    "customerType" "AnalyticsCustomerType",
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnalyticsEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KpiDefinition" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "formula" TEXT NOT NULL,
    "numeratorDefinition" TEXT NOT NULL,
    "denominatorDefinition" TEXT,
    "caveats" JSONB,
    "isRate" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KpiDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KpiSnapshot" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "granularity" TEXT NOT NULL,
    "segment" JSONB,
    "kpiKey" TEXT NOT NULL,
    "value" DECIMAL(20,6) NOT NULL,
    "sampleSize" INTEGER NOT NULL DEFAULT 0,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dataFreshUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KpiSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttributionRecord" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "sessionId" TEXT,
    "customerId" TEXT,
    "attributionType" TEXT NOT NULL,
    "sourceEventId" TEXT NOT NULL,
    "outcomeEventId" TEXT NOT NULL,
    "attributionWindowMinutes" INTEGER NOT NULL,
    "confidence" DECIMAL(5,4) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AttributionRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExportReport" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "requestedBy" TEXT NOT NULL,
    "format" "ExportReportFormat" NOT NULL DEFAULT 'CSV',
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "filters" JSONB,
    "status" "ExportReportStatus" NOT NULL DEFAULT 'PENDING',
    "downloadUrl" TEXT,
    "expiresAt" TIMESTAMP(3),
    "errorCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExportReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReplenishmentLifecycleRule_shop_isActive_idx" ON "ReplenishmentLifecycleRule"("shop", "isActive");

-- CreateIndex
CREATE INDEX "ReplenishmentLifecycleRule_shop_priority_idx" ON "ReplenishmentLifecycleRule"("shop", "priority");

-- CreateIndex
CREATE UNIQUE INDEX "ReplenishmentLifecycleRule_shop_categoryTag_key" ON "ReplenishmentLifecycleRule"("shop", "categoryTag");

-- CreateIndex
CREATE INDEX "CustomerPurchaseSnapshot_shop_shopifyCustomerId_idx" ON "CustomerPurchaseSnapshot"("shop", "shopifyCustomerId");

-- CreateIndex
CREATE INDEX "CustomerPurchaseSnapshot_shop_categoryTag_idx" ON "CustomerPurchaseSnapshot"("shop", "categoryTag");

-- CreateIndex
CREATE INDEX "CustomerPurchaseSnapshot_shop_shopifyCustomerId_lastPurchas_idx" ON "CustomerPurchaseSnapshot"("shop", "shopifyCustomerId", "lastPurchasedAt");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerPurchaseSnapshot_shop_shopifyCustomerId_productId_c_key" ON "CustomerPurchaseSnapshot"("shop", "shopifyCustomerId", "productId", "categoryTag");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_shop_eventType_occurredAt_idx" ON "AnalyticsEvent"("shop", "eventType", "occurredAt");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_shop_customerType_occurredAt_idx" ON "AnalyticsEvent"("shop", "customerType", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "AnalyticsEvent_shop_idempotencyKey_key" ON "AnalyticsEvent"("shop", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "KpiDefinition_key_key" ON "KpiDefinition"("key");

-- CreateIndex
CREATE INDEX "KpiSnapshot_shop_periodStart_periodEnd_idx" ON "KpiSnapshot"("shop", "periodStart", "periodEnd");

-- CreateIndex
CREATE INDEX "KpiSnapshot_shop_kpiKey_periodStart_idx" ON "KpiSnapshot"("shop", "kpiKey", "periodStart");

-- CreateIndex
CREATE INDEX "KpiSnapshot_shop_computedAt_idx" ON "KpiSnapshot"("shop", "computedAt");

-- CreateIndex
CREATE UNIQUE INDEX "KpiSnapshot_shop_kpiKey_periodStart_periodEnd_key" ON "KpiSnapshot"("shop", "kpiKey", "periodStart", "periodEnd");

-- CreateIndex
CREATE INDEX "AttributionRecord_shop_attributionType_createdAt_idx" ON "AttributionRecord"("shop", "attributionType", "createdAt");

-- CreateIndex
CREATE INDEX "AttributionRecord_sourceEventId_idx" ON "AttributionRecord"("sourceEventId");

-- CreateIndex
CREATE INDEX "AttributionRecord_outcomeEventId_idx" ON "AttributionRecord"("outcomeEventId");

-- CreateIndex
CREATE INDEX "ExportReport_shop_status_createdAt_idx" ON "ExportReport"("shop", "status", "createdAt");

-- CreateIndex
CREATE INDEX "ExportReport_shop_periodStart_periodEnd_idx" ON "ExportReport"("shop", "periodStart", "periodEnd");

-- AddForeignKey
ALTER TABLE "KpiSnapshot" ADD CONSTRAINT "KpiSnapshot_kpiKey_fkey" FOREIGN KEY ("kpiKey") REFERENCES "KpiDefinition"("key") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttributionRecord" ADD CONSTRAINT "AttributionRecord_sourceEventId_fkey" FOREIGN KEY ("sourceEventId") REFERENCES "AnalyticsEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttributionRecord" ADD CONSTRAINT "AttributionRecord_outcomeEventId_fkey" FOREIGN KEY ("outcomeEventId") REFERENCES "AnalyticsEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
