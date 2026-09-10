import { describe, expect, it } from "vitest";

import {
  DEFAULT_THRESHOLD_TEMPLATES,
  buildThresholdSelectionReason,
  buildThresholdTemplateRecords,
  buildThresholdUnlockMessage,
  formatThresholdPriceLabel,
  rankThresholdCandidateProducts,
  sortThresholdRules,
} from "../../../app/lib/knowledge-graph/thresholds";
import { makeThresholdCandidateProduct, makeThresholdRuleFixture } from "../../helpers/thresholds";

describe("threshold templates", () => {
  it("provides seed templates with unique keys", () => {
    expect(DEFAULT_THRESHOLD_TEMPLATES.length).toBeGreaterThan(0);
    const keys = DEFAULT_THRESHOLD_TEMPLATES.map((template) => template.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("returns independent copies of array fields so callers cannot mutate the shared defaults", () => {
    const templates = buildThresholdTemplateRecords();
    templates[0]!.supportedCategoryTags.push("mutated");

    expect(DEFAULT_THRESHOLD_TEMPLATES[0]!.supportedCategoryTags).not.toContain("mutated");
  });
});

describe("sortThresholdRules", () => {
  it("orders rules by priority, then target subtotal, then key", () => {
    const sorted = sortThresholdRules([
      { priority: 20, targetSubtotal: 50, key: "b" },
      { priority: 10, targetSubtotal: 150, key: "a" },
      { priority: 10, targetSubtotal: 100, key: "c" },
    ]);

    expect(sorted.map((rule) => rule.key)).toEqual(["c", "a", "b"]);
  });
});

describe("formatThresholdPriceLabel", () => {
  it("formats a USD price and omits null prices", () => {
    expect(formatThresholdPriceLabel(19.99)).toBe("$19.99");
    expect(formatThresholdPriceLabel(null)).toBeUndefined();
  });
});

describe("buildThresholdUnlockMessage / buildThresholdSelectionReason", () => {
  const rule = makeThresholdRuleFixture();

  it("builds an unlock message referencing the remaining gap", () => {
    expect(buildThresholdUnlockMessage(rule, 20.01)).toContain("20.01");
  });

  it("builds a selection reason that reflects proximity to the actionable window", () => {
    expect(buildThresholdSelectionReason(rule, 5)).toContain("very close");
    expect(buildThresholdSelectionReason(rule, 24)).toContain("within reach");
  });
});

describe("rankThresholdCandidateProducts", () => {
  it("excludes candidates already in the cart when the duplicate policy disallows repeats", () => {
    const rule = makeThresholdRuleFixture();
    const ranked = rankThresholdCandidateProducts({
      rule,
      cartItems: [
        {
          productId: "prod-gloves",
          shopifyProductId: "gid://shopify/Product/101",
          variantId: "var-gloves-black",
          shopifyVariantId: "gid://shopify/ProductVariant/101",
          title: "Boxing Gloves",
          quantity: 1,
          availableForSale: true,
          categoryTags: ["gloves"],
          disciplineTags: ["boxing"],
        },
      ],
      candidates: [
        makeThresholdCandidateProduct({ productId: "prod-gloves", shopifyProductId: "gid://shopify/Product/101" }),
        makeThresholdCandidateProduct({ productId: "prod-wraps", shopifyProductId: "gid://shopify/Product/202" }),
      ],
      gapAmount: 20,
    });

    expect(ranked.map((candidate) => candidate.productId)).toEqual(["prod-wraps"]);
  });
});
