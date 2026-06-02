-- CreateEnum
CREATE TYPE "BundleRuleAuditAction" AS ENUM ('CREATED', 'UPDATED', 'STATUS_CHANGED', 'DUPLICATED', 'ARCHIVED');

-- AlterEnum
ALTER TYPE "BundleRuleStatus" ADD VALUE 'PAUSED';

-- CreateTable
CREATE TABLE "BundleRuleAuditRecord" (
    "id" TEXT NOT NULL,
    "bundleRuleId" TEXT NOT NULL,
    "actionType" "BundleRuleAuditAction" NOT NULL,
    "actorId" TEXT NOT NULL,
    "fromStatus" "BundleRuleStatus",
    "toStatus" "BundleRuleStatus",
    "changeSummary" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BundleRuleAuditRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BundleRuleAuditRecord_bundleRuleId_createdAt_idx" ON "BundleRuleAuditRecord"("bundleRuleId", "createdAt");

-- CreateIndex
CREATE INDEX "BundleRuleAuditRecord_actionType_createdAt_idx" ON "BundleRuleAuditRecord"("actionType", "createdAt");

-- AddForeignKey
ALTER TABLE "BundleRuleAuditRecord" ADD CONSTRAINT "BundleRuleAuditRecord_bundleRuleId_fkey" FOREIGN KEY ("bundleRuleId") REFERENCES "BundleRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;
