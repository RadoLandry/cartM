-- CreateEnum
CREATE TYPE "AIBehaviorTone" AS ENUM ('PROFESSIONAL', 'FRIENDLY', 'CONCISE', 'COACHING');

-- CreateEnum
CREATE TYPE "AIBehaviorSafetyPriority" AS ENUM ('SAFETY_FIRST', 'BALANCED');

-- CreateEnum
CREATE TYPE "AIBehaviorVersionStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "AIBehaviorAuditAction" AS ENUM ('DRAFT_SAVED', 'PUBLISHED', 'ROLLED_BACK');

-- CreateEnum
CREATE TYPE "AIBehaviorPreviewStatus" AS ENUM ('READY', 'RUNNING', 'FAILED');

-- CreateTable
CREATE TABLE "AIBehaviorDraft" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "versionToken" TEXT NOT NULL,
    "tone" "AIBehaviorTone" NOT NULL DEFAULT 'PROFESSIONAL',
    "aggressiveness" DECIMAL(4,3) NOT NULL DEFAULT 0.350,
    "safetyPriority" "AIBehaviorSafetyPriority" NOT NULL DEFAULT 'SAFETY_FIRST',
    "customGuidance" TEXT,
    "conversationStarters" JSONB,
    "updatedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AIBehaviorDraft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIBehaviorPublishedVersion" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "status" "AIBehaviorVersionStatus" NOT NULL DEFAULT 'ACTIVE',
    "snapshot" JSONB NOT NULL,
    "publishedBy" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AIBehaviorPublishedVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIBehaviorAuditEntry" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "actionType" "AIBehaviorAuditAction" NOT NULL,
    "actorId" TEXT NOT NULL,
    "draftId" TEXT,
    "targetVersionId" TEXT,
    "beforeSnapshot" JSONB,
    "afterSnapshot" JSONB,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIBehaviorAuditEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIBehaviorPreviewRun" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "draftId" TEXT,
    "status" "AIBehaviorPreviewStatus" NOT NULL DEFAULT 'RUNNING',
    "inputSnapshot" JSONB NOT NULL,
    "scenarioSet" JSONB NOT NULL,
    "resultPayload" JSONB,
    "errorCode" TEXT,
    "requestedBy" TEXT NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AIBehaviorPreviewRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AIBehaviorDraft_shop_key" ON "AIBehaviorDraft"("shop");

-- CreateIndex
CREATE INDEX "AIBehaviorDraft_shop_updatedAt_idx" ON "AIBehaviorDraft"("shop", "updatedAt");

-- CreateIndex
CREATE INDEX "AIBehaviorPublishedVersion_shop_status_publishedAt_idx" ON "AIBehaviorPublishedVersion"("shop", "status", "publishedAt");

-- CreateIndex
CREATE UNIQUE INDEX "AIBehaviorPublishedVersion_shop_versionNumber_key" ON "AIBehaviorPublishedVersion"("shop", "versionNumber");

-- CreateIndex
CREATE INDEX "AIBehaviorAuditEntry_shop_createdAt_idx" ON "AIBehaviorAuditEntry"("shop", "createdAt");

-- CreateIndex
CREATE INDEX "AIBehaviorAuditEntry_draftId_idx" ON "AIBehaviorAuditEntry"("draftId");

-- CreateIndex
CREATE INDEX "AIBehaviorAuditEntry_targetVersionId_idx" ON "AIBehaviorAuditEntry"("targetVersionId");

-- CreateIndex
CREATE INDEX "AIBehaviorPreviewRun_shop_requestedAt_idx" ON "AIBehaviorPreviewRun"("shop", "requestedAt");

-- CreateIndex
CREATE INDEX "AIBehaviorPreviewRun_shop_status_requestedAt_idx" ON "AIBehaviorPreviewRun"("shop", "status", "requestedAt");

-- CreateIndex
CREATE INDEX "AIBehaviorPreviewRun_draftId_idx" ON "AIBehaviorPreviewRun"("draftId");

-- AddForeignKey
ALTER TABLE "AIBehaviorAuditEntry" ADD CONSTRAINT "AIBehaviorAuditEntry_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "AIBehaviorDraft"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIBehaviorAuditEntry" ADD CONSTRAINT "AIBehaviorAuditEntry_targetVersionId_fkey" FOREIGN KEY ("targetVersionId") REFERENCES "AIBehaviorPublishedVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIBehaviorPreviewRun" ADD CONSTRAINT "AIBehaviorPreviewRun_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "AIBehaviorDraft"("id") ON DELETE SET NULL ON UPDATE CASCADE;
