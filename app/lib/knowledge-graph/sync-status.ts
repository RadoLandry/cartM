import { SyncJobStatus } from "@prisma/client";
import { updateSyncJobProgress, completeSyncJob, failSyncJob } from "../db/queries";

export type SyncStatusSummary = {
  id: string;
  failedCount: number;
  syncedCount: number;
  totalCount: number;
  status: SyncJobStatus;
};

export class SyncTracker {
  private summary: SyncStatusSummary;

  constructor(jobId: string, totalCount: number = 0) {
    this.summary = {
      id: jobId,
      failedCount: 0,
      syncedCount: 0,
      totalCount,
      status: SyncJobStatus.IN_PROGRESS,
    };
  }

  async incrementSynced(count: number = 1) {
    this.summary.syncedCount += count;
    await this.persist();
  }

  async incrementFailed(count: number = 1) {
    this.summary.failedCount += count;
    await this.persist();
  }

  async setTotal(total: number) {
    this.summary.totalCount = total;
    await this.persist();
  }

  async complete() {
    this.summary.status = SyncJobStatus.COMPLETED;
    await completeSyncJob(this.summary.id);
  }

  async fail() {
    this.summary.status = SyncJobStatus.FAILED;
    await failSyncJob(this.summary.id);
  }

  private async persist() {
    await updateSyncJobProgress(
      this.summary.id,
      this.summary.syncedCount,
      this.summary.failedCount,
      this.summary.totalCount
    );
  }

  getSummary(): SyncStatusSummary {
    return { ...this.summary };
  }
}
