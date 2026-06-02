import type { LoaderFunctionArgs } from "react-router";

import { getExportReportById } from "../lib/db/queries";
import { authenticate } from "../shopify.server";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  const exportId = params.exportId;

  if (!exportId) {
    return Response.json(
      {
        error: "INVALID_EXPORT_ID",
        message: "Export id is required.",
      },
      { status: 400 },
    );
  }

  const report = await getExportReportById(exportId, session.shop);

  if (!report) {
    return Response.json(
      {
        error: "EXPORT_NOT_FOUND",
        message: "Export report was not found.",
      },
      { status: 404 },
    );
  }

  return Response.json({
    exportId: report.id,
    status: report.status,
    downloadUrl: report.downloadUrl,
    expiresAt: report.expiresAt?.toISOString() ?? null,
    errorCode: report.errorCode,
  });
};
