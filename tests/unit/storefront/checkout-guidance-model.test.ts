import { describe, expect, it } from "vitest";

import { CheckoutGuidanceFeedSchema, CheckoutGuidanceItemSchema } from "../../../app/lib/ai/schemas";
import type { CheckoutGuidanceItem } from "../../../app/lib/ai/schemas";
import {
  buildCheckoutGuidanceFeed,
  buildEmptyCheckoutGuidanceFeed,
} from "../../../app/lib/shopify/storefront-integration";
import {
  mapSizeConflictsToCheckoutWarningSummaries,
} from "../../../app/lib/cart-intelligence/size-conflicts";
import type { SizeConflictResult } from "../../../app/lib/cart-intelligence/size-conflicts";

const TEST_SHOP = "test.myshopify.com";

function makeConflict(severity: "ERROR" | "WARNING", confidence: number) {
  return {
    conflictKey: `mapped_size_mismatch:variant-a:variant-b`,
    severity,
    reasonType: "mapped_size_mismatch" as const,
    itemA: {
      productId: "gid://shopify/Product/1",
      variantId: "variant-a",
      categoryTag: "boxing_gloves",
      selectedSize: "12 oz",
    },
    itemB: {
      productId: "gid://shopify/Product/2",
      variantId: "variant-b",
      categoryTag: "hand_wraps",
      selectedSize: "L",
      expectedSize: "M",
    },
    message: "Boxing gloves 12 oz typically pairs with hand wraps M, but L is selected.",
    suggestions: [
      {
        targetItem: "itemB" as const,
        currentVariantId: "variant-b",
        currentSize: "L",
        suggestedSize: "M",
        availability: "unknown" as const,
        confidence,
        reason: "Standard pairing.",
      },
    ],
    suggestedCorrection: "Change hand wraps to M.",
  };
}

function makeConflictResult(overrides: Partial<SizeConflictResult> = {}): SizeConflictResult {
  return {
    conflicts: [],
    hasErrors: false,
    hasWarnings: false,
    summary: { total: 0, errorCount: 0, warningCount: 0 },
    ...overrides,
  };
}

describe("checkout guidance model: empty feed", () => {
  it("returns an empty items array for an empty guidance feed", () => {
    const feed = buildEmptyCheckoutGuidanceFeed({ shop: TEST_SHOP, projectionVersion: 1 });
    expect(feed.items).toHaveLength(0);
  });

  it("produces a valid feed with all required fields even when empty", () => {
    const feed = buildEmptyCheckoutGuidanceFeed({ shop: TEST_SHOP, projectionVersion: 1 });
    expect(feed.shop).toBe(TEST_SHOP);
    expect(typeof feed.guidanceId).toBe("string");
    expect(feed.guidanceId.length).toBeGreaterThan(0);
    expect(feed.projectionVersion).toBe(1);
    const parsed = CheckoutGuidanceFeedSchema.safeParse(feed);
    expect(parsed.success).toBe(true);
  });
});

describe("checkout guidance model: expired items filtering", () => {
  it("drops items where expiresAt is in the past", () => {
    const pastDate = new Date(Date.now() - 5_000).toISOString();
    const expiredItem = CheckoutGuidanceItemSchema.parse({
      guidanceId: "expired-item",
      type: "size_warning",
      severity: "warning",
      priority: 0,
      title: "Old warning",
      message: "This warning has expired.",
      expiresAt: pastDate,
    });

    const feed = buildCheckoutGuidanceFeed({
      shop: TEST_SHOP,
      projectionVersion: 1,
      sizeWarningItems: [expiredItem],
    });

    expect(feed.items).toHaveLength(0);
  });

  it("keeps items where expiresAt is in the future", () => {
    const futureDate = new Date(Date.now() + 60_000).toISOString();
    const freshItem = CheckoutGuidanceItemSchema.parse({
      guidanceId: "fresh-item",
      type: "size_warning",
      severity: "warning",
      priority: 0,
      title: "Current warning",
      message: "This warning is still valid.",
      expiresAt: futureDate,
    });

    const feed = buildCheckoutGuidanceFeed({
      shop: TEST_SHOP,
      projectionVersion: 1,
      sizeWarningItems: [freshItem],
    });

    expect(feed.items).toHaveLength(1);
  });

  it("keeps items without an expiresAt field", () => {
    const item = CheckoutGuidanceItemSchema.parse({
      guidanceId: "no-expiry",
      type: "kit_nudge",
      severity: "info",
      priority: 0,
      title: "Kit nudge",
      message: "You're almost there.",
    });

    const feed = buildCheckoutGuidanceFeed({
      shop: TEST_SHOP,
      projectionVersion: 1,
      kitNudgeItems: [item],
    });

    expect(feed.items).toHaveLength(1);
  });
});

describe("checkout guidance model: missing line ID handling", () => {
  it("accepts items with empty relatedLineIds without error", () => {
    const item = CheckoutGuidanceItemSchema.parse({
      guidanceId: "g-1",
      type: "bundle_offer",
      severity: "info",
      priority: 0,
      title: "Bundle offer",
      message: "Save by completing your kit.",
      relatedLineIds: [],
    });

    const feed = buildCheckoutGuidanceFeed({
      shop: TEST_SHOP,
      projectionVersion: 1,
      bundleOfferItems: [item],
    });

    expect(feed.items[0].relatedLineIds).toHaveLength(0);
  });

  it("preserves relatedLineIds when present", () => {
    const item = CheckoutGuidanceItemSchema.parse({
      guidanceId: "g-2",
      type: "size_warning",
      severity: "warning",
      priority: 0,
      title: "Size warning",
      message: "Check your sizes.",
      relatedLineIds: ["line-abc", "line-def"],
    });

    const feed = buildCheckoutGuidanceFeed({
      shop: TEST_SHOP,
      projectionVersion: 1,
      sizeWarningItems: [item],
    });

    expect(feed.items[0].relatedLineIds).toEqual(["line-abc", "line-def"]);
  });
});

describe("checkout guidance model: projection version rejection", () => {
  it("rejects a projection version below zero", () => {
    const result = CheckoutGuidanceFeedSchema.safeParse({
      shop: TEST_SHOP,
      guidanceId: "g-1",
      generatedAt: new Date().toISOString(),
      placement: "purchase_checkout_block",
      items: [],
      projectionVersion: -1,
    });
    expect(result.success).toBe(false);
  });

  it("accepts projection version zero", () => {
    const feed = buildEmptyCheckoutGuidanceFeed({ shop: TEST_SHOP, projectionVersion: 0 });
    const result = CheckoutGuidanceFeedSchema.safeParse(feed);
    expect(result.success).toBe(true);
  });
});

describe("checkout guidance model: size conflict mapping", () => {
  it("maps ERROR conflicts to critical checkout warnings", () => {
    const conflict = makeConflict("ERROR", 0.95);
    const result = makeConflictResult({
      conflicts: [conflict],
      hasErrors: true,
      summary: { total: 1, errorCount: 1, warningCount: 0 },
    });

    const summaries = mapSizeConflictsToCheckoutWarningSummaries(result);
    expect(summaries).toHaveLength(1);
    expect(summaries[0].severity).toBe("critical");
    expect(summaries[0].guidanceId).toContain("checkout-size-warning:");
  });

  it("maps high-confidence WARNING conflicts to warning-level checkout summaries", () => {
    const conflict = makeConflict("WARNING", 0.85);
    const result = makeConflictResult({
      conflicts: [conflict],
      hasWarnings: true,
      summary: { total: 1, errorCount: 0, warningCount: 1 },
    });

    const summaries = mapSizeConflictsToCheckoutWarningSummaries(result);
    expect(summaries).toHaveLength(1);
    expect(summaries[0].severity).toBe("warning");
  });

  it("excludes low-confidence WARNING conflicts from checkout summaries", () => {
    const conflict = makeConflict("WARNING", 0.5);
    const result = makeConflictResult({
      conflicts: [conflict],
      hasWarnings: true,
      summary: { total: 1, errorCount: 0, warningCount: 1 },
    });

    const summaries = mapSizeConflictsToCheckoutWarningSummaries(result);
    expect(summaries).toHaveLength(0);
  });

  it("returns empty array for a conflict result with no conflicts", () => {
    const result = makeConflictResult();
    const summaries = mapSizeConflictsToCheckoutWarningSummaries(result);
    expect(summaries).toHaveLength(0);
  });

  it("populates relatedLineIds from the lineIdMap when provided", () => {
    const conflict = makeConflict("ERROR", 0.95);
    const result = makeConflictResult({
      conflicts: [conflict],
      hasErrors: true,
      summary: { total: 1, errorCount: 1, warningCount: 0 },
    });
    const lineIdMap: Record<string, string[]> = {
      "variant-a": ["line-001"],
      "variant-b": ["line-002"],
    };

    const summaries = mapSizeConflictsToCheckoutWarningSummaries(result, lineIdMap);
    expect(summaries[0].relatedLineIds).toContain("line-001");
    expect(summaries[0].relatedLineIds).toContain("line-002");
  });

  it("includes suggestedCorrection when the conflict has one", () => {
    const conflict = makeConflict("ERROR", 0.95);
    const result = makeConflictResult({
      conflicts: [conflict],
      hasErrors: true,
      summary: { total: 1, errorCount: 1, warningCount: 0 },
    });

    const summaries = mapSizeConflictsToCheckoutWarningSummaries(result);
    expect(summaries[0].suggestedCorrection).toBe("Change hand wraps to M.");
  });
});

describe("checkout guidance model: guidance item action field", () => {
  it("accepts a guidance item with a review_cart action", () => {
    const result = CheckoutGuidanceItemSchema.safeParse({
      guidanceId: "g-action",
      type: "size_warning",
      severity: "warning",
      priority: 0,
      title: "Warning",
      message: "Check sizes",
      action: {
        type: "review_cart",
        label: "Review cart",
      },
    });
    expect(result.success).toBe(true);
  });

  it("rejects an action with an invalid type", () => {
    const result = CheckoutGuidanceItemSchema.safeParse({
      guidanceId: "g-bad-action",
      type: "size_warning",
      severity: "warning",
      priority: 0,
      title: "Warning",
      message: "Check sizes",
      action: {
        type: "invalid_action_type",
        label: "Do something",
      },
    });
    expect(result.success).toBe(false);
  });
});
