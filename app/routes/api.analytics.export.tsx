import { ExportReportStatus } from "@prisma/client";
import type { ActionFunctionArgs } from "react-router";

import { createExportReport } from "../lib/db/queries";
import { parseAnalyticsExportRequest } from "../lib/analytics/schemas";
import { generateAnalyticsCsvForReport } from "../lib/analytics/export";
import { enqueueExportJob, shouldUseAsyncExport } from "../lib/analytics/export-jobs";
import { authenticate } from "../shopify.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  const body = await request.json().catch(() => null);
  const parsed = parseAnalyticsExportRequest(body);

  if (!parsed.success) {
    return Response.json(
      {
        error: "INVALID_EXPORT_REQUEST",
        message: "Invalid export request parameters.",
        details: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  const report = await createExportReport({
    shop: session.shop,
    requestedBy: session.shop,
    periodStart: new Date(parsed.data.startDate),
    periodEnd: new Date(parsed.data.endDate),
    format: parsed.data.format,
    filters: {
      customerType: parsed.data.customerType,
    },
  });

  const useAsync = shouldUseAsyncExport(report.periodStart, report.periodEnd);

  if (useAsync) {
    await enqueueExportJob({
      exportId: report.id,
      shop: report.shop,
    });

    return Response.json(
      {
        exportId: report.id,
        status: ExportReportStatus.RUNNING,
      },
      { status: 202 },
    );
  }

  const result = await generateAnalyticsCsvForReport(report);

  return Response.json(
    {
      exportId: report.id,
      status: ExportReportStatus.READY,
      downloadUrl: result.downloadUrl,
      expiresAt: result.expiresAt.toISOString(),
    },
    { status: 202 },
  );
};
