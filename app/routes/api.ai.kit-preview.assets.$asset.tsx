import type { LoaderFunctionArgs } from "react-router";

import { getPreviewAsset } from "../lib/visual/compositor";

export const runtime = "nodejs";

export const loader = async ({ params }: LoaderFunctionArgs) => {
  const asset = params.asset ?? "";
  const cacheKey = asset.replace(/\.(?:png|webp|svg)$/i, "");
  const preview = getPreviewAsset(cacheKey);

  if (!preview) {
    return new Response("Preview asset not found.", {
      status: 404,
      headers: {
        "cache-control": "no-store",
      },
    });
  }

  return new Response(preview.body, {
    status: 200,
    headers: {
      "content-type": `${preview.mimeType}; charset=utf-8`,
      "cache-control": "private, max-age=300",
    },
  });
};
