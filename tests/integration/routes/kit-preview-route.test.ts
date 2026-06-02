import { beforeEach, describe, expect, it } from "vitest";
import { action } from "../../../app/routes/api.ai.kit-preview";
import { clearPreviewCache } from "../../../app/lib/visual/compositor";

import {
  makeEmptyKitPreviewFixture,
  makeKitPreviewCartFixture,
  makeKitPreviewFixtureWithMissingImage,
  makeMixedDisciplineKitPreviewFixture,
} from "../../helpers/kit-preview-fixtures";
import {
  assertLatencyUnderThreshold,
  assertReuseFasterThanFirstRender,
} from "../../helpers/kit-preview-performance";

describe("kit preview route", () => {
  beforeEach(() => {
    clearPreviewCache();
  });

  it("has fixture coverage for composed preview happy path", () => {
    const fixture = makeKitPreviewCartFixture();

    expect(fixture.items.length).toBeGreaterThan(0);
    expect(fixture.currencyCode).toBe("USD");
  });

  it("has fixture coverage for mixed-discipline fallback path", () => {
    const mixed = makeMixedDisciplineKitPreviewFixture();

    const disciplineSet = new Set(mixed.items.map((item) => item.discipline));
    expect(disciplineSet.size).toBeGreaterThan(1);
  });

  it("has fixture coverage for empty cart fallback path", () => {
    const empty = makeEmptyKitPreviewFixture();

    expect(empty.items).toHaveLength(0);
  });

  it("returns composed preview payload for eligible cart items", async () => {
    const cart = makeKitPreviewCartFixture();

    const response = await action({
      request: new Request("http://localhost/api/ai/kit-preview", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          shop: "test.myshopify.com",
          sessionId: "session-1",
          cartId: cart.cartId,
          surface: "cart_drawer",
          currencyCode: cart.currencyCode,
          cart: {
            items: cart.items,
          },
        }),
      }),
      params: {},
      context: {},
    } as never);

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.ok).toBe(true);
    expect(payload.status).toBe("ok");
    expect(payload.preview.assetUrl).toContain("/api/ai/kit-preview/assets/");
    expect(payload.preview.reused).toBe(false);
    expect(payload.context.layoutId).toBe("boxing-default");
  });

  it("reuses cached preview for unchanged cart signatures and regenerates after cart updates", async () => {
    const cart = makeKitPreviewCartFixture();
    const requestPayload = {
      shop: "test.myshopify.com",
      sessionId: "session-2",
      cartId: cart.cartId,
      surface: "cart_drawer",
      currencyCode: cart.currencyCode,
      cart: {
        items: cart.items,
      },
    };

    const firstResponse = await action({
      request: new Request("http://localhost/api/ai/kit-preview", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(requestPayload),
      }),
      params: {},
      context: {},
    } as never);

    const secondResponse = await action({
      request: new Request("http://localhost/api/ai/kit-preview", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(requestPayload),
      }),
      params: {},
      context: {},
    } as never);

    const firstPayload = await firstResponse.json();
    const secondPayload = await secondResponse.json();

    expect(firstPayload.preview.reused).toBe(false);
    expect(secondPayload.preview.reused).toBe(true);

    const updatedCart = {
      ...requestPayload,
      cart: {
        items: requestPayload.cart.items.map((item) => (
          item.lineId === "line_1"
            ? {
                ...item,
                quantity: 2,
              }
            : item
        )),
      },
    };

    const thirdResponse = await action({
      request: new Request("http://localhost/api/ai/kit-preview", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(updatedCart),
      }),
      params: {},
      context: {},
    } as never);

    const thirdPayload = await thirdResponse.json();
    expect(thirdPayload.preview.reused).toBe(false);
  });

  it("returns mixed layout context for multi-discipline carts", async () => {
    const mixed = makeMixedDisciplineKitPreviewFixture();

    const response = await action({
      request: new Request("http://localhost/api/ai/kit-preview", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          shop: "test.myshopify.com",
          sessionId: "session-mixed",
          cartId: mixed.cartId,
          surface: "cart_drawer",
          currencyCode: mixed.currencyCode,
          cart: {
            items: mixed.items,
          },
        }),
      }),
      params: {},
      context: {},
    } as never);

    const payload = await response.json();

    expect(payload.status).toBe("ok");
    expect(payload.context.layoutId).toBe("mixed-neutral");
    expect(payload.context.inferredDiscipline).toBeNull();
  });

  it("returns partial result and omissions when one cart item lacks imagery", async () => {
    const fixture = makeKitPreviewFixtureWithMissingImage();

    const response = await action({
      request: new Request("http://localhost/api/ai/kit-preview", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          shop: "test.myshopify.com",
          sessionId: "session-missing-image",
          cartId: fixture.cartId,
          surface: "cart_drawer",
          currencyCode: fixture.currencyCode,
          cart: {
            items: fixture.items,
          },
        }),
      }),
      params: {},
      context: {},
    } as never);

    const payload = await response.json();
    expect(payload.status).toBe("partial");
    expect(payload.omissions.length).toBeGreaterThan(0);
    expect(payload.omissions[0].reasonCode).toBe("missing_image");
  });

  it("keeps first-render and reuse latencies within expected thresholds", async () => {
    const cart = makeKitPreviewCartFixture();
    const requestPayload = {
      shop: "test.myshopify.com",
      sessionId: "session-performance",
      cartId: cart.cartId,
      surface: "cart_drawer",
      currencyCode: cart.currencyCode,
      cart: {
        items: cart.items,
      },
    };

    const firstResponse = await action({
      request: new Request("http://localhost/api/ai/kit-preview", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(requestPayload),
      }),
      params: {},
      context: {},
    } as never);

    const secondResponse = await action({
      request: new Request("http://localhost/api/ai/kit-preview", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(requestPayload),
      }),
      params: {},
      context: {},
    } as never);

    const firstPayload = await firstResponse.json();
    const secondPayload = await secondResponse.json();

    assertLatencyUnderThreshold(
      {
        label: "first-render",
        durationMs: firstPayload.diagnostics.generationMs ?? 0,
      },
      2000,
    );

    expect(secondPayload.preview.reused).toBe(true);
    if (typeof secondPayload.diagnostics.generationMs === "number") {
      assertReuseFasterThanFirstRender(
        firstPayload.diagnostics.generationMs ?? 0,
        secondPayload.diagnostics.generationMs,
      );
    } else {
      expect(secondPayload.diagnostics.generationMs).toBeNull();
    }
  });
});
