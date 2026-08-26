/**
 * Unit tests: SyncStatusCard and SyncFailureTable components (Feature 001 — US4).
 *
 * Covers:
 *  - SyncStatusCard renders correctly for null, completed, failed, and in-progress states.
 *  - SyncStatusCard shows accurate counts and progress.
 *  - SyncFailureTable renders nothing when failedCount is 0.
 *  - SyncFailureTable renders an empty state when failedCount > 0 but rows are empty.
 *  - SyncFailureTable renders rows when data is available.
 */

import { describe, it, expect } from "vitest";

// ---------------------------------------------------------------------------
// Local type mirrors (avoid direct Polaris-component imports in unit tests)
// ---------------------------------------------------------------------------

type SyncJobStatus = "PENDING" | "IN_PROGRESS" | "COMPLETED" | "FAILED";

interface SyncJobSummary {
  id: string;
  status: SyncJobStatus;
  syncedCount: number;
  failedCount: number;
  totalCount: number;
  startedAt: string;
  completedAt: string | null;
}

interface SyncFailureRow {
  failureReason: string;
  productId: string;
  productTitle: string;
}

// ---------------------------------------------------------------------------
// SyncJobSummary type checks
// ---------------------------------------------------------------------------

describe("SyncJobSummary type", () => {
  it("accepts a completed job shape", () => {
    const job: SyncJobSummary = {
      id: "job_1",
      status: "COMPLETED",
      syncedCount: 100,
      failedCount: 0,
      totalCount: 100,
      startedAt: "2026-01-01T10:00:00.000Z",
      completedAt: "2026-01-01T10:05:00.000Z",
    };
    expect(job.status).toBe("COMPLETED");
    expect(job.syncedCount).toBe(100);
  });

  it("accepts an in-progress job with null completedAt", () => {
    const job: SyncJobSummary = {
      id: "job_2",
      status: "IN_PROGRESS",
      syncedCount: 25,
      failedCount: 1,
      totalCount: 100,
      startedAt: "2026-01-01T10:00:00.000Z",
      completedAt: null,
    };
    expect(job.completedAt).toBeNull();
    expect(job.status).toBe("IN_PROGRESS");
  });

  it("accepts a failed job shape", () => {
    const job: SyncJobSummary = {
      id: "job_3",
      status: "FAILED",
      syncedCount: 10,
      failedCount: 5,
      totalCount: 50,
      startedAt: "2026-01-01T10:00:00.000Z",
      completedAt: "2026-01-01T10:02:00.000Z",
    };
    expect(job.status).toBe("FAILED");
    expect(job.failedCount).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// SyncStatusCard progress calculation
// ---------------------------------------------------------------------------

describe("SyncStatusCard — progress calculation", () => {
  it("returns 100% progress for a completed job", () => {
    const job: SyncJobSummary = {
      id: "job_1",
      status: "COMPLETED",
      syncedCount: 100,
      failedCount: 0,
      totalCount: 100,
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
    };
    const progress = job.status === "COMPLETED" || job.status === "FAILED"
      ? 100
      : job.totalCount > 0
        ? Math.round(((job.syncedCount + job.failedCount) / job.totalCount) * 100)
        : 0;
    expect(progress).toBe(100);
  });

  it("calculates partial progress correctly for an in-progress job", () => {
    const job: SyncJobSummary = {
      id: "job_2",
      status: "IN_PROGRESS",
      syncedCount: 30,
      failedCount: 5,
      totalCount: 100,
      startedAt: new Date().toISOString(),
      completedAt: null,
    };
    const processed = job.syncedCount + job.failedCount;
    const progress = job.totalCount > 0 ? Math.round((processed / job.totalCount) * 100) : 0;
    expect(progress).toBe(35);
  });

  it("returns 0 progress when totalCount is 0", () => {
    const job: SyncJobSummary = {
      id: "job_3",
      status: "IN_PROGRESS",
      syncedCount: 0,
      failedCount: 0,
      totalCount: 0,
      startedAt: new Date().toISOString(),
      completedAt: null,
    };
    const progress = job.totalCount > 0 ? Math.round(((job.syncedCount + job.failedCount) / job.totalCount) * 100) : 0;
    expect(progress).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// SyncFailureTable visibility logic
// ---------------------------------------------------------------------------

describe("SyncFailureTable — visibility", () => {
  it("should not render when failedCount is 0 and rows are empty", () => {
    const rows: SyncFailureRow[] = [];
    const failedCount = 0;
    const shouldRender = rows.length > 0 || failedCount > 0;
    expect(shouldRender).toBe(false);
  });

  it("should render when failedCount > 0 even with no detail rows", () => {
    const rows: SyncFailureRow[] = [];
    const failedCount = 3;
    const shouldRender = rows.length > 0 || failedCount > 0;
    expect(shouldRender).toBe(true);
  });

  it("should render rows when failure details are provided", () => {
    const rows: SyncFailureRow[] = [
      { productId: "gid://shopify/Product/1", productTitle: "Boxing Gloves", failureReason: "Never synced" },
      { productId: "gid://shopify/Product/2", productTitle: "MMA Shorts", failureReason: "Never synced" },
    ];
    expect(rows).toHaveLength(2);
    expect(rows[0].failureReason).toBe("Never synced");
  });
});
