import {
  BundleComponentMatchMode,
  BundleDiscountType,
  BundleRuleSource,
  BundleRuleStatus,
} from "@prisma/client";

import type { BundleRuleRecord, CartBundleItem } from "../../app/lib/knowledge-graph/bundles";

export const TEST_SHOP = "test.myshopify.com";

export function makeBundleCartItem(
  overrides: Partial<CartBundleItem> = {},
): CartBundleItem {
  return {
    productId: "prod-gloves",
    shopifyProductId: "gid://shopify/Product/1",
    variantId: "var-gloves-black",
    shopifyVariantId: "gid://shopify/ProductVariant/1",
    title: "Baseline bundle item",
    quantity: 1,
    availableForSale: true,
    categoryTags: ["gloves"],
    disciplineTags: ["boxing"],
    unitPrice: 79.99,
    ...overrides,
  };
}

export function makeBundleRuleFixture(
  overrides: Partial<BundleRuleRecord> = {},
): BundleRuleRecord {
  return {
    id: "bundle-boxing-starter",
    key: "boxing-starter-bundle",
    label: "Boxing Starter Bundle",
    description: "Starter boxing essentials",
    source: BundleRuleSource.MERCHANT,
    status: BundleRuleStatus.ACTIVE,
    priority: 10,
    completionThreshold: 0.8,
    discountType: BundleDiscountType.PERCENTAGE,
    discountValue: "10.00",
    components: [
      {
        id: "component-gloves",
        componentKey: "gloves",
        label: "Gloves",
        isRequired: true,
        sortOrder: 10,
        minQuantity: 1,
        matchMode: BundleComponentMatchMode.CATEGORY,
        acceptedCategoryTags: ["gloves", "boxing-gloves"],
        acceptedShopifyProductIds: [],
        acceptedShopifyVariantIds: [],
      },
      {
        id: "component-wraps",
        componentKey: "wraps",
        label: "Hand Wraps",
        isRequired: true,
        sortOrder: 20,
        minQuantity: 1,
        matchMode: BundleComponentMatchMode.CATEGORY,
        acceptedCategoryTags: ["hand-wraps", "wraps"],
        acceptedShopifyProductIds: [],
        acceptedShopifyVariantIds: [],
      },
      {
        id: "component-mouthguard",
        componentKey: "mouthguard",
        label: "Mouthguard",
        isRequired: true,
        sortOrder: 30,
        minQuantity: 1,
        matchMode: BundleComponentMatchMode.CATEGORY,
        acceptedCategoryTags: ["mouthguard"],
        acceptedShopifyProductIds: [],
        acceptedShopifyVariantIds: [],
      },
    ],
    ...overrides,
  };
}

export function makeQualifiedBundleCart() {
  return [
    makeBundleCartItem({
      productId: "prod-gloves",
      variantId: "var-gloves-1",
      title: "Boxing Gloves",
      categoryTags: ["gloves", "boxing-gloves"],
    }),
    makeBundleCartItem({
      productId: "prod-wraps",
      variantId: "var-wraps-1",
      title: "Hand Wraps",
      categoryTags: ["hand-wraps", "wraps"],
    }),
    makeBundleCartItem({
      productId: "prod-mouthguard",
      variantId: "var-mouthguard-1",
      title: "Mouthguard",
      categoryTags: ["mouthguard"],
    }),
  ];
}

export function makeNearCompleteBundleCart() {
  return [
    makeBundleCartItem({
      productId: "prod-gloves",
      variantId: "var-gloves-1",
      title: "Boxing Gloves",
      categoryTags: ["gloves", "boxing-gloves"],
    }),
    makeBundleCartItem({
      productId: "prod-wraps",
      variantId: "var-wraps-1",
      title: "Hand Wraps",
      categoryTags: ["hand-wraps", "wraps"],
    }),
  ];
}

export function makeOverlappingBundleFixtures() {
  const starter = makeBundleRuleFixture();
  const premium = makeBundleRuleFixture({
    id: "bundle-boxing-premium",
    key: "boxing-premium-bundle",
    label: "Boxing Premium Bundle",
    priority: 5,
    discountValue: "15.00",
    components: [
      ...starter.components,
      {
        id: "component-bag",
        componentKey: "bag",
        label: "Gear Bag",
        isRequired: false,
        sortOrder: 40,
        minQuantity: 1,
        matchMode: BundleComponentMatchMode.CATEGORY,
        acceptedCategoryTags: ["bag", "gear-bag"],
        acceptedShopifyProductIds: [],
        acceptedShopifyVariantIds: [],
      },
    ],
  });

  return { starter, premium };
}