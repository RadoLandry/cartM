import { describe, expect, it } from "vitest";

import { CheckoutGuidanceFeedSchema, CheckoutGuidanceItemSchema } from "../../../app/lib/ai/schemas";
import type { CheckoutGuidanceItem } from "../../../app/lib/ai/schemas";
import {
  buildCheckoutGuidanceFeed,
  buildEmptyCheckoutGuidanceFeed,
} from "../../../app/lib/shopify/storefront-integration";

const TEST_SHOP = "test.myshopify.com";
const BASE_FEED_INPUT = {
  shop: TEST_SHOP,
  projectionVersion: 1,
};

function makeSizeWarningItem(overrides: Partial<CheckoutGuidanceItem> = {}): CheckoutGuidanceItem {
  return CheckoutGuidanceItemSchema.parse({
    guidanceId: "size-warning-1",
    type: "size_warning",
    severity: "warning",
    priority: 0,
    title: "Check size compatibility",
    message: "Glove size 12 oz typically pairs with hand wrap size M, but L is selected.",
    relatedLineIds: ["line-1", "line-2"],
    ...overrides,
  });
}

function makeBundleOfferItem(overrides: Partial<CheckoutGuidanceItem> = {}): CheckoutGuidanceItem {
  return CheckoutGuidanceItemSchema.parse({
    guidanceId: "bundle-offer-1",
    type: "bundle_offer",
    severity: "info",
    priority: 1,
    title: "Complete your boxing kit",
    message: "Add a mouthguard to qualify for the 15% bundle discount.",
    relatedLineIds: ["line-1"],
    ...overrides,
  });
}

function makeKitNudgeItem(overrides: Partial<CheckoutGuidanceItem> = {}): CheckoutGuidanceItem {
  return CheckoutGuidanceItemSchema.parse({
    guidanceId: "kit-nudge-1",
    type: "kit_nudge",
    severity: "info",
    priority: 2,
    title: "Your kit is almost complete",
    message: "You're missing 2 items to complete your boxing kit.",
    relatedLineIds: [],
    ...overrides,
  });
}

describe("checkout guidance contract: schema validation", () => {
  it("accepts a valid checkout guidance feed", () => {
    const feed = buildCheckoutGuidanceFeed({
      ...BASE_FEED_INPUT,
      sizeWarningItems: [makeSizeWarningItem()],
    });

    const result = CheckoutGuidanceFeedSchema.safeParse(feed);
    expect(result.success).toBe(true);
  });

  it("rejects a feed with a missing required shop field", () => {
    const result = CheckoutGuidanceFeedSchema.safeParse({
      guidanceId: "g-1",
      generatedAt: new Date().toISOString(),
      placement: "purchase_checkout_block",
      items: [],
      projectionVersion: 1,
    });
    expect(result.success).toBe(false);
  });

  it("rejects a guidance item with an invalid type", () => {
    const result = CheckoutGuidanceItemSchema.safeParse({
      guidanceId: "bad-1",
      type: "unknown_type",
      severity: "info",
      priority: 0,
      title: "Bad item",
      message: "This should fail",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a guidance item with an invalid severity", () => {
    const result = CheckoutGuidanceItemSchema.safeParse({
      guidanceId: "bad-2",
      type: "size_warning",
      severity: "fatal",
      priority: 0,
      title: "Bad severity",
      message: "This should fail",
    });
    expect(result.success).toBe(false);
  });
});

describe("checkout guidance contract: size warning cart", () => {
  it("includes at least one size_warning item for size-conflict carts", () => {
    const feed = buildCheckoutGuidanceFeed({
      ...BASE_FEED_INPUT,
      sizeWarningItems: [makeSizeWarningItem()],
    });

    expect(feed.items.some((item) => item.type === "size_warning")).toBe(true);
  });

  it("renders size warnings before commercial guidance at equal severity", () => {
    const warning = makeSizeWarningItem({ severity: "info", priority: 1 });
    const offer = makeBundleOfferItem({ severity: "info", priority: 1 });

    const feed = buildCheckoutGuidanceFeed({
      ...BASE_FEED_INPUT,
      sizeWarningItems: [warning],
      bundleOfferItems: [offer],
    });

    const types = feed.items.map((item) => item.type);
    expect(types.indexOf("size_warning")).toBeLessThan(types.indexOf("bundle_offer"));
  });

  it("places critical size warnings before warning-severity offers", () => {
    const critical = makeSizeWarningItem({ severity: "critical", priority: 10 });
    const offer = makeBundleOfferItem({ severity: "warning", priority: 0 });

    const feed = buildCheckoutGuidanceFeed({
      ...BASE_FEED_INPUT,
      sizeWarningItems: [critical],
      bundleOfferItems: [offer],
    });

    expect(feed.items[0].type).toBe("size_warning");
  });
});

describe("checkout guidance contract: bundle offer cart", () => {
  it("includes at least one bundle_offer item for bundle opportunity carts", () => {
    const feed = buildCheckoutGuidanceFeed({
      ...BASE_FEED_INPUT,
      bundleOfferItems: [makeBundleOfferItem()],
    });

    expect(feed.items.some((item) => item.type === "bundle_offer")).toBe(true);
  });
});

describe("checkout guidance contract: no-guidance cart", () => {
  it("returns an empty items array for carts with no guidance", () => {
    const feed = buildEmptyCheckoutGuidanceFeed(BASE_FEED_INPUT);
    expect(feed.items).toHaveLength(0);
  });

  it("returns a valid feed structure even when items are empty", () => {
    const feed = buildEmptyCheckoutGuidanceFeed(BASE_FEED_INPUT);
    const result = CheckoutGuidanceFeedSchema.safeParse(feed);
    expect(result.success).toBe(true);
  });
});

describe("checkout guidance contract: mixed cart priority ordering", () => {
  it("orders critical before warning before info across types", () => {
    const criticalWarning = makeSizeWarningItem({ severity: "critical", guidanceId: "sw-crit", priority: 5 });
    const warnOffer = makeBundleOfferItem({ severity: "warning", guidanceId: "bo-warn", priority: 0 });
    const infoNudge = makeKitNudgeItem({ severity: "info", guidanceId: "kn-info", priority: 0 });

    const feed = buildCheckoutGuidanceFeed({
      ...BASE_FEED_INPUT,
      sizeWarningItems: [criticalWarning],
      bundleOfferItems: [warnOffer],
      kitNudgeItems: [infoNudge],
    });

    const severities = feed.items.map((item) => item.severity);
    expect(severities[0]).toBe("critical");
    expect(severities[1]).toBe("warning");
    expect(severities[2]).toBe("info");
  });
});

describe("checkout guidance contract: expired items", () => {
  it("excludes expired guidance items from the feed", () => {
    const pastDate = new Date(Date.now() - 10_000).toISOString();
    const expiredItem = makeSizeWarningItem({ expiresAt: pastDate, guidanceId: "sw-expired" });
    const validItem = makeBundleOfferItem({ guidanceId: "bo-valid" });

    const feed = buildCheckoutGuidanceFeed({
      ...BASE_FEED_INPUT,
      sizeWarningItems: [expiredItem],
      bundleOfferItems: [validItem],
    });

    expect(feed.items.every((item) => item.guidanceId !== "sw-expired")).toBe(true);
    expect(feed.items.some((item) => item.guidanceId === "bo-valid")).toBe(true);
  });

  it("returns empty feed when all items are expired", () => {
    const pastDate = new Date(Date.now() - 10_000).toISOString();
    const feed = buildCheckoutGuidanceFeed({
      ...BASE_FEED_INPUT,
      sizeWarningItems: [makeSizeWarningItem({ expiresAt: pastDate })],
    });

    expect(feed.items).toHaveLength(0);
  });
});

describe("checkout guidance contract: invalid payload rejection", () => {
  it("rejects a feed with a non-integer projectionVersion", () => {
    const result = CheckoutGuidanceFeedSchema.safeParse({
      shop: TEST_SHOP,
      guidanceId: "g-1",
      generatedAt: new Date().toISOString(),
      placement: "purchase_checkout_block",
      items: [],
      projectionVersion: 1.5,
    });
    expect(result.success).toBe(false);
  });

  it("rejects a feed with an unknown placement value", () => {
    const result = CheckoutGuidanceFeedSchema.safeParse({
      shop: TEST_SHOP,
      guidanceId: "g-1",
      generatedAt: new Date().toISOString(),
      placement: "unsupported_placement",
      items: [],
      projectionVersion: 1,
    });
    expect(result.success).toBe(false);
  });
});
