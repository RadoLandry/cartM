import type { ActionFunctionArgs } from "react-router";

import { StorefrontChatBootstrapRequestSchema } from "../lib/ai/schemas";
import { issueStorefrontChatToken } from "../lib/shopify/app-proxy";
import { authenticate } from "../shopify.server";

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
      { status: 400 },
    );
  }

  const bootstrap = issueStorefrontChatToken(parsed.data);
  const requestUrl = new URL(request.url);
  const appUrl = process.env.SHOPIFY_APP_URL || `${requestUrl.protocol}//${requestUrl.host}`;

  return Response.json({
    ok: true,
    bootstrap: {
      shop: parsed.data.shop,
      ...(parsed.data.cartId ? { cartId: parsed.data.cartId } : {}),
      ...bootstrap,
      chatUrl: new URL("/api/ai/chat", appUrl).toString(),
    },
  });
};