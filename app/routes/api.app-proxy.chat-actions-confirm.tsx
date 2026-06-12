import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";

import { action as confirmAction } from "./api.ai.chat.actions.confirm";
import { authenticate } from "../shopify.server";

const CORS_BASE_HEADERS = {
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "content-type",
  "access-control-max-age": "86400",
};

function getCorsHeaders(request: Request) {
  const origin = request.headers.get("origin");
  return origin
    ? { ...CORS_BASE_HEADERS, "access-control-allow-origin": origin, vary: "Origin" }
    : CORS_BASE_HEADERS;
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: getCorsHeaders(request),
    });
  }

  return Response.json(
    { ok: false, error: { code: "METHOD_NOT_ALLOWED", message: "Use POST." } },
    { status: 405, headers: getCorsHeaders(request) },
  );
};

export const action = async (args: ActionFunctionArgs) => {
  await authenticate.public.appProxy(args.request);
  return confirmAction(args);
};