export type SyncJobSummary = {
  id: string;
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "FAILED";
  syncedCount: number;
  failedCount: number;
  totalCount: number;
  startedAt: string;
  completedAt: string | null;
};

export function SyncStatusCard({ job }: { job: SyncJobSummary | null }) {
  if (!job) {
    return (
      <s-stack direction="block" gap="base">
        <s-paragraph>No sync job has run yet.</s-paragraph>
      </s-stack>
    );
  }

  const processed = job.syncedCount + job.failedCount;
  const progressValue =
    job.status === "COMPLETED" || job.status === "FAILED"
      ? 100
      : job.totalCount > 0
        ? Math.round((processed / job.totalCount) * 100)
        : 0;

  return (
    <s-stack direction="block" gap="base">
      <s-paragraph>
        Status: <strong>{job.status}</strong>
      </s-paragraph>
      <progress
        aria-label="Sync progress"
        value={progressValue}
        max={100}
        style={{ width: "100%", height: "0.875rem" }}
      />
      <s-paragraph>
        Products synced: {job.syncedCount}
        {job.totalCount > 0 ? ` / ${job.totalCount}` : ""}
      </s-paragraph>
      {job.failedCount > 0 && (
        <s-paragraph>Failures: {job.failedCount}</s-paragraph>
      )}
      <s-paragraph>Started: {new Date(job.startedAt).toLocaleString()}</s-paragraph>
      {job.completedAt && (
        <s-paragraph>Completed: {new Date(job.completedAt).toLocaleString()}</s-paragraph>
      )}
    </s-stack>
  );
}
