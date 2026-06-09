import { describe, expect, it } from "vitest";

import {
  buildCartSyncCompletedEvent,
  buildCartSyncFailedEvent,
  buildCartSyncStartedEvent,
  buildGuidanceImpressedEvent,
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

describe("US2 cart synchronization health events", () => {
  it("builds cart_sync_started event with syncSource in details", () => {
    const event = buildCartSyncStartedEvent({
      shop: "test.myshopify.com",
      surface: "cart_drawer",
      syncSource: "fetch_intercept",
      sessionId: "session-2",
    });

    expect(event).toMatchObject({
      shop: "test.myshopify.com",
      eventType: "cart_sync_started",
      surface: "cart_drawer",
      details: { syncSource: "fetch_intercept" },
    });
    expect(event.sessionId).toBe("session-2");
  });

  it("builds cart_sync_completed event with syncSource and itemCount", () => {
    const event = buildCartSyncCompletedEvent({
      shop: "test.myshopify.com",
      surface: "cart_page",
      syncSource: "mutation_observer",
      itemCount: 3,
      sessionId: "session-3",
    });

    expect(event).toMatchObject({
      eventType: "cart_sync_completed",
      surface: "cart_page",
      details: { syncSource: "mutation_observer", itemCount: 3 },
    });
  });

  it("builds cart_sync_failed event with syncSource and reason", () => {
    const event = buildCartSyncFailedEvent({
      shop: "test.myshopify.com",
      surface: "cart_drawer",
      syncSource: "fallback_poll",
      reason: "network_error",
    });

    expect(event).toMatchObject({
      eventType: "cart_sync_failed",
      details: { syncSource: "fallback_poll", reason: "network_error" },
    });
  });

  it("builds guidance_impressed event with payload metadata", () => {
    const event = buildGuidanceImpressedEvent({
      shop: "test.myshopify.com",
      surface: "cart_drawer",
      payloadId: "payload-abc",
      recommendationCount: 2,
      hasKitCompleteness: true,
      sizeWarningCount: 1,
      sessionId: "session-4",
    });

    expect(event).toMatchObject({
      eventType: "guidance_impressed",
      details: {
        payloadId: "payload-abc",
        recommendationCount: 2,
        hasKitCompleteness: true,
        sizeWarningCount: 1,
      },
    });
    expect(event.sessionId).toBe("session-4");
  });

  it("does not expose cartToken in sanitized event details", () => {
    const event = buildCartSyncStartedEvent({
      shop: "test.myshopify.com",
      surface: "cart_drawer",
      syncSource: "cart_js",
      cartToken: "sensitive-token",
    });

    // cartToken is a top-level field, not inside details — should not leak into details
    expect(Object.values(event.details)).not.toContain("sensitive-token");
    expect(event.cartToken).toBe("sensitive-token");
  });
});