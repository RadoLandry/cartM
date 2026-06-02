import { ExportReportStatus, type ExportReport } from "@prisma/client";

import {
  getKpiSnapshots,
  updateExportReportStatus,
} from "../db/queries";

function csvEscape(value: string): string {
  if (value.includes(",") || value.includes("\n") || value.includes("\"")) {
    return `"${value.replaceAll("\"", "\"\"")}"`;
  }

  return value;
}

function stringifyDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export function buildKpiCsv(input: {
  shop: string;
  startDate: Date;
  endDate: Date;
  rows: Array<{
    kpiKey: string;
    value: unknown;
    periodStart: Date;
    periodEnd: Date;
  }>;
}): string {
  const header = ["shop", "kpiKey", "value", "periodStart", "periodEnd"];
  const lines = input.rows.map((row) => {
    const cells = [
      input.shop,
      row.kpiKey,
      String(row.value),
      stringifyDate(row.periodStart),
      stringifyDate(row.periodEnd),
    ];

    return cells.map(csvEscape).join(",");
  });

  return [header.join(","), ...lines].join("\n");
}

export async function generateAnalyticsCsvForReport(report: ExportReport): Promise<{
  csv: string;
  downloadUrl: string;
  expiresAt: Date;
}> {
  const snapshots = await getKpiSnapshots(
    report.shop,
    report.periodStart,
    report.periodEnd,
  );

  const csv = buildKpiCsv({
    shop: report.shop,
    startDate: report.periodStart,
    endDate: report.periodEnd,
    rows: snapshots.map((snapshot) => ({
      kpiKey: snapshot.kpiKey,
      value: snapshot.value,
      periodStart: snapshot.periodStart,
      periodEnd: snapshot.periodEnd,
    })),
  });

  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24);
  const downloadUrl = `https://exports.cartmind.local/${report.id}.csv`;

  await updateExportReportStatus(report.id, ExportReportStatus.READY, {
    downloadUrl,
    expiresAt,
    completedAt: new Date(),
  });

  return {
    csv,
    downloadUrl,
    expiresAt,
  };
}
