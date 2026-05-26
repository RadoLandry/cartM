import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../app/lib/db/queries", () => ({
  getCrossSizeMappingsForPair: vi.fn(),
}));

import { detectSizeConflicts } from "../../../app/lib/cart-intelligence/size-conflicts";
import { getCrossSizeMappingsForPair } from "../../../app/lib/db/queries";
import {
  makeAmbiguousCart,
  makeChildAdultMismatchCart,
  makeConflictCartItem,
  makeCrossSizeMappingFixture,
  makeMappedMismatchCart,
  TEST_SHOP,
} from "../../helpers/size-conflicts";

const mockGetMappings = getCrossSizeMappingsForPair as ReturnType<typeof vi.fn>;

function makeItem(
  overrides: Partial<{
    productId: string;
    variantId: string;
    categoryTag: string;
    sizeValue: string;
    sizeCategory: string;
    isChildProduct: boolean;
  }> = {},
) {
  return {
    productId: "prod-1",
    variantId: "var-1",
    categoryTag: "clothing",
    sizeValue: "M",
    sizeCategory: "clothing",
    isChildProduct: false,
    ...overrides,
  };
}

function makeMapping(
  sourceCategoryTag: string,
  sourceSize: string,
  targetCategoryTag: string,
  targetSize: string,
  severity = "WARNING",
) {
  return {
    id: `map-${sourceSize}-${targetSize}`,
    shop: TEST_SHOP,
    sourceCategoryTag,
    sourceSize,
    targetCategoryTag,
    targetSize,
    severityOnMismatch: severity,
    source: "AUTO",
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("detectSizeConflicts — empty / single item cart", () => {
  it("returns empty conflicts for an empty cart", async () => {
    const result = await detectSizeConflicts({ shop: TEST_SHOP, cartItems: [] });
    expect(result.conflicts).toHaveLength(0);
    expect(result.hasErrors).toBe(false);
    expect(result.hasWarnings).toBe(false);
    expect(result.summary).toEqual({ total: 0, errorCount: 0, warningCount: 0 });
  });

  it("returns empty conflicts for a single-item cart", async () => {
    const result = await detectSizeConflicts({
      shop: TEST_SHOP,
      cartItems: [makeItem()],
    });
    expect(result.conflicts).toHaveLength(0);
    expect(mockGetMappings).not.toHaveBeenCalled();
  });
});

describe("detectSizeConflicts — isChildProduct mismatch → ERROR", () => {
  it("emits ERROR when one item is child-sized and the other is adult-sized", async () => {
    mockGetMappings.mockResolvedValue([]);

    const { adult: adultGloves, child: childHeadgear } = makeChildAdultMismatchCart();

    const result = await detectSizeConflicts({
      shop: TEST_SHOP,
      cartItems: [adultGloves, childHeadgear],
    });

    expect(result.conflicts).toHaveLength(1);
    expect(result.conflicts[0].severity).toBe("ERROR");
    expect(result.conflicts[0].reasonType).toBe("child_adult_mismatch");
    expect(result.conflicts[0].conflictKey).toBe("child_adult_mismatch:var-gloves-16:var-headgear-s");
    expect(result.hasErrors).toBe(true);
    expect(result.hasWarnings).toBe(false);
    expect(result.summary).toEqual({ total: 1, errorCount: 1, warningCount: 0 });
  });
});

describe("detectSizeConflicts — mapped size mismatch → WARNING", () => {
  it("emits WARNING when A→B mapping targetSize ≠ actual B size", async () => {
    const { primary: rashguard, paired: shorts, mapping } = makeMappedMismatchCart();
    mockGetMappings.mockResolvedValue([mapping]);

    const result = await detectSizeConflicts({
      shop: TEST_SHOP,
      cartItems: [rashguard, shorts],
    });

    expect(result.conflicts).toHaveLength(1);
    expect(result.conflicts[0].severity).toBe("WARNING");
    expect(result.conflicts[0].reasonType).toBe("mapped_size_mismatch");
    expect(result.conflicts[0].conflictKey).toBe("mapped_size_mismatch:var-rashguard-m:var-shorts-34");
    expect(result.hasWarnings).toBe(true);
    expect(result.hasErrors).toBe(false);
    expect(result.conflicts[0].itemB.expectedSize).toBe("32");
    expect(result.conflicts[0].suggestions).toHaveLength(1);
    expect(result.conflicts[0].suggestedCorrection).toBeTruthy();
    expect(result.summary).toEqual({ total: 1, errorCount: 0, warningCount: 1 });
  });

  it("does NOT emit conflict when mapping targetSize matches actual size", async () => {
    mockGetMappings.mockResolvedValue([
      makeMapping("clothing", "M", "shorts_waist", "32"),
    ]);

    const rashguard = makeItem({
      productId: "prod-rg",
      variantId: "var-rg",
      categoryTag: "clothing",
      sizeValue: "M",
    });
    const shorts = makeItem({
      productId: "prod-shorts",
      variantId: "var-shorts",
      categoryTag: "shorts_waist",
      sizeValue: "32", // matches mapping
    });

    const result = await detectSizeConflicts({ shop: TEST_SHOP, cartItems: [rashguard, shorts] });
    expect(result.conflicts).toHaveLength(0);
  });

  it("returns stable summary counts for multiple conflicts in one cart", async () => {
    mockGetMappings.mockImplementation(async (_shop, left, right) => {
      if (left === "clothing" && right === "shorts_waist") {
        return [makeCrossSizeMappingFixture("clothing", "M", "shorts_waist", "32")];
      }

      return [];
    });

    const { primary: rashguard, paired: shorts } = makeMappedMismatchCart();
    const headgear = makeConflictCartItem({
      productId: "prod-headgear",
      variantId: "var-headgear-s",
      categoryTag: "headgear",
      sizeValue: "S",
      sizeCategory: "headgear",
      isChildProduct: true,
    });

    const result = await detectSizeConflicts({
      shop: TEST_SHOP,
      cartItems: [rashguard, shorts, headgear],
    });

    expect(result.conflicts).toHaveLength(3);
    expect(result.summary).toEqual({ total: 3, errorCount: 2, warningCount: 1 });
    expect(result.conflicts.map((conflict) => conflict.conflictKey)).toEqual([
      "mapped_size_mismatch:var-rashguard-m:var-shorts-34",
      "child_adult_mismatch:var-headgear-s:var-rashguard-m",
      "child_adult_mismatch:var-headgear-s:var-shorts-34",
    ]);
  });
});

describe("detectSizeConflicts — unmapped category pair", () => {
  it("returns empty conflicts when no CrossSizeMapping rows exist for the pair", async () => {
    mockGetMappings.mockResolvedValue([]);

    const gloves = makeItem({
      productId: "prod-gloves",
      variantId: "var-gloves",
      categoryTag: "gloves_oz",
      sizeValue: "14oz",
    });
    const mouthguard = makeItem({
      productId: "prod-mg",
      variantId: "var-mg",
      categoryTag: "mouthguard",
      sizeValue: "adult",
    });

    const result = await detectSizeConflicts({ shop: TEST_SHOP, cartItems: [gloves, mouthguard] });
    expect(result.conflicts).toHaveLength(0);
    expect(result.hasErrors).toBe(false);
    expect(result.hasWarnings).toBe(false);
  });
});

describe("detectSizeConflicts — compatible sizes", () => {
  it("returns empty conflicts for a multi-item cart with all compatible sizes", async () => {
    // Two items same category — should be skipped
    mockGetMappings.mockResolvedValue([
      makeMapping("clothing", "L", "shorts_waist", "34"),
    ]);

    const rashguard = makeItem({
      productId: "prod-rg",
      variantId: "var-rg",
      categoryTag: "clothing",
      sizeValue: "L",
    });
    const shorts = makeItem({
      productId: "prod-shorts",
      variantId: "var-shorts",
      categoryTag: "shorts_waist",
      sizeValue: "34",
    });

    const result = await detectSizeConflicts({ shop: TEST_SHOP, cartItems: [rashguard, shorts] });
    expect(result.conflicts).toHaveLength(0);
  });
});

describe("detectSizeConflicts — suggestedCorrection present on WARNING", () => {
  it("includes suggestedCorrection message on WARNING conflicts", async () => {
    mockGetMappings.mockResolvedValue([
      makeMapping("clothing", "M", "shorts_waist", "32"),
    ]);

    const rashguard = makeItem({ categoryTag: "clothing", sizeValue: "M" });
    const shorts = makeItem({ productId: "prod-s", variantId: "var-s", categoryTag: "shorts_waist", sizeValue: "36" });

    const result = await detectSizeConflicts({ shop: TEST_SHOP, cartItems: [rashguard, shorts] });
    expect(result.conflicts[0].suggestedCorrection).toBeDefined();
    expect(typeof result.conflicts[0].suggestedCorrection).toBe("string");
  });
});

describe("detectSizeConflicts — low-noise skips", () => {
  it("skips ambiguous carts with missing sizes", async () => {
    const { sized, missingSize } = makeAmbiguousCart();
    mockGetMappings.mockResolvedValue([]);

    const result = await detectSizeConflicts({
      shop: TEST_SHOP,
      cartItems: [sized, missingSize],
    });

    expect(result.conflicts).toHaveLength(0);
    expect(mockGetMappings).not.toHaveBeenCalled();
  });
});
