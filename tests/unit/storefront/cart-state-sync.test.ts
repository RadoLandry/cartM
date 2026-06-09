import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

import type { StorefrontCartSnapshot } from "../../../storefront-widget/src/types";
import {
  normalizeCartJsPayload,
  buildCartSnapshotKey,
  isCartSnapshotStale,
  type CartSyncSnapshot,
} from "../../../storefront-widget/src/hooks/useCartStateSync";

describe("cart snapshot normalization from /cart.js payloads", () => {
  it("maps valid /cart.js payload to StorefrontCartSnapshot", () => {
    const cartJsPayload = {
      token: "abc-token-123",
      currency: "USD",
      items: [
        {
          key: "line-key-1",
          product_id: 100,
          product_title: "Training Gloves",
          variant_id: 200,
          variant_title: "12 oz / Black",
          quantity: 1,
        },
      ],
    };

    const result = normalizeCartJsPayload(cartJsPayload, {
      currencyCode: "USD",
      items: [],
    });

    expect(result).toMatchObject({
      cartId: "abc-token-123",
      currencyCode: "USD",
      items: [
        {
          lineId: "line-key-1",
          productId: "100",
          productTitle: "Training Gloves",
          variantId: "200",
          variantTitle: "12 oz / Black",
          quantity: 1,
        },
      ],
    });
  });

  it("falls back to config snapshot when /cart.js items is not an array", () => {
    const fallback: StorefrontCartSnapshot = {
      cartId: "fallback-id",
      currencyCode: "USD",
      items: [{ productId: "gid://shopify/Product/1", quantity: 1 }],
    };

    const result = normalizeCartJsPayload({ token: "t", currency: "USD", items: null }, fallback);
    expect(result).toBe(fallback);
  });

  it("falls back to config snapshot when payload is null", () => {
    const fallback: StorefrontCartSnapshot = { currencyCode: "USD", items: [] };
    expect(normalizeCartJsPayload(null, fallback)).toBe(fallback);
  });

  it("filters out items with no product_id", () => {
    const cartJsPayload = {
      token: "tok",
      currency: "USD",
      items: [
        { key: "k1", product_id: 100, quantity: 1 },
        { key: "k2", product_id: 0, quantity: 1 },
        { key: "k3", quantity: 1 },
      ],
    };
    const fallback: StorefrontCartSnapshot = { currencyCode: "USD", items: [] };
    const result = normalizeCartJsPayload(cartJsPayload, fallback);
    expect(result.items).toHaveLength(1);
    expect(result.items[0].productId).toBe("100");
  });

  it("uses config currencyCode when payload currency is missing", () => {
    const fallback: StorefrontCartSnapshot = { currencyCode: "EUR", items: [] };
    const result = normalizeCartJsPayload({ token: "t", items: [] }, fallback);
    expect(result.currencyCode).toBe("EUR");
  });

  it("defaults quantity to 1 when item quantity is falsy", () => {
    const fallback: StorefrontCartSnapshot = { currencyCode: "USD", items: [] };
    const result = normalizeCartJsPayload({
      token: "t",
      currency: "USD",
      items: [{ key: "k1", product_id: 111, quantity: 0 }],
    }, fallback);
    expect(result.items[0].quantity).toBe(1);
  });
});

describe("cart snapshot staleness detection", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("considers snapshot fresh when synced within staleness window", () => {
    vi.setSystemTime(new Date("2026-06-01T00:00:00Z"));
    const snapshot: CartSyncSnapshot = {
      cart: { currencyCode: "USD", items: [] },
      syncedAt: Date.now(),
      syncSource: "cart_js",
    };

    vi.advanceTimersByTime(4000);
    expect(isCartSnapshotStale(snapshot, 5000)).toBe(false);
  });

  it("considers snapshot stale when older than staleness window", () => {
    vi.setSystemTime(new Date("2026-06-01T00:00:00Z"));
    const snapshot: CartSyncSnapshot = {
      cart: { currencyCode: "USD", items: [] },
      syncedAt: Date.now(),
      syncSource: "cart_js",
    };

    vi.advanceTimersByTime(6000);
    expect(isCartSnapshotStale(snapshot, 5000)).toBe(true);
  });
});

describe("cart snapshot key generation", () => {
  it("generates a deterministic key for identical cart contents", () => {
    const a: StorefrontCartSnapshot = {
      cartId: "tok",
      currencyCode: "USD",
      items: [{ lineId: "k1", productId: "100", quantity: 2 }],
    };
    const b: StorefrontCartSnapshot = {
      cartId: "tok",
      currencyCode: "USD",
      items: [{ lineId: "k1", productId: "100", quantity: 2 }],
    };
    expect(buildCartSnapshotKey(a)).toBe(buildCartSnapshotKey(b));
  });

  it("generates different keys for carts with different item quantities", () => {
    const a: StorefrontCartSnapshot = {
      currencyCode: "USD",
      items: [{ lineId: "k1", productId: "100", quantity: 1 }],
    };
    const b: StorefrontCartSnapshot = {
      currencyCode: "USD",
      items: [{ lineId: "k1", productId: "100", quantity: 2 }],
    };
    expect(buildCartSnapshotKey(a)).not.toBe(buildCartSnapshotKey(b));
  });

  it("generates different keys for carts with different line counts", () => {
    const a: StorefrontCartSnapshot = {
      currencyCode: "USD",
      items: [{ productId: "100", quantity: 1 }],
    };
    const b: StorefrontCartSnapshot = {
      currencyCode: "USD",
      items: [
        { productId: "100", quantity: 1 },
        { productId: "200", quantity: 1 },
      ],
    };
    expect(buildCartSnapshotKey(a)).not.toBe(buildCartSnapshotKey(b));
  });

  it("generates a key for an empty cart", () => {
    const empty: StorefrontCartSnapshot = { currencyCode: "USD", items: [] };
    expect(buildCartSnapshotKey(empty)).toBeTruthy();
  });
});
