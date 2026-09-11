import { describe, expect, it } from "vitest";

import { evaluateReplenishmentCandidates } from "../../../app/lib/cart-intelligence/replenishment";
import {
  makeLifecycleRuleFixture,
  makePurchaseSnapshotFixture,
  TEST_CUSTOMER_ID,
  TEST_SHOP,
} from "../../helpers/replenishment-fixtures";

const NOW = new Date("2026-06-01T00:00:00.000Z");

describe("evaluateReplenishmentCandidates", () => {
  it("marks a candidate due and ranks it above an approaching candidate", () => {
    const dueSnapshot = makePurchaseSnapshotFixture({
      productId: "prod-due",
      categoryTag: "hand-wraps",
      lastPurchasedAt: new Date("2026-01-01T00:00:00.000Z"),
      inferredCadenceDays: 120,
      orderCount: 3,
    });
    const approachingSnapshot = makePurchaseSnapshotFixture({
      productId: "prod-approaching",
      categoryTag: "hand-wraps",
      lastPurchasedAt: new Date("2026-02-15T00:00:00.000Z"),
      inferredCadenceDays: 120,
      orderCount: 3,
    });
    const rule = makeLifecycleRuleFixture({ categoryTag: "hand-wraps", windowMinDays: 90, windowMaxDays: 120 });

    const candidates = evaluateReplenishmentCandidates({
      shop: TEST_SHOP,
      shopifyCustomerId: TEST_CUSTOMER_ID,
      purchaseSnapshots: [approachingSnapshot as never, dueSnapshot as never],
      lifecycleRules: [rule as never],
      asOf: NOW,
    });

    expect(candidates[0].productId).toBe("prod-due");
    expect(candidates[0].dueState).toBe("due");
    expect(candidates[1].dueState).toBe("approaching");
  });

  it("falls back to not_due when no lifecycle rule matches the category", () => {
    const snapshot = makePurchaseSnapshotFixture({ categoryTag: "unmapped-category" });

    const candidates = evaluateReplenishmentCandidates({
      shop: TEST_SHOP,
      shopifyCustomerId: TEST_CUSTOMER_ID,
      purchaseSnapshots: [snapshot as never],
      lifecycleRules: [],
      asOf: NOW,
    });

    expect(candidates).toEqual([]);
  });

  it("softens confidence and downgrades due state for sparse single-purchase history", () => {
    const sparseSnapshot = makePurchaseSnapshotFixture({
      orderCount: 1,
      inferredCadenceDays: undefined,
      lastPurchasedAt: new Date("2025-11-01T00:00:00.000Z"),
    });
    const rule = makeLifecycleRuleFixture({ windowMinDays: 90, windowMaxDays: 180 });

    const candidates = evaluateReplenishmentCandidates({
      shop: TEST_SHOP,
      shopifyCustomerId: TEST_CUSTOMER_ID,
      profile: { confidenceSummary: { overall: 0.4 }, lastActiveAt: NOW, purchaseSummary: {} },
      purchaseSnapshots: [sparseSnapshot as never],
      lifecycleRules: [rule as never],
      asOf: NOW,
    });

    expect(candidates[0].confidence).toBeLessThan(0.4);
    expect(candidates[0].dueState).toBe("approaching");
  });

  it("extends the effective cadence for multi-quantity purchases before marking due", () => {
    const bulkSnapshot = makePurchaseSnapshotFixture({
      totalQuantity: 4,
      orderCount: 2,
      inferredCadenceDays: 100,
      lastPurchasedAt: new Date("2026-02-20T00:00:00.000Z"),
    });
    const rule = makeLifecycleRuleFixture({ windowMinDays: 90, windowMaxDays: 100 });

    const candidates = evaluateReplenishmentCandidates({
      shop: TEST_SHOP,
      shopifyCustomerId: TEST_CUSTOMER_ID,
      purchaseSnapshots: [bulkSnapshot as never],
      lifecycleRules: [rule as never],
      asOf: NOW,
    });

    expect(candidates[0].dueState).not.toBe("not_due");
    expect(new Date(candidates[0].expectedReplacementAt).getTime()).toBeGreaterThan(
      new Date("2026-02-20T00:00:00.000Z").getTime() + 100 * 24 * 60 * 60 * 1000,
    );
  });

  it("attaches reorder and upgrade action targets from hydration maps", () => {
    const snapshot = makePurchaseSnapshotFixture({
      preferredAction: "upgrade",
      lastPurchasedAt: new Date("2026-05-01T00:00:00.000Z"),
    });
    const rule = makeLifecycleRuleFixture();
    const upgradeTargets = new Map([
      [snapshot.productId, { productId: "prod-upgraded", variantId: "var-upgraded", available: true }],
    ]);

    const candidates = evaluateReplenishmentCandidates({
      shop: TEST_SHOP,
      shopifyCustomerId: TEST_CUSTOMER_ID,
      purchaseSnapshots: [snapshot as never],
      lifecycleRules: [rule as never],
      upgradeTargets: upgradeTargets as never,
      asOf: NOW,
    });

    expect(candidates[0].upgradeTarget).toEqual({
      productId: "prod-upgraded",
      variantId: "var-upgraded",
      available: true,
    });
  });
});
