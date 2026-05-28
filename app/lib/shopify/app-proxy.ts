import crypto from "node:crypto";

import type { StorefrontChatBootstrapRequest } from "../ai/schemas";

const STREAM_TOKEN_TTL_MS = 5 * 60 * 1000;

interface StreamTokenPayload {
  shop: string;
  sessionKey: string;
  cartId?: string;
  exp: number;
}

function getSigningSecret() {
  return process.env.STOREFRONT_CHAT_SIGNING_SECRET
    || process.env.SHOPIFY_API_SECRET
    || "development-storefront-chat-secret";
}

function base64UrlEncode(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function base64UrlDecode(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function sign(value: string) {
  return crypto.createHmac("sha256", getSigningSecret()).update(value).digest("base64url");
}

export function issueStorefrontChatToken(input: StorefrontChatBootstrapRequest) {
  const sessionKey = `chat_${input.sessionId}`;
  const payload: StreamTokenPayload = {
    shop: input.shop,
    sessionKey,
    ...(input.cartId ? { cartId: input.cartId } : {}),
    exp: Date.now() + STREAM_TOKEN_TTL_MS,
  };
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = sign(encodedPayload);

  return {
    sessionKey,
    streamToken: `${encodedPayload}.${signature}`,
    expiresAt: new Date(payload.exp).toISOString(),
    conversationLimits: {
      maxMessages: 20,
      maxInputCharacters: 2000,
    },
  };
}

export function verifyStorefrontChatToken(token: string) {
  const [encodedPayload, signature] = token.split(".");

  if (!encodedPayload || !signature) {
    return { ok: false as const, code: "INVALID_TOKEN", message: "Chat token is malformed." };
  }

  const expectedSignature = sign(encodedPayload);
  const providedBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (providedBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(providedBuffer, expectedBuffer)) {
    return { ok: false as const, code: "INVALID_TOKEN", message: "Chat token could not be verified." };
  }

  let payload: StreamTokenPayload;

  try {
    payload = JSON.parse(base64UrlDecode(encodedPayload)) as StreamTokenPayload;
  } catch {
    return { ok: false as const, code: "INVALID_TOKEN", message: "Chat token payload is invalid." };
  }

  if (payload.exp <= Date.now()) {
    return { ok: false as const, code: "TOKEN_EXPIRED", message: "Your chat session expired. Please reopen chat and try again." };
  }

  return { ok: true as const, payload };
}

export function assertAllowedStorefrontOrigin(request: Request, shop: string) {
  const origin = request.headers.get("origin");

  if (!origin) {
    return { ok: true as const, origin: undefined };
  }

  const allowedOrigins = new Set<string>([
    `https://${shop}`,
    process.env.SHOPIFY_APP_URL || "",
  ].filter(Boolean));

  if (!allowedOrigins.has(origin)) {
    return {
      ok: false as const,
      code: "INVALID_ORIGIN",
      message: "This storefront origin is not allowed to open a chat stream.",
    };
  }

  return { ok: true as const, origin };
}