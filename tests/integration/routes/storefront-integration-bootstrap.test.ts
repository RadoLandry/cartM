import { describe, expect, it } from "vitest";

import { StorefrontGuidanceRequestSchema, StorefrontWidgetMountConfigSchema } from "../../../app/lib/ai/schemas";
import {
  buildDegradedStorefrontGuidancePayload,
  buildStorefrontGuidancePayload,
  buildStorefrontWidgetMountConfig,
  normalizeStorefrontCartSnapshot,
} from "../../../app/lib/shopify/storefront-integration";
import { makeStorefrontWidgetMountConfig } from "../../helpers/storefront-integration-fixtures";

describe("storefront integration bootstrap contracts", () => {
  it("validates widget mount configuration for cart drawer and cart page surfaces", () => {
    const drawerConfig = makeStorefrontWidgetMountConfig();
    const pageConfig = makeStorefrontWidgetMountConfig({
      surface: "cart_page",
      placementId: "cartmind-cart-page",
    });

    expect(StorefrontWidgetMountConfigSchema.safeParse(drawerConfig).success).toBe(true);
    expect(StorefrontWidgetMountConfigSchema.safeParse(pageConfig).success).toBe(true);
  });

  it("rejects malformed guidance requests at the schema boundary", () => {
    const parsed = StorefrontGuidanceRequestSchema.safeParse({
      shop: "test.myshopify.com",
      surface: "cart_notification",
      placementId: "cartmind-notification",
      sessionId: "session-1",
      cart: { currencyCode: "USD", items: [] },
      syncSource: "initial_config",
      requestedAt: "2026-06-03T00:00:00.000Z",
    });

    expect(parsed.success).toBe(false);
  });

  it("normalizes cart snapshots and drops lines without product identifiers", () => {
    const snapshot = normalizeStorefrontCartSnapshot({
      token: "cart-token",
      currency: "USD",
      items: [
        { key: "line-1", product_id: 123, quantity: 2 },
        { key: "line-2", quantity: 1 },
      ],
    });

    expect(snapshot).toMatchObject({ cartId: "cart-token", currencyCode: "USD" });
    expect(snapshot.items).toHaveLength(1);
    expect(snapshot.items[0]).toMatchObject({ productId: "123", quantity: 2 });
  });

  it("builds safe guidance payloads and degraded fallbacks", () => {
    const guidance = buildStorefrontGuidancePayload({
      recommendations: [],
      sizeWarnings: [],
      chatEntry: { available: true, bootstrapPath: "/apps/cartmind-chat/chat-bootstrap" },
    });
    const degraded = buildDegradedStorefrontGuidancePayload({ cartId: "cart-token" });

    expect(guidance.payloadId).toMatch(/^guidance-/);
    expect(degraded).toMatchObject({
      cartId: "cart-token",
      chatEntry: { available: false, reasonUnavailable: "guidance_unavailable" },
    });
  });

  it("derives default labels and feature flags for app-proxy mount config", () => {
    const config = buildStorefrontWidgetMountConfig({
      shop: "test.myshopify.com",
      surface: "cart_drawer",
      placementId: "cartmind-drawer",
      appBaseUrl: "https://app.example.com",
      bootstrapUrl: "https://app.example.com/apps/cartmind-chat/chat-bootstrap",
      bootstrapPath: "/apps/cartmind-chat/chat-bootstrap",
      recommendationsPath: "/api/ai/recommendations",
      cart: { currencyCode: "USD", items: [] },
    });

    expect(config.labels.launcherLabel).toBe("Ask CartMind");
    expect(config.features.showChatEntry).toBe(true);
  });
});