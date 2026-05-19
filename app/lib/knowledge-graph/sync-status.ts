export type SyncStatusSummary = {
  failedCount: number;
  syncedCount: number;
  totalCount: number;
};

export function createEmptySyncStatusSummary(): SyncStatusSummary {
  return {
    failedCount: 0,
    syncedCount: 0,
    totalCount: 0,
  };
}