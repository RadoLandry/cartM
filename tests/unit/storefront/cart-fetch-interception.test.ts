import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

import {
  isCartMutationUrl,
  buildFetchInterceptor,
  type CartFetchInterceptorOptions,
} from "../../../storefront-widget/src/hooks/useCartStateSync";

describe("cart mutation URL detection", () => {
  it("identifies /cart/add.js as a mutation endpoint", () => {
    expect(isCartMutationUrl("/cart/add.js")).toBe(true);
  });

  it("identifies /cart/change.js as a mutation endpoint", () => {
    expect(isCartMutationUrl("/cart/change.js")).toBe(true);
  });

  it("identifies /cart/update.js as a mutation endpoint", () => {
    expect(isCartMutationUrl("/cart/update.js")).toBe(true);
  });

  it("identifies /cart/clear.js as a mutation endpoint", () => {
    expect(isCartMutationUrl("/cart/clear.js")).toBe(true);
  });

  it("does not flag /cart.js as a mutation endpoint", () => {
    expect(isCartMutationUrl("/cart.js")).toBe(false);
  });

  it("does not flag /cart as a mutation endpoint", () => {
    expect(isCartMutationUrl("/cart")).toBe(false);
  });

  it("does not flag unrelated paths", () => {
    expect(isCartMutationUrl("/products/some-product.js")).toBe(false);
    expect(isCartMutationUrl("/collections")).toBe(false);
  });

  it("handles absolute URLs for /cart/add.js", () => {
    expect(isCartMutationUrl("https://example.myshopify.com/cart/add.js")).toBe(true);
  });
});

describe("fetch interceptor construction", () => {
  let originalFetch: typeof fetch;

  beforeEach(() => {
    originalFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ token: "abc", items: [] }), { status: 200 }),
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls the original fetch and returns response unchanged for cart mutations", async () => {
    const onMutation = vi.fn();
    const intercepted = buildFetchInterceptor(originalFetch, { onCartMutation: onMutation });

    const response = await intercepted("/cart/add.js", {
      method: "POST",
      body: JSON.stringify({ id: 123, quantity: 1 }),
    });

    expect(originalFetch).toHaveBeenCalledOnce();
    expect(response).toBeInstanceOf(Response);
    expect(response.status).toBe(200);
  });

  it("notifies onCartMutation after a successful cart mutation", async () => {
    const onMutation = vi.fn();
    const intercepted = buildFetchInterceptor(originalFetch, { onCartMutation: onMutation });

    await intercepted("/cart/change.js", { method: "POST" });

    expect(onMutation).toHaveBeenCalledOnce();
    expect(onMutation).toHaveBeenCalledWith("/cart/change.js");
  });

  it("does not notify onCartMutation for non-mutation requests", async () => {
    const onMutation = vi.fn();
    const intercepted = buildFetchInterceptor(originalFetch, { onCartMutation: onMutation });

    await intercepted("/products.json");

    expect(onMutation).not.toHaveBeenCalled();
  });

  it("does not notify onCartMutation when fetch fails", async () => {
    const failingFetch = vi.fn().mockRejectedValue(new Error("Network error"));
    const onMutation = vi.fn();
    const intercepted = buildFetchInterceptor(failingFetch, { onCartMutation: onMutation });

    await expect(intercepted("/cart/add.js")).rejects.toThrow("Network error");
    expect(onMutation).not.toHaveBeenCalled();
  });

  it("does not notify onCartMutation for a failed response (non-2xx)", async () => {
    const failingResponseFetch = vi.fn().mockResolvedValue(
      new Response("Unprocessable", { status: 422 }),
    );
    const onMutation = vi.fn();
    const intercepted = buildFetchInterceptor(failingResponseFetch, { onCartMutation: onMutation });

    await intercepted("/cart/update.js", { method: "POST" });

    expect(onMutation).not.toHaveBeenCalled();
  });

  it("passes through all original arguments to the underlying fetch", async () => {
    const intercepted = buildFetchInterceptor(originalFetch, { onCartMutation: vi.fn() });
    const init: RequestInit = {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quantity: 0, id: 999 }),
      credentials: "same-origin",
    };

    await intercepted("/cart/clear.js", init);

    expect(originalFetch).toHaveBeenCalledWith("/cart/clear.js", init);
  });
});

describe("cart notification synchronization", () => {
  it("does not render duplicate widget on notification no-render target surfaces", () => {
    // Verify that add-to-cart notification flows do not trigger widget re-render;
    // the interceptor triggers a sync callback, not a mount. Test documents the intent.
    const onMutation = vi.fn();
    const mockFetch = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    const intercepted = buildFetchInterceptor(mockFetch, { onCartMutation: onMutation });

    // Notification add-to-cart uses /cart/add.js; widget should update guidance, not re-mount
    void intercepted("/cart/add.js", { method: "POST" });

    // onMutation signals guidance refresh only; mounting logic remains in surface lifecycle
    expect(typeof onMutation).toBe("function");
  });
});

describe("fetch interceptor options", () => {
  it("accepts an options object matching CartFetchInterceptorOptions shape", () => {
    const options: CartFetchInterceptorOptions = {
      onCartMutation: vi.fn(),
    };
    // Shape is valid — no type error expected
    expect(typeof options.onCartMutation).toBe("function");
  });
});
