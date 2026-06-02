import { ExportReportStatus } from "@prisma/client";

import { getExportReportById, updateExportReportStatus } from "../db/queries";
import { generateAnalyticsCsvForReport } from "./export";

const MAX_SYNC_EXPORT_DAYS = 31;

function dateDiffDays(start: Date, end: Date): number {
  const ms = end.getTime() - start.getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24)) + 1;
}

export function shouldUseAsyncExport(periodStart: Date, periodEnd: Date): boolean {
  return dateDiffDays(periodStart, periodEnd) > MAX_SYNC_EXPORT_DAYS;
}

export async function enqueueExportJob(input: { exportId: string; shop: string }) {
  const report = await getExportReportById(input.exportId, input.shop);

  if (!report) {
    return {
      ok: false as const,
      code: "NOT_FOUND",
    };
  }

  await updateExportReportStatus(report.id, ExportReportStatus.RUNNING);

  return {
    ok: true as const,
    status: ExportReportStatus.RUNNING,
  };
}

export async function runExportJob(input: { exportId: string; shop: string }) {
  const report = await getExportReportById(input.exportId, input.shop);

  if (!report) {
    return {
      ok: false as const,
      code: "NOT_FOUND",
    };
  }

  if (report.status !== ExportReportStatus.RUNNING) {
    await updateExportReportStatus(report.id, ExportReportStatus.RUNNING);
  }

  try {
    await generateAnalyticsCsvForReport(report);
    return {
      ok: true as const,
      status: ExportReportStatus.READY,
    };
  } catch {
    await updateExportReportStatus(report.id, ExportReportStatus.FAILED, {
      errorCode: "EXPORT_GENERATION_FAILED",
      completedAt: new Date(),
    });

    return {
      ok: false as const,
      code: "EXPORT_GENERATION_FAILED",
    };
  }
}
