import {
  BundleComponentMatchMode,
  BundleDiscountType,
  BundleRuleSource,
  BundleRuleStatus,
} from "@prisma/client";
import { describe, expect, it } from "vitest";

import { validateBundleRuleActivation } from "../../../app/lib/cart-intelligence/bundles";
import type { BundleRuleRecord } from "../../../app/lib/knowledge-graph/bundles";

describe("validateBundleRuleActivation", () => {
  const baseRule: BundleRuleRecord = {
    id: "rule-1",
    key: "starter",
    label: "Starter Bundle",
    source: BundleRuleSource.MERCHANT,
    status: BundleRuleStatus.DRAFT,
    priority: 10,
    completionThreshold: 0.8,
    discountType: BundleDiscountType.PERCENTAGE,
    discountValue: "10.00",
    components: [
      {
        id: "component-1",
        componentKey: "gloves",
        label: "Gloves",
        description: null,
        isRequired: true,
        sortOrder: 10,
        minQuantity: 1,
        matchMode: BundleComponentMatchMode.CATEGORY,
        acceptedCategoryTags: ["gloves"],
        acceptedShopifyProductIds: [],
        acceptedShopifyVariantIds: [],
      },
    ],
  };

  it("passes for a valid draft rule", () => {
    const issues = validateBundleRuleActivation(baseRule);
    expect(issues).toEqual([]);
  });

  it("fails when required components are missing", () => {
    const issues = validateBundleRuleActivation({
      ...baseRule,
      components: [
        {
          ...baseRule.components[0],
          isRequired: false,
        },
      ],
    });

    expect(issues.map((issue) => issue.code)).toContain("required_components_missing");
  });

  it("fails on invalid discount values", () => {
    const issues = validateBundleRuleActivation({
      ...baseRule,
      discountType: BundleDiscountType.PERCENTAGE,
      discountValue: "120",
    });

    expect(issues.map((issue) => issue.code)).toContain("invalid_percentage_discount");
  });

  it("fails on invalid schedule windows", () => {
    const issues = validateBundleRuleActivation({
      ...baseRule,
      startsAt: "2030-01-02T00:00:00.000Z",
      endsAt: "2030-01-01T00:00:00.000Z",
    });

    expect(issues.map((issue) => issue.code)).toContain("invalid_schedule_window");
  });
});
