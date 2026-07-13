import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";

import { StorefrontChatBootstrapRequestSchema } from "../lib/ai/schemas";
import { buildAppProxyStorefrontMountConfig, issueStorefrontChatToken } from "../lib/shopify/app-proxy";
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

export const action = async ({ request }: ActionFunctionArgs) => {
  await authenticate.public.appProxy(request);

  const body = await request.json().catch(() => null);
  const parsed = StorefrontChatBootstrapRequestSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json(
      {
        ok: false,
        error: parsed.error.flatten(),
      },
      { status: 400, headers: getCorsHeaders(request) },
    );
  }

  const bootstrap = issueStorefrontChatToken(parsed.data);
  const requestUrl = new URL(request.url);
  const appUrl = process.env.SHOPIFY_APP_URL || `${requestUrl.protocol}//${requestUrl.host}`;

  return Response.json(
    {
      ok: true,
      bootstrap: {
        shop: parsed.data.shop,
        ...(parsed.data.cartId ? { cartId: parsed.data.cartId } : {}),
        ...bootstrap,
        chatUrl: new URL("/api/ai/chat", appUrl).toString(),
        kitPreviewUrl: new URL("/api/ai/kit-preview", appUrl).toString(),
      },
      integration: buildAppProxyStorefrontMountConfig({
        shop: parsed.data.shop,
        surface: parsed.data.surface,
        appBaseUrl: appUrl,
        cart: {
          ...(parsed.data.cartId ? { cartId: parsed.data.cartId } : {}),
          currencyCode: parsed.data.currencyCode,
          items: [],
        },
      }),
    },
    { headers: getCorsHeaders(request) },
  );
};