import { useCallback, useEffect, useRef, useState } from "react";

import type { StorefrontCartSnapshot } from "../types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CartSyncSource =
  | "initial_config"
  | "cart_js"
  | "fetch_intercept"
  | "mutation_observer"
  | "fallback_poll";

export interface CartSyncSnapshot {
  cart: StorefrontCartSnapshot;
  syncedAt: number;
  syncSource: CartSyncSource;
}

export interface CartFetchInterceptorOptions {
  onCartMutation: (url: string) => void;
}

export interface UseCartStateSyncOptions {
  initialCart: StorefrontCartSnapshot;
  surface: "cart_drawer" | "cart_page";
  /** Called with latest snapshot + source whenever cart state changes */
  onCartChanged: (snapshot: StorefrontCartSnapshot, source: CartSyncSource) => void;
  /** If true the sync hook is active (surface is visible / mounted) */
  active: boolean;
  /** Fetch impl for testing; defaults to window.fetch */
  fetchImpl?: typeof fetch;
  /** Fallback poll interval in ms; defaults to 5 000 */
  pollIntervalMs?: number;
  /** Max number of fallback polls before stopping; defaults to 20 */
  maxPollCount?: number;
  /** Staleness window in ms before a snapshot is considered stale; defaults to 5 000 */
  staleWindowMs?: number;
}

// ---------------------------------------------------------------------------
// Pure helpers (exported for unit tests)
// ---------------------------------------------------------------------------

const CART_MUTATION_PATHS = [
  "/cart/add.js",
  "/cart/change.js",
  "/cart/update.js",
  "/cart/clear.js",
];

/**
 * Returns true if the given URL is a Shopify cart mutation endpoint.
 */
export function isCartMutationUrl(url: string): boolean {
  return CART_MUTATION_PATHS.some((path) => url === path || url.endsWith(path));
}

/**
 * Normalizes a raw `/cart.js` response payload into a `StorefrontCartSnapshot`.
 * Falls back to `fallback` when the payload is not valid.
 */
export function normalizeCartJsPayload(
  payload: unknown,
  fallback: StorefrontCartSnapshot,
): StorefrontCartSnapshot {
  if (
    !payload
    || typeof payload !== "object"
    || !Array.isArray((payload as Record<string, unknown>).items)
  ) {
    return fallback;
  }

  const raw = payload as {
    token?: string;
    currency?: string;
    total_price?: number;
    items: Array<{
      key?: string;
      product_id?: number | string;
      product_title?: string;
      variant_id?: number | string;
      variant_title?: string;
      quantity?: number;
    }>;
  };

  const items = raw.items
    .map((item) => ({
      lineId: item.key ? String(item.key) : undefined,
      productId: String(item.product_id || ""),
      productTitle: item.product_title,
      variantId: item.variant_id ? String(item.variant_id) : undefined,
      variantTitle: item.variant_title,
      quantity: Number(item.quantity || 0) > 0 ? Number(item.quantity) : 1,
    }))
    .filter((item) => item.productId.length > 0);

  return {
    cartId: raw.token || fallback.cartId,
    currencyCode: raw.currency || fallback.currencyCode,
    items,
    ...(typeof raw.total_price === "number" ? { subtotal: (raw.total_price / 100).toFixed(2) } : {}),
  };
}

/**
 * Builds a deterministic string key representing the cart's contents.
 * Used to detect whether guidance needs to be refreshed.
 */
export function buildCartSnapshotKey(cart: StorefrontCartSnapshot): string {
  const parts = [
    cart.cartId ?? "",
    cart.currencyCode,
    ...cart.items.map((item) =>
      [item.lineId ?? "", item.productId, item.variantId ?? "", String(item.quantity)].join("|"),
    ),
  ];
  return parts.join("::");
}

/**
 * Returns true when the snapshot is older than `staleWindowMs` milliseconds.
 */
export function isCartSnapshotStale(snapshot: CartSyncSnapshot, staleWindowMs: number): boolean {
  return Date.now() - snapshot.syncedAt > staleWindowMs;
}

/**
 * Builds a wrapped fetch function that intercepts Shopify cart mutation requests.
 * All request semantics (method, headers, body, credentials) are preserved.
 * `onCartMutation` is called only after a successful response (2xx).
 */
export function buildFetchInterceptor(
  originalFetch: typeof fetch,
  options: CartFetchInterceptorOptions,
): typeof fetch {
  return async function interceptedFetch(
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : (input as Request).url;
    const response = await originalFetch(input, init);

    if (isCartMutationUrl(url) && response.ok) {
      options.onCartMutation(url);
    }

    return response;
  };
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

const DEFAULT_POLL_INTERVAL_MS = 5_000;
const DEFAULT_MAX_POLL_COUNT = 20;
const DEFAULT_STALE_WINDOW_MS = 5_000;

export function useCartStateSync({
  initialCart,
  surface,
  onCartChanged,
  active,
  fetchImpl,
  pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
  maxPollCount = DEFAULT_MAX_POLL_COUNT,
  staleWindowMs = DEFAULT_STALE_WINDOW_MS,
}: UseCartStateSyncOptions) {
  const snapshotRef = useRef<CartSyncSnapshot>({
    cart: initialCart,
    syncedAt: Date.now(),
    syncSource: "initial_config",
  });
  const previousKeyRef = useRef<string>(buildCartSnapshotKey(initialCart));
  const pollCountRef = useRef(0);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [syncSource, setSyncSource] = useState<CartSyncSource>("initial_config");

  const resolveFetch = useCallback((): typeof fetch => {
    if (fetchImpl) return fetchImpl;
    if (typeof window !== "undefined" && window.fetch) return window.fetch.bind(window);
    return fetch;
  }, [fetchImpl]);

  const fetchCartJs = useCallback(async (source: CartSyncSource) => {
    const fetchFn = resolveFetch();
    try {
      const response = await fetchFn("/cart.js", {
        method: "GET",
        credentials: "same-origin",
      });
      if (!response.ok) return;
      const payload = await response.json().catch(() => null);
      const normalized = normalizeCartJsPayload(payload, snapshotRef.current.cart);
      const newKey = buildCartSnapshotKey(normalized);

      if (newKey !== previousKeyRef.current) {
        previousKeyRef.current = newKey;
        snapshotRef.current = { cart: normalized, syncedAt: Date.now(), syncSource: source };
        setSyncSource(source);
        onCartChanged(normalized, source);
      }
    } catch {
      // Network failure — keep current snapshot
    }
  }, [resolveFetch, onCartChanged]);

  // ---- Fetch interception ------------------------------------------------
  useEffect(() => {
    if (!active || typeof window === "undefined") return;

    const originalFetch = window.fetch.bind(window);
    window.fetch = buildFetchInterceptor(originalFetch, {
      onCartMutation: (_url) => {
        void fetchCartJs("fetch_intercept");
      },
    });

    return () => {
      window.fetch = originalFetch;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  // ---- Bounded fallback polling ------------------------------------------
  useEffect(() => {
    if (!active) {
      if (pollTimerRef.current !== null) {
        clearTimeout(pollTimerRef.current);
        pollTimerRef.current = null;
      }
      pollCountRef.current = 0;
      return;
    }

    const scheduleNextPoll = () => {
      if (pollCountRef.current >= maxPollCount) return;

      pollTimerRef.current = setTimeout(async () => {
        pollCountRef.current += 1;

        if (isCartSnapshotStale(snapshotRef.current, staleWindowMs)) {
          await fetchCartJs("fallback_poll");
        }

        scheduleNextPoll();
      }, pollIntervalMs);
    };

    scheduleNextPoll();

    return () => {
      if (pollTimerRef.current !== null) {
        clearTimeout(pollTimerRef.current);
        pollTimerRef.current = null;
      }
      pollCountRef.current = 0;
    };
  }, [active, fetchCartJs, maxPollCount, pollIntervalMs, staleWindowMs]);

  return {
    currentSnapshot: snapshotRef.current,
    lastSyncSource: syncSource,
    /** Call this when the MutationObserver detects a structural DOM change */
    syncFromMutation: () => {
      void fetchCartJs("mutation_observer");
    },
  };
}
