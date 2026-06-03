import { describe, expect, it } from "vitest";

import {
  buildIntegrationHealthEvent,
  buildWidgetFailedEvent,
  buildWidgetRenderedEvent,
  sanitizeIntegrationEventDetails,
} from "../../../app/lib/analytics/cart-events";

describe("storefront integration health events", () => {
  it("builds widget rendered events with bounded diagnostic details", () => {
    const event = buildWidgetRenderedEvent({
      shop: "test.myshopify.com",
      surface: "cart_drawer",
      sessionId: "session-1",
      placementId: "drawer",
    });

    expect(event).toMatchObject({
      shop: "test.myshopify.com",
      eventType: "widget_rendered",
      surface: "cart_drawer",
      details: { placementId: "drawer" },
    });
  });

  it("sanitizes sensitive detail keys", () => {
    expect(sanitizeIntegrationEventDetails({
      placementId: "drawer",
      accessToken: "secret",
      nested: { nope: true },
    })).toEqual({ placementId: "drawer" });
  });

  it("builds fallback and failure event types without shopper blocking data", () => {
    const failed = buildWidgetFailedEvent({
      shop: "test.myshopify.com",
      surface: "cart_page",
      reason: "render_error",
    });
    const fallback = buildIntegrationHealthEvent({
      shop: "test.myshopify.com",
      surface: "cart_drawer",
      eventType: "fallback_used",
      details: { reason: "guidance_unavailable" },
    });

    expect(failed.eventType).toBe("widget_failed");
    expect(fallback.eventType).toBe("fallback_used");
  });
});