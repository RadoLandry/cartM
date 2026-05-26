import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../app/lib/db/queries", () => ({
  listActiveThresholdRules: vi.fn(),
  listThresholdCandidateProducts: vi.fn(),
}));

import {
  buildThresholdEvaluationRequest,
  evaluateThreshold,
} from "../../../app/lib/cart-intelligence/threshold";
import {
  listActiveThresholdRules,
  listThresholdCandidateProducts,
} from "../../../app/lib/db/queries";
import {
  makeNearThresholdCart,
  makeThresholdCandidateProduct,
  makeThresholdRuleFixture,
  TEST_SHOP,
} from "../../helpers/thresholds";

describe("threshold evaluation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("builds a request from active rules and ranks candidates for the nearest unmet threshold", async () => {
    const freeShippingRule = makeThresholdRuleFixture({
      id: "threshold-free-shipping",
      key: "free-shipping-default",
      priority: 10,
      targetSubtotal: 100,
      actionableWindow: 30,
    });
    const premiumRule = makeThresholdRuleFixture({
      id: "threshold-premium-discount",
      key: "premium-discount-tier",
      priority: 20,
      targetSubtotal: 150,
      actionableWindow: 40,
      benefitLabel: "Premium cart discount",
    });

    vi.mocked(listActiveThresholdRules).mockResolvedValue([freeShippingRule, premiumRule]);
    vi.mocked(listThresholdCandidateProducts).mockResolvedValue([
      makeThresholdCandidateProduct({
        productId: "prod-mouthguard",
        shopifyProductId: "gid://shopify/Product/303",
        title: "Mouthguard",
        categoryTags: ["mouthguard"],
        disciplineTags: ["boxing"],
        variants: [
          {
            id: "var-mouthguard-black",
            shopifyVariantId: "gid://shopify/ProductVariant/303",
            title: "Black",
            price: 19.99,
            inventoryQuantity: 6,
          },
        ],
      }),
      makeThresholdCandidateProduct({
        productId: "prod-bjj-belt",
        shopifyProductId: "gid://shopify/Product/404",
        title: "BJJ Belt",
        categoryTags: ["belt"],
        disciplineTags: ["bjj"],
        variants: [
          {
            id: "var-bjj-belt-blue",
            shopifyVariantId: "gid://shopify/ProductVariant/404",
            title: "Blue",
            price: 20.5,
            inventoryQuantity: 12,
          },
        ],
      }),
    ]);

    const request = await buildThresholdEvaluationRequest(
      TEST_SHOP,
      makeNearThresholdCart(),
      79.99,
    );

    expect(listActiveThresholdRules).toHaveBeenCalledWith(TEST_SHOP);
    expect(listThresholdCandidateProducts).toHaveBeenCalledWith(TEST_SHOP, freeShippingRule, 50);
    expect(request.thresholdRules).toHaveLength(2);
    expect(request.candidates).toHaveLength(2);
    expect(request.candidates[0]).toMatchObject({
      productId: "prod-mouthguard",
      wouldOvershoot: false,
    });
  });

  it("selects the nearest unmet threshold and caps eligible suggestions to the rule maximum", () => {
    const result = evaluateThreshold({
      shop: TEST_SHOP,
      currencyCode: "USD",
      cartSubtotal: 79.99,
      cartItems: makeNearThresholdCart(),
      thresholdRules: [
        makeThresholdRuleFixture({
          key: "free-shipping-default",
          targetSubtotal: 100,
          maxSuggestions: 2,
        }),
        makeThresholdRuleFixture({
          id: "threshold-premium-discount",
          key: "premium-discount-tier",
          priority: 20,
          targetSubtotal: 150,
          benefitLabel: "Premium cart discount",
        }),
      ],
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
          unitPrice: 14.99,
          relevanceScore: 0.92,
          gapFitScore: 0.74,
          compositeScore: 0.87,
          wouldOvershoot: false,
          reasoning: ["Common boxing add-on that fits the remaining gap."],
        },
        {
          productId: "prod-bag",
          variantId: "var-bag-black",
          title: "Gear Bag / Black",
          unitPrice: 24.99,
          relevanceScore: 0.72,
          gapFitScore: 0.42,
          compositeScore: 0.61,
          wouldOvershoot: true,
          reasoning: ["Useful but less precise for this gap."],
        },
      ],
    });

    expect(result).toMatchObject({
      status: "eligible",
      gapAmount: 20.01,
      selectedRule: {
        key: "free-shipping-default",
        benefitLabel: "Free shipping",
      },
    });
    expect(result.candidates.map((candidate) => candidate.productId)).toEqual([
      "prod-mouthguard",
      "prod-wraps",
    ]);
  });

  it("returns a qualified result when the current cart already meets the final active threshold", () => {
    const result = evaluateThreshold({
      shop: TEST_SHOP,
      currencyCode: "USD",
      cartSubtotal: 129.98,
      cartItems: makeNearThresholdCart(),
      thresholdRules: [
        makeThresholdRuleFixture({
          key: "free-shipping-default",
          targetSubtotal: 100,
        }),
      ],
      candidates: [],
    });

    expect(result).toMatchObject({
      status: "qualified",
      gapAmount: 0,
      suppressionReason: "already_qualified",
      selectedRule: {
        key: "free-shipping-default",
      },
    });
  });
});