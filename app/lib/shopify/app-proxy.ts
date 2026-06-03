import crypto from "node:crypto";

import type { StorefrontChatBootstrapRequest, StorefrontWidgetMountConfig } from "../ai/schemas";
import { buildStorefrontWidgetMountConfig } from "./storefront-integration";

const STREAM_TOKEN_TTL_MS = 5 * 60 * 1000;

interface StreamTokenPayload {
  shop: string;
  sessionKey: string;
  cartId?: string;
  exp: number;
}

const ACTION_CONFIRMATION_TOKEN_TTL_MS = 2 * 60 * 1000;

interface ActionConfirmationTokenPayload {
  actionId: string;
  shop: string;
  sessionKey: string;
  cartId?: string;
  exp: number;
}

function getSigningSecret() {
  const secret = process.env.STOREFRONT_CHAT_SIGNING_SECRET || process.env.SHOPIFY_API_SECRET;

  if (!secret) {
    throw new Error("Missing storefront chat signing secret. Set STOREFRONT_CHAT_SIGNING_SECRET or SHOPIFY_API_SECRET.");
  }

  return secret;
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

  if (!payload.shop || !payload.sessionKey || typeof payload.exp !== "number") {
    return { ok: false as const, code: "INVALID_TOKEN", message: "Chat token payload is missing required fields." };
  }

  if (!payload.sessionKey.startsWith("chat_")) {
    return { ok: false as const, code: "INVALID_TOKEN", message: "Chat token session scope is invalid." };
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

export function issueActionConfirmationToken(input: {
  actionId: string;
  shop: string;
  sessionKey: string;
  cartId?: string;
}) {
  const payload: ActionConfirmationTokenPayload = {
    actionId: input.actionId,
    shop: input.shop,
    sessionKey: input.sessionKey,
    ...(input.cartId ? { cartId: input.cartId } : {}),
    exp: Date.now() + ACTION_CONFIRMATION_TOKEN_TTL_MS,
  };

  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = sign(encodedPayload);

  return {
    token: `${encodedPayload}.${signature}`,
    expiresAt: new Date(payload.exp).toISOString(),
  };
}

export function verifyActionConfirmationToken(token: string) {
  const [encodedPayload, signature] = token.split(".");

  if (!encodedPayload || !signature) {
    return { ok: false as const, code: "INVALID_TOKEN", message: "Confirmation token is malformed." };
  }

  const expectedSignature = sign(encodedPayload);
  const providedBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (providedBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(providedBuffer, expectedBuffer)) {
    return { ok: false as const, code: "INVALID_TOKEN", message: "Confirmation token could not be verified." };
  }

  let payload: ActionConfirmationTokenPayload;

  try {
    payload = JSON.parse(base64UrlDecode(encodedPayload)) as ActionConfirmationTokenPayload;
  } catch {
    return { ok: false as const, code: "INVALID_TOKEN", message: "Confirmation token payload is invalid." };
  }

  if (!payload.actionId || !payload.shop || !payload.sessionKey || typeof payload.exp !== "number") {
    return { ok: false as const, code: "INVALID_TOKEN", message: "Confirmation token payload is missing required fields." };
  }

  if (payload.exp <= Date.now()) {
    return {
      ok: false as const,
      code: "ACTION_EXPIRED",
      message: "This action expired. Please ask again to create a new proposal.",
    };
  }

  return { ok: true as const, payload };
}

export function buildAppProxyStorefrontMountConfig(input: {
  shop: string;
  surface: StorefrontWidgetMountConfig["surface"];
  placementId?: string;
  appBaseUrl: string;
  bootstrapPath?: string;
  recommendationsPath?: string;
  cart: StorefrontWidgetMountConfig["cart"];
  labels?: StorefrontWidgetMountConfig["labels"];
  features?: StorefrontWidgetMountConfig["features"];
}) {
  const bootstrapPath = input.bootstrapPath ?? "/apps/cartmind-chat/chat-bootstrap";

  return buildStorefrontWidgetMountConfig({
    shop: input.shop,
    surface: input.surface,
    placementId: input.placementId ?? `${input.surface}:default`,
    appBaseUrl: input.appBaseUrl,
    bootstrapPath,
    bootstrapUrl: new URL(bootstrapPath, input.appBaseUrl).toString(),
    recommendationsPath: input.recommendationsPath ?? "/api/ai/recommendations",
    cart: input.cart,
    labels: input.labels,
    features: input.features,
  });
}