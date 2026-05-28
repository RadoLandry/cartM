import type { ActionFunctionArgs } from "react-router";

import { StorefrontChatRequestSchema } from "../lib/ai/schemas";
import { buildStorefrontChatStreamParts } from "../lib/ai/storefront-chat";
import {
  assertAllowedStorefrontOrigin,
  verifyStorefrontChatToken,
} from "../lib/shopify/app-proxy";

function encodeSseEvent(payload: unknown) {
  return `data: ${JSON.stringify(payload)}\n\n`;
}

export const action = async ({ request }: ActionFunctionArgs) => {
  const body = await request.json().catch(() => null);
  const parsed = StorefrontChatRequestSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json(
      {
        ok: false,
        error: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  const verification = verifyStorefrontChatToken(parsed.data.streamToken);

  if (!verification.ok) {
    return Response.json(
      {
        ok: false,
        error: {
          code: verification.code,
          message: verification.message,
        },
      },
      { status: verification.code === "TOKEN_EXPIRED" ? 401 : 403 },
    );
  }

  if (
    verification.payload.shop !== parsed.data.shop
    || verification.payload.sessionKey !== parsed.data.sessionKey
    || verification.payload.cartId !== parsed.data.cart.cartId
  ) {
    return Response.json(
      {
        ok: false,
        error: {
          code: "INVALID_TOKEN_SCOPE",
          message: "Chat token scope does not match the request.",
        },
      },
      { status: 403 },
    );
  }

  const originCheck = assertAllowedStorefrontOrigin(request, parsed.data.shop);

  if (!originCheck.ok) {
    return Response.json(
      {
        ok: false,
        error: {
          code: originCheck.code,
          message: originCheck.message,
        },
      },
      { status: 403 },
    );
  }

  const streamParts = buildStorefrontChatStreamParts(parsed.data);
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const part of streamParts) {
        controller.enqueue(encoder.encode(encodeSseEvent(part)));
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "content-type": "text/event-stream; charset=utf-8",
      ...(originCheck.origin ? { "access-control-allow-origin": originCheck.origin } : {}),
      vary: "Origin",
    },
  });
};

export const loader = async () => Response.json({ ok: false, error: { code: "METHOD_NOT_ALLOWED", message: "Use POST." } }, { status: 405 });