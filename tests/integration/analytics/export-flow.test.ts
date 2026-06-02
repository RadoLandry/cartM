import { ExportReportStatus, ExportReportFormat } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../app/shopify.server", () => ({
  authenticate: {
    admin: vi.fn(),
  },
}));

vi.mock("../../../app/lib/db/queries", () => ({
  createExportReport: vi.fn(),
  getExportReportById: vi.fn(),
}));

vi.mock("../../../app/lib/analytics/export", () => ({
  generateAnalyticsCsvForReport: vi.fn(),
}));

vi.mock("../../../app/lib/analytics/export-jobs", async () => {
  const actual = await vi.importActual<typeof import("../../../app/lib/analytics/export-jobs")>(
    "../../../app/lib/analytics/export-jobs",
  );

  return {
    ...actual,
    shouldUseAsyncExport: vi.fn(),
    enqueueExportJob: vi.fn(),
  };
});

import { action } from "../../../app/routes/api.analytics.export";
import { loader } from "../../../app/routes/api.analytics.export.$exportId";
import { authenticate } from "../../../app/shopify.server";
import { createExportReport, getExportReportById } from "../../../app/lib/db/queries";
import { generateAnalyticsCsvForReport } from "../../../app/lib/analytics/export";
import { enqueueExportJob, shouldUseAsyncExport } from "../../../app/lib/analytics/export-jobs";

describe("analytics export flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authenticate.admin).mockResolvedValue({
      session: { shop: "test.myshopify.com" },
    } as never);

    vi.mocked(createExportReport).mockResolvedValue({
      id: "exp_1",
      shop: "test.myshopify.com",
      requestedBy: "test.myshopify.com",
      format: ExportReportFormat.CSV,
      periodStart: new Date("2026-06-01T00:00:00.000Z"),
      periodEnd: new Date("2026-06-30T00:00:00.000Z"),
      filters: null,
      status: ExportReportStatus.PENDING,
      downloadUrl: null,
      expiresAt: null,
      errorCode: null,
      createdAt: new Date(),
      completedAt: null,
      updatedAt: new Date(),
    } as never);
  });

  it("returns READY export payload for synchronous range", async () => {
    vi.mocked(shouldUseAsyncExport).mockReturnValueOnce(false);
    vi.mocked(generateAnalyticsCsvForReport).mockResolvedValueOnce({
      csv: "shop,kpiKey,value,periodStart,periodEnd",
      downloadUrl: "https://exports.cartmind.local/exp_1.csv",
      expiresAt: new Date("2026-07-01T00:00:00.000Z"),
    });

    const response = await action({
      request: new Request("http://localhost/api/analytics/export", {
        method: "POST",
        body: JSON.stringify({
          startDate: "2026-06-01",
          endDate: "2026-06-30",
          format: "CSV",
        }),
      }),
      params: {},
      context: {},
    } as never);

    const json = await response.json();

    expect(response.status).toBe(202);
    expect(json.status).toBe("READY");
    expect(json.downloadUrl).toContain("exp_1.csv");
  });

  it("returns RUNNING export payload for asynchronous range", async () => {
    vi.mocked(shouldUseAsyncExport).mockReturnValueOnce(true);
    vi.mocked(enqueueExportJob).mockResolvedValueOnce({
      ok: true,
      status: ExportReportStatus.RUNNING,
    });

    const response = await action({
      request: new Request("http://localhost/api/analytics/export", {
        method: "POST",
        body: JSON.stringify({
          startDate: "2026-01-01",
          endDate: "2026-06-30",
          format: "CSV",
        }),
      }),
      params: {},
      context: {},
    } as never);

    const json = await response.json();

    expect(response.status).toBe(202);
    expect(json.status).toBe("RUNNING");
    expect(enqueueExportJob).toHaveBeenCalledWith({
      exportId: "exp_1",
      shop: "test.myshopify.com",
    });
  });

  it("returns export status payload by export id", async () => {
    vi.mocked(getExportReportById).mockResolvedValueOnce({
      id: "exp_1",
      shop: "test.myshopify.com",
      requestedBy: "test.myshopify.com",
      format: ExportReportFormat.CSV,
      periodStart: new Date("2026-06-01T00:00:00.000Z"),
      periodEnd: new Date("2026-06-30T00:00:00.000Z"),
      filters: null,
      status: ExportReportStatus.READY,
      downloadUrl: "https://exports.cartmind.local/exp_1.csv",
      expiresAt: new Date("2026-07-01T00:00:00.000Z"),
      errorCode: null,
      createdAt: new Date(),
      completedAt: new Date(),
      updatedAt: new Date(),
    } as never);

    const response = await loader({
      request: new Request("http://localhost/api/analytics/export/exp_1"),
      params: {
        exportId: "exp_1",
      },
      context: {},
    } as never);

    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toMatchObject({
      exportId: "exp_1",
      status: "READY",
    });
  });
});
