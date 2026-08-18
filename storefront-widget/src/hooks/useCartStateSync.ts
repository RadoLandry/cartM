import type { StorefrontCartSnapshot } from "../types";

export type CartSyncSource = "initial_config" | "cart_js" | "fetch_intercept" | "mutation_observer" | "fallback_poll";

export interface CartSyncSnapshot {
  cart: StorefrontCartSnapshot;
  syncedAt: number;
  syncSource: CartSyncSource;
}

export interface CartFetchInterceptorOptions {
  onCartMutation: (url: RequestInfo | URL) => void;
}

export function normalizeCartJsPayload(payload: unknown, fallback: StorefrontCartSnapshot): StorefrontCartSnapshot {
  if (!payload || typeof payload !== "object") return fallback;
  const cart = payload as { token?: unknown; currency?: unknown; items?: unknown };
  if (!Array.isArray(cart.items)) return fallback;

  return {
    ...(typeof cart.token === "string" && cart.token ? { cartId: cart.token } : fallback.cartId ? { cartId: fallback.cartId } : {}),
    currencyCode: typeof cart.currency === "string" && cart.currency ? cart.currency : fallback.currencyCode,
    items: cart.items
      .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
      .filter((item) => Boolean(item.product_id))
      .map((item) => ({
        ...(typeof item.key === "string" && item.key ? { lineId: item.key } : {}),
        productId: String(item.product_id),
        ...(typeof item.product_title === "string" && item.product_title ? { productTitle: item.product_title } : {}),
        ...(item.variant_id ? { variantId: String(item.variant_id) } : {}),
        ...(typeof item.variant_title === "string" && item.variant_title ? { variantTitle: item.variant_title } : {}),
        quantity: typeof item.quantity === "number" && item.quantity > 0 ? item.quantity : 1,
      })),
  };
}

export function buildCartSnapshotKey(cart: StorefrontCartSnapshot) {
  const lineKeys = cart.items
    .map((item) => [item.lineId ?? "", item.productId, item.variantId ?? "", item.quantity].join(":"))
    .sort();
  return [cart.cartId ?? "", cart.currencyCode, ...lineKeys].join("|");
}

export function isCartSnapshotStale(snapshot: CartSyncSnapshot, stalenessWindowMs: number) {
  return Date.now() - snapshot.syncedAt > stalenessWindowMs;
}

export function isCartMutationUrl(input: RequestInfo | URL) {
  const raw = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  const path = raw.startsWith("http") ? new URL(raw).pathname : raw.split("?")[0];
  return ["/cart/add.js", "/cart/change.js", "/cart/update.js", "/cart/clear.js"].includes(path);
}

export function buildFetchInterceptor(originalFetch: typeof fetch, options: CartFetchInterceptorOptions): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const response = await originalFetch(input, init);
    if (response.ok && isCartMutationUrl(input)) {
      options.onCartMutation(input);
    }
    return response;
  }) as typeof fetch;
}