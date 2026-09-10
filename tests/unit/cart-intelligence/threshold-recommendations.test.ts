import { describe, expect, it } from "vitest";

import { buildThresholdRecommendations } from "../../../app/lib/cart-intelligence/recommendations";
import type { ThresholdEvaluationResult } from "../../../app/lib/cart-intelligence/threshold";

describe("buildThresholdRecommendations", () => {
  it("hides suggestions when the result is not applicable or suppressed", () => {
    const suppressed: ThresholdEvaluationResult = {
      status: "suppressed",
      gapAmount: 12,
      suppressionReason: "below_relevance_floor",
      candidates: [],
    };

    const payload = buildThresholdRecommendations(suppressed);

    expect(payload).toEqual({
      summary: {
        status: "hidden",
        reason: "below_relevance_floor",
      },
      suggestions: [],
    });
  });

  it("renders a qualified summary with no suggestions", () => {
    const qualified: ThresholdEvaluationResult = {
      status: "qualified",
      gapAmount: 0,
      suppressionReason: "already_qualified",
      selectedRule: {
        key: "free-shipping-default",
        label: "Free Shipping",
        benefitType: "FREE_SHIPPING",
        benefitLabel: "Free shipping",
        priority: 10,
        targetSubtotal: 100,
        actionableWindow: 25,
      },
      candidates: [],
    };

    const payload = buildThresholdRecommendations(qualified);

    expect(payload.summary).toMatchObject({
      status: "qualified",
      thresholdKey: "free-shipping-default",
      benefitLabel: "Free shipping",
      targetSubtotal: "100.00",
      gapAmount: "0.00",
    });
    expect(payload.suggestions).toEqual([]);
  });

  it("renders ranked, shopper-ready suggestions for eligible results", () => {
    const eligible: ThresholdEvaluationResult = {
      status: "eligible",
      gapAmount: 20.01,
      unlockMessage: "Adding this item helps close the remaining $20.01 toward free shipping.",
      selectedRule: {
        key: "free-shipping-default",
        label: "Free Shipping",
        benefitType: "FREE_SHIPPING",
        benefitLabel: "Free shipping",
        priority: 10,
        targetSubtotal: 100,
        actionableWindow: 25,
        selectionReason: "The cart is within reach of unlocking free shipping.",
      },
      candidates: [
        {
          productId: "prod-mouthguard",
          variantId: "var-mouthguard-black",
          title: "Mouthguard / Black",
          unitPrice: 19.99,
          relevanceScore: 0.94,
          gapFitScore: 0.99,
          compositeScore: 0.96,
          wouldOvershoot: false,
          reasoning: ["Supports the boxing intent already present in the cart."],
        },
        {
          productId: "prod-wraps",
          variantId: "var-wraps-black",
          title: "Hand Wraps / Black",
          unitPrice: null,
          relevanceScore: 0.8,
          gapFitScore: 0.6,
          compositeScore: 0.7,
          wouldOvershoot: false,
          reasoning: ["Common boxing add-on that fits the remaining gap."],
        },
      ],
    };

    const payload = buildThresholdRecommendations(eligible);

    expect(payload.summary).toMatchObject({
      status: "eligible",
      thresholdKey: "free-shipping-default",
      reason: "The cart is within reach of unlocking free shipping.",
    });
    expect(payload.suggestions).toEqual([
      {
        productId: "prod-mouthguard",
        variantId: "var-mouthguard-black",
        title: "Mouthguard / Black",
        priceLabel: "$19.99",
        rank: 1,
        reason: "Supports the boxing intent already present in the cart.",
        unlockMessage: "Adding this item helps close the remaining $20.01 toward free shipping.",
        wouldOvershoot: false,
      },
      {
        productId: "prod-wraps",
        variantId: "var-wraps-black",
        title: "Hand Wraps / Black",
        priceLabel: undefined,
        rank: 2,
        reason: "Common boxing add-on that fits the remaining gap.",
        unlockMessage: "Adding this item helps close the remaining $20.01 toward free shipping.",
        wouldOvershoot: false,
      },
    ]);
  });
});
