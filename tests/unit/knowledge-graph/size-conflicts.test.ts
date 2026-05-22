import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../app/lib/db/queries", () => ({
  getCrossSizeMappingsForPair: vi.fn(),
}));

import { detectSizeConflicts } from "../../../app/lib/cart-intelligence/size-conflicts";
import { getCrossSizeMappingsForPair } from "../../../app/lib/db/queries";

const mockGetMappings = getCrossSizeMappingsForPair as ReturnType<typeof vi.fn>;

const SHOP = "test.myshopify.com";

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
    shop: SHOP,
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
    const result = await detectSizeConflicts({ shop: SHOP, cartItems: [] });
    expect(result.conflicts).toHaveLength(0);
    expect(result.hasErrors).toBe(false);
    expect(result.hasWarnings).toBe(false);
  });

  it("returns empty conflicts for a single-item cart", async () => {
    const result = await detectSizeConflicts({
      shop: SHOP,
      cartItems: [makeItem()],
    });
    expect(result.conflicts).toHaveLength(0);
    expect(mockGetMappings).not.toHaveBeenCalled();
  });
});

describe("detectSizeConflicts — isChildProduct mismatch → ERROR", () => {
  it("emits ERROR when one item is child-sized and the other is adult-sized", async () => {
    mockGetMappings.mockResolvedValue([]);

    const adultGloves = makeItem({
      productId: "prod-gloves",
      variantId: "var-gloves",
      categoryTag: "gloves_oz",
      sizeValue: "16oz",
      isChildProduct: false,
    });
    const childHeadgear = makeItem({
      productId: "prod-headgear",
      variantId: "var-headgear",
      categoryTag: "headgear",
      sizeValue: "S",
      isChildProduct: true,
    });

    const result = await detectSizeConflicts({
      shop: SHOP,
      cartItems: [adultGloves, childHeadgear],
    });

    expect(result.conflicts).toHaveLength(1);
    expect(result.conflicts[0].severity).toBe("ERROR");
    expect(result.hasErrors).toBe(true);
    expect(result.hasWarnings).toBe(false);
  });
});

describe("detectSizeConflicts — mapped size mismatch → WARNING", () => {
  it("emits WARNING when A→B mapping targetSize ≠ actual B size", async () => {
    // M clothing should pair with 32 shorts_waist, but cart has 34
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
      sizeValue: "34", // expected 32
    });

    const result = await detectSizeConflicts({
      shop: SHOP,
      cartItems: [rashguard, shorts],
    });

    expect(result.conflicts).toHaveLength(1);
    expect(result.conflicts[0].severity).toBe("WARNING");
    expect(result.hasWarnings).toBe(true);
    expect(result.hasErrors).toBe(false);
    expect(result.conflicts[0].itemB.expectedSize).toBe("32");
    expect(result.conflicts[0].suggestedCorrection).toBeTruthy();
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

    const result = await detectSizeConflicts({ shop: SHOP, cartItems: [rashguard, shorts] });
    expect(result.conflicts).toHaveLength(0);
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

    const result = await detectSizeConflicts({ shop: SHOP, cartItems: [gloves, mouthguard] });
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

    const result = await detectSizeConflicts({ shop: SHOP, cartItems: [rashguard, shorts] });
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

    const result = await detectSizeConflicts({ shop: SHOP, cartItems: [rashguard, shorts] });
    expect(result.conflicts[0].suggestedCorrection).toBeDefined();
    expect(typeof result.conflicts[0].suggestedCorrection).toBe("string");
  });
});
