import type { CartItemForConflict } from "../../app/lib/knowledge-graph/sizing";

export const TEST_SHOP = "test.myshopify.com";

export type MappingFixture = {
  id: string;
  shop: string;
  sourceCategoryTag: string;
  sourceSize: string;
  targetCategoryTag: string;
  targetSize: string;
  severityOnMismatch: "WARNING" | "ERROR";
  source: "AUTO" | "MERCHANT";
  createdAt: Date;
  updatedAt: Date;
};

export function makeConflictCartItem(
  overrides: Partial<CartItemForConflict> = {},
): CartItemForConflict {
  return {
    productId: "prod-1",
    variantId: "var-1",
    categoryTag: "clothing",
    sizeValue: "M",
    sizeCategory: "clothing",
    isChildProduct: false,
    title: "Baseline item",
    inventoryQuantity: 5,
    sizeNumeric: null,
    ...overrides,
  };
}

export function makeCrossSizeMappingFixture(
  sourceCategoryTag: string,
  sourceSize: string,
  targetCategoryTag: string,
  targetSize: string,
  severityOnMismatch: "WARNING" | "ERROR" = "WARNING",
): MappingFixture {
  return {
    id: `map-${sourceCategoryTag}-${sourceSize}-${targetCategoryTag}-${targetSize}`,
    shop: TEST_SHOP,
    sourceCategoryTag,
    sourceSize,
    targetCategoryTag,
    targetSize,
    severityOnMismatch,
    source: "AUTO",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  };
}

export function makeMappedMismatchCart() {
  return {
    primary: makeConflictCartItem({
      productId: "prod-rashguard",
      variantId: "var-rashguard-m",
      title: "Rashguard",
      categoryTag: "clothing",
      sizeValue: "M",
    }),
    paired: makeConflictCartItem({
      productId: "prod-shorts",
      variantId: "var-shorts-34",
      title: "Shorts",
      categoryTag: "shorts_waist",
      sizeValue: "34",
      sizeCategory: "shorts_waist",
      sizeNumeric: 34,
    }),
    mapping: makeCrossSizeMappingFixture("clothing", "M", "shorts_waist", "32"),
  };
}

export function makeChildAdultMismatchCart() {
  return {
    adult: makeConflictCartItem({
      productId: "prod-gloves",
      variantId: "var-gloves-16",
      title: "Adult gloves",
      categoryTag: "gloves_oz",
      sizeValue: "16oz",
      sizeCategory: "gloves_oz",
      isChildProduct: false,
    }),
    child: makeConflictCartItem({
      productId: "prod-headgear",
      variantId: "var-headgear-s",
      title: "Youth headgear",
      categoryTag: "headgear",
      sizeValue: "S",
      sizeCategory: "headgear",
      isChildProduct: true,
    }),
  };
}

export function makeAmbiguousCart() {
  return {
    sized: makeConflictCartItem({
      productId: "prod-gloves",
      variantId: "var-gloves-14",
      categoryTag: "gloves_oz",
      sizeValue: "14oz",
      sizeCategory: "gloves_oz",
    }),
    missingSize: makeConflictCartItem({
      productId: "prod-wraps",
      variantId: "var-wraps-default",
      categoryTag: "accessories",
      sizeValue: "",
      sizeCategory: "accessories",
    }),
  };
}

export function makeInventoryAwareSuggestionFixtures() {
  return {
    selected: makeConflictCartItem({
      productId: "prod-shorts",
      variantId: "var-shorts-36",
      categoryTag: "shorts_waist",
      sizeValue: "36",
      sizeCategory: "shorts_waist",
      sizeNumeric: 36,
      inventoryQuantity: 3,
    }),
    expectedAvailable: {
      id: "var-shorts-32",
      productId: "prod-shorts",
      shopifyVariantId: "gid://shopify/ProductVariant/32",
      title: "Shorts / 32",
      sizeValue: "32",
      sizeCategory: "shorts_waist",
      sizeNumeric: 32,
      inventoryQuantity: 7,
    },
    expectedUnavailable: {
      id: "var-shorts-30",
      productId: "prod-shorts",
      shopifyVariantId: "gid://shopify/ProductVariant/30",
      title: "Shorts / 30",
      sizeValue: "30",
      sizeCategory: "shorts_waist",
      sizeNumeric: 30,
      inventoryQuantity: 0,
    },
  };
}