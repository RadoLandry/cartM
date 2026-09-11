import { describe, expect, it } from "vitest";

import { buildReplenishmentRecommendations } from "../../../app/lib/cart-intelligence/recommendations";
import type { ReplenishmentCandidate } from "../../../app/lib/cart-intelligence/replenishment";

function makeCandidate(overrides: Partial<ReplenishmentCandidate> = {}): ReplenishmentCandidate {
  return {
    candidateKey: "candidate-1",
    productId: "prod-1",
    categoryTag: "hand-wraps",
    title: "Hand Wraps",
    dueState: "due",
    expectedReplacementAt: "2026-06-01T00:00:00.000Z",
    confidence: 0.8,
    urgencyScore: 1.2,
    preferredAction: "reorder",
    reasons: ["Due for replacement."],
    ...overrides,
  };
}

describe("buildReplenishmentRecommendations", () => {
  it("returns undefined when there are no candidates", () => {
    expect(buildReplenishmentRecommendations([])).toBeUndefined();
  });

  it("groups multiple due, available candidates into a refresh-cart action", () => {
    const candidates = [
      makeCandidate({
        candidateKey: "candidate-1",
        productId: "prod-1",
        reorderTarget: { productId: "prod-1", variantId: "var-1", available: true },
      }),
      makeCandidate({
        candidateKey: "candidate-2",
        productId: "prod-2",
        reorderTarget: { productId: "prod-2", variantId: "var-2", available: true },
      }),
    ];

    const payload = buildReplenishmentRecommendations(candidates);

    expect(payload?.refreshCart).toEqual({
      suggestionKey: "refresh-cart:candidate-1,candidate-2",
      totalItems: 2,
      actions: [
        { productId: "prod-1", variantId: "var-1", quantity: 1, actionType: "reorder" },
        { productId: "prod-2", variantId: "var-2", quantity: 1, actionType: "reorder" },
      ],
    });
  });

  it("omits refresh-cart when fewer than two actionable due candidates are available", () => {
    const candidates = [
      makeCandidate({
        reorderTarget: { productId: "prod-1", variantId: "var-1", available: true },
      }),
      makeCandidate({
        candidateKey: "candidate-2",
        productId: "prod-2",
        dueState: "approaching",
      }),
    ];

    const payload = buildReplenishmentRecommendations(candidates);

    expect(payload?.refreshCart).toBeUndefined();
  });

  it("uses the upgrade target when the preferred action is upgrade", () => {
    const candidates = [
      makeCandidate({
        candidateKey: "candidate-1",
        productId: "prod-1",
        preferredAction: "upgrade",
        upgradeTarget: { productId: "prod-1-upgraded", variantId: "var-1-upgraded", available: true },
      }),
      makeCandidate({
        candidateKey: "candidate-2",
        productId: "prod-2",
        preferredAction: "upgrade",
        upgradeTarget: { productId: "prod-2-upgraded", variantId: "var-2-upgraded", available: true },
      }),
    ];

    const payload = buildReplenishmentRecommendations(candidates);

    expect(payload?.refreshCart?.actions).toEqual([
      { productId: "prod-1-upgraded", variantId: "var-1-upgraded", quantity: 1, actionType: "upgrade" },
      { productId: "prod-2-upgraded", variantId: "var-2-upgraded", quantity: 1, actionType: "upgrade" },
    ]);
  });
});
