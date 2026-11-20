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

function makeInput(projection = makeProjection(), lineIds = ["gid://shopify/CartLine/line-1", "gid://shopify/CartLine/line-2"]) {
  return {
    cart: {
      attribute: {
        value: JSON.stringify(projection),
      },
      lines: {
        nodes: lineIds.map((id) => ({ id, quantity: 1, merchandise: { id: `variant-${id}` } })),
      },
    },
  };
}

describe("discount-function run()", () => {
  it("applies a percentage discount for selected qualified outcome", () => {
    const result = run(makeInput());

    expect(result.operations).toHaveLength(1);
    const operation = result.operations[0].productDiscountsAdd;
    expect(operation.selectionStrategy).toBe("FIRST");
    expect(operation.candidates).toHaveLength(1);
    expect(operation.candidates[0].value).toEqual({ percentage: { value: 15 } });
    expect(operation.candidates[0].message).toBe("15% off");
    expect(operation.candidates[0].targets).toHaveLength(2);
  });

  it("applies a fixed amount discount for fixed type outcome", () => {
    const projection = makeProjection({
      outcomes: [
        {
          outcomeId: "bundle-2",
          ruleId: "bundle-2",
          ruleVersion: 1,
          status: "qualified",
          priority: 1,
          qualifiedLineIds: ["gid://shopify/CartLine/line-1"],
          missingRequirements: [],
          discount: {
            type: "fixed",
            value: 10,
            displayLabel: "Save $10",
          },
          presentation: {
            bundleTitle: "Fixed Savings Bundle",
            componentSummary: "Shirt",
            lineMergeEligible: false,
          },
        },
      ],
      resolution: { strategy: "merchant_priority", selectedOutcomeIds: ["bundle-2"], rejectedOutcomeIds: [] },
    });

    const result = run(makeInput(projection, ["gid://shopify/CartLine/line-1"]));

    expect(result.operations).toHaveLength(1);
    const operation = result.operations[0].productDiscountsAdd;
    expect(operation.candidates).toHaveLength(1);
    expect(operation.candidates[0].value).toEqual({ fixedAmount: { amount: "10" } });
    expect(operation.candidates[0].message).toBe("Save $10");
  });

  it("applies no discount when outcome is not in selectedOutcomeIds", () => {
    const projection = makeProjection();
    projection.resolution.selectedOutcomeIds = [];

    const result = run(makeInput(projection));

    expect(result).toEqual({ operations: [] });
  });

  it("applies no discount for partial outcome", () => {
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
            lineMergeEligible: false,
          },
        },
      ],
      resolution: { strategy: "merchant_priority", selectedOutcomeIds: ["bundle-1"], rejectedOutcomeIds: [] },
    });

    const result = run(makeInput(projection, ["gid://shopify/CartLine/line-1"]));

    expect(result).toEqual({ operations: [] });
  });

  it("applies no discount when projectionVersion is unsupported", () => {
    const projection = makeProjection({ projectionVersion: 99 });
    const result = run(makeInput(projection));
    expect(result).toEqual({ operations: [] });
  });

  it("applies no discount when cart attribute is missing", () => {
    const result = run({
      cart: {
        attribute: null,
        lines: { nodes: [] },
      },
    });
    expect(result).toEqual({ operations: [] });
  });

  it("applies no discount when cart attribute is malformed JSON", () => {
    const result = run({
      cart: {
        attribute: { value: "not-json{{" },
        lines: { nodes: [] },
      },
    });
    expect(result).toEqual({ operations: [] });
  });

  it("applies no discount when projection has no outcomes array", () => {
    const result = run(makeInput({ projectionVersion: SUPPORTED_VERSION, resolution: { selectedOutcomeIds: [], rejectedOutcomeIds: [] } }));
    expect(result).toEqual({ operations: [] });
  });

  it("filters out line IDs not present in the cart", () => {
    const projection = makeProjection();
    // only line-1 is in the cart, line-2 is not
    const input = makeInput(projection, ["gid://shopify/CartLine/line-1"]);

    const result = run(input);

    expect(result.operations).toHaveLength(1);
    const candidate = result.operations[0].productDiscountsAdd.candidates[0];
    expect(candidate.targets).toHaveLength(1);
    expect(candidate.targets[0].cartLine.id).toBe("gid://shopify/CartLine/line-1");
  });

  it("applies no discount when qualified lines are all absent from cart", () => {
    const projection = makeProjection();
    const input = makeInput(projection, ["gid://shopify/CartLine/different-line"]);

    const result = run(input);

    expect(result).toEqual({ operations: [] });
  });
});
