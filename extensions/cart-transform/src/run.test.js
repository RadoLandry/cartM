import { describe, expect, it } from "vitest";
import { run } from "./run.js";

const SUPPORTED_VERSION = 1;

function makeProjection(overrides = {}) {
  return {
    projectionVersion: SUPPORTED_VERSION,
    outcomes: [
      {
        outcomeId: "bundle-1",
        ruleId: "bundle-1",
        ruleVersion: 1,
        status: "qualified",
        priority: 1,
        qualifiedLineIds: ["gid://shopify/CartLine/line-1", "gid://shopify/CartLine/line-2"],
        missingRequirements: [],
        discount: {
          type: "percentage",
          value: 15,
          displayLabel: "15% off",
        },
        presentation: {
          bundleTitle: "Starter Pack",
          componentSummary: "Shirt + Pants",
          lineMergeEligible: true,
        },
      },
    ],
    resolution: {
      strategy: "merchant_priority",
      selectedOutcomeIds: ["bundle-1"],
      rejectedOutcomeIds: [],
    },
    ...overrides,
  };
}

function makeCartLines(ids) {
  return ids.map((id, i) => ({
    id,
    quantity: 1,
    merchandise: {
      id: `gid://shopify/ProductVariant/variant-${i + 1}`,
      title: `Variant ${i + 1}`,
      product: { id: `gid://shopify/Product/product-${i + 1}`, title: `Product ${i + 1}` },
    },
  }));
}

function makeInput(projection = makeProjection(), lineIds = ["gid://shopify/CartLine/line-1", "gid://shopify/CartLine/line-2"]) {
  return {
    cart: {
      attribute: {
        value: JSON.stringify(projection),
      },
      lines: {
        nodes: makeCartLines(lineIds),
      },
    },
  };
}

describe("cart-transform run()", () => {
  it("merges eligible lines for a selected qualified bundle", () => {
    const result = run(makeInput());

    expect(result.operations).toHaveLength(1);
    const op = result.operations[0];
    expect(op.linesMerge).toBeDefined();
    expect(op.linesMerge.title).toBe("Starter Pack");
    expect(op.linesMerge.cartLines).toHaveLength(2);
    expect(op.linesMerge.cartLines.map((line) => line.cartLineId)).toContain("gid://shopify/CartLine/line-1");
    expect(op.linesMerge.cartLines.map((line) => line.cartLineId)).toContain("gid://shopify/CartLine/line-2");
  });

  it("returns no-op when lineMergeEligible is false", () => {
    const projection = makeProjection({
      outcomes: [
        {
          outcomeId: "bundle-1",
          ruleId: "bundle-1",
          ruleVersion: 1,
          status: "qualified",
          priority: 1,
          qualifiedLineIds: ["gid://shopify/CartLine/line-1", "gid://shopify/CartLine/line-2"],
          missingRequirements: [],
          discount: { type: "percentage", value: 15, displayLabel: "15% off" },
          presentation: {
            bundleTitle: "Starter Pack",
            componentSummary: "Shirt + Pants",
            lineMergeEligible: false,
          },
        },
      ],
      resolution: { strategy: "merchant_priority", selectedOutcomeIds: ["bundle-1"], rejectedOutcomeIds: [] },
    });

    const result = run(makeInput(projection));

    expect(result.operations).toHaveLength(0);
  });

  it("returns no-op when outcome is not selected", () => {
    const projection = makeProjection();
    projection.resolution.selectedOutcomeIds = [];

    const result = run(makeInput(projection));

    expect(result.operations).toHaveLength(0);
  });

  it("returns no-op when outcome is partial (not qualified)", () => {
    const projection = makeProjection({
      outcomes: [
        {
          outcomeId: "bundle-1",
          ruleId: "bundle-1",
          ruleVersion: 1,
          status: "partial",
          priority: 1,
          qualifiedLineIds: ["gid://shopify/CartLine/line-1"],
          missingRequirements: [{ label: "Pants", quantityRequired: 1, quantityPresent: 0 }],
          presentation: {
            bundleTitle: "Starter Pack",
            componentSummary: "Shirt",
            lineMergeEligible: true,
          },
        },
      ],
      resolution: { strategy: "merchant_priority", selectedOutcomeIds: ["bundle-1"], rejectedOutcomeIds: [] },
    });

    const result = run(makeInput(projection, ["gid://shopify/CartLine/line-1"]));

    expect(result.operations).toHaveLength(0);
  });

  it("returns no-op when projectionVersion is unsupported", () => {
    const projection = makeProjection({ projectionVersion: 99 });
    const result = run(makeInput(projection));
    expect(result.operations).toHaveLength(0);
  });

  it("returns no-op when cart attribute is missing", () => {
    const result = run({
      cart: {
        attribute: null,
        lines: { nodes: makeCartLines(["gid://shopify/CartLine/line-1"]) },
      },
    });
    expect(result.operations).toHaveLength(0);
  });

  it("returns no-op when cart attribute is malformed JSON", () => {
    const result = run({
      cart: {
        attribute: { value: "{{invalid" },
        lines: { nodes: makeCartLines(["gid://shopify/CartLine/line-1"]) },
      },
    });
    expect(result.operations).toHaveLength(0);
  });

  it("returns no-op when qualified lines are all absent from cart", () => {
    const projection = makeProjection();
    const result = run(makeInput(projection, ["gid://shopify/CartLine/different-line"]));
    expect(result.operations).toHaveLength(0);
  });

  it("skips merge when fewer than two lines are in cart", () => {
    const projection = makeProjection();
    // Only line-1 exists in cart, line-2 is absent
    const result = run(makeInput(projection, ["gid://shopify/CartLine/line-1"]));
    expect(result.operations).toHaveLength(0);
  });
});
