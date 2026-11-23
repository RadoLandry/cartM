export type SyncJobSummary = {
  id: string;
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "FAILED";
  syncedCount: number;
  failedCount: number;
  totalCount: number;
  startedAt: string;
  completedAt: string | null;
};

const STATUS_LABELS: Record<SyncJobSummary["status"], string> = {
  PENDING: "Pending",
  IN_PROGRESS: "In progress",
  COMPLETED: "Completed",
  FAILED: "Failed",
};

const STATUS_TONES = {
  PENDING: "neutral",
  IN_PROGRESS: "info",
  COMPLETED: "success",
  FAILED: "critical",
} as const satisfies Record<SyncJobSummary["status"], string>;

// Fixed locale and UTC so server and client render the same text (no hydration mismatch).
export function formatSyncDate(value: string) {
  return `${new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "medium",
    timeZone: "UTC",
  }).format(new Date(value))} UTC`;
}

export function formatDuration(ms: number) {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}h ${minutes}min`;
  if (minutes > 0) return `${minutes}min ${seconds}s`;
  return `${seconds}s`;
}

export function getSyncProgress(job: SyncJobSummary) {
  if (job.status === "COMPLETED" || job.status === "FAILED") {
    return 100;
  }
  if (job.totalCount <= 0) {
    return 0;
  }
  return Math.min(100, Math.round(((job.syncedCount + job.failedCount) / job.totalCount) * 100));
}

// Linear estimate from the average processing speed since the job started.
export function estimateRemainingMs(job: SyncJobSummary, now: number) {
  const processed = job.syncedCount + job.failedCount;
  if (job.status !== "IN_PROGRESS" || job.totalCount <= 0 || processed <= 0) {
    return null;
  }
  const elapsed = now - new Date(job.startedAt).getTime();
  if (elapsed <= 0) {
    return null;
  }
  return Math.max(0, (elapsed / processed) * (job.totalCount - processed));
}

export function SyncStatusBadge({ status }: { status: SyncJobSummary["status"] }) {
  return <s-badge tone={STATUS_TONES[status]}>{STATUS_LABELS[status]}</s-badge>;
}

export function SyncStatusCard({ job, now }: { job: SyncJobSummary | null; now: number }) {
  if (!job) {
    return (
      <s-stack direction="block" gap="base">
        <s-paragraph>No sync job has run yet. Use “Run catalog sync” to import your products.</s-paragraph>
      </s-stack>
    );
  }

  const progressValue = getSyncProgress(job);
  const isRunning = job.status === "IN_PROGRESS" || job.status === "PENDING";
  const endTime = job.completedAt ? new Date(job.completedAt).getTime() : now;
  const duration = formatDuration(endTime - new Date(job.startedAt).getTime());
  const remaining = estimateRemainingMs(job, now);

  return (
    <s-stack direction="block" gap="base">
      <s-stack direction="inline" gap="small-300" alignItems="center">
        <s-text>Status:</s-text>
        <SyncStatusBadge status={job.status} />
      </s-stack>
      <progress
        aria-label="Sync progress"
        value={progressValue}
        max={100}
        style={{ width: "100%", height: "0.875rem" }}
      />
      <s-paragraph>
        {progressValue}%
        {isRunning && job.totalCount === 0 ? " · calculating total…" : ""}
        {remaining !== null ? ` · about ${formatDuration(remaining)} remaining` : ""}
      </s-paragraph>
      <s-paragraph>
        Products synced: {job.syncedCount}
        {job.totalCount > 0 ? ` / ${job.totalCount}` : ""}
      </s-paragraph>
      {job.failedCount > 0 && (
        <s-paragraph>Failures: {job.failedCount}</s-paragraph>
      )}
      <s-paragraph>Started: {formatSyncDate(job.startedAt)}</s-paragraph>
      <s-paragraph>{isRunning ? "Elapsed" : "Duration"}: {duration}</s-paragraph>
      {job.completedAt && (
        <s-paragraph>Completed: {formatSyncDate(job.completedAt)}</s-paragraph>
      )}
    </s-stack>
  );
}

const cellStyle = { textAlign: "left", padding: "0.25rem 0.5rem" } as const;

export function SyncHistoryTable({ jobs }: { jobs: SyncJobSummary[] }) {
  if (jobs.length === 0) {
    return <s-paragraph>No previous sync jobs.</s-paragraph>;
  }

  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
      <thead>
        <tr>
          <th style={cellStyle}>Started</th>
          <th style={cellStyle}>Status</th>
          <th style={cellStyle}>Duration</th>
          <th style={cellStyle}>Synced</th>
          <th style={cellStyle}>Failed</th>
        </tr>
      </thead>
      <tbody>
        {jobs.map((job) => (
          <tr key={job.id}>
            <td style={cellStyle}>{formatSyncDate(job.startedAt)}</td>
            <td style={cellStyle}>
              <SyncStatusBadge status={job.status} />
            </td>
            <td style={cellStyle}>
              {job.completedAt
                ? formatDuration(new Date(job.completedAt).getTime() - new Date(job.startedAt).getTime())
                : "—"}
            </td>
            <td style={cellStyle}>
              {job.syncedCount}
              {job.totalCount > 0 ? ` / ${job.totalCount}` : ""}
            </td>
            <td style={cellStyle}>{job.failedCount}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
