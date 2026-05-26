import {
  ThresholdBenefitType,
  ThresholdDuplicatePurchasePolicy,
  ThresholdRuleSource,
  ThresholdRuleStatus,
} from "@prisma/client";

import type {
  CartThresholdItem,
  ThresholdCandidateProduct,
  ThresholdRuleRecord,
} from "../../app/lib/knowledge-graph/thresholds";

export const TEST_SHOP = "test.myshopify.com";

export function makeThresholdCartItem(
  overrides: Partial<CartThresholdItem> = {},
): CartThresholdItem {
  return {
    productId: "prod-gloves",
    shopifyProductId: "gid://shopify/Product/101",
    variantId: "var-gloves-black",
    shopifyVariantId: "gid://shopify/ProductVariant/101",
    title: "Baseline threshold item",
    quantity: 1,
    availableForSale: true,
    categoryTags: ["gloves"],
    disciplineTags: ["boxing"],
    unitPrice: 79.99,
    ...overrides,
  };
}

export function makeThresholdRuleFixture(
  overrides: Partial<ThresholdRuleRecord> = {},
): ThresholdRuleRecord {
  return {
    id: "threshold-free-shipping",
    key: "free-shipping-default",
    label: "Free Shipping Threshold",
    description: "Recommend relevant items to unlock free shipping.",
    source: ThresholdRuleSource.MERCHANT,
    status: ThresholdRuleStatus.ACTIVE,
    priority: 10,
    benefitType: ThresholdBenefitType.FREE_SHIPPING,
    benefitLabel: "Free shipping",
    targetSubtotal: 100,
    actionableWindow: 25,
    allowOvershoot: true,
    maxSuggestions: 3,
    supportedDisciplineTags: [],
    supportedCategoryTags: [],
    excludedShopifyProductIds: [],
    duplicatePurchasePolicy: ThresholdDuplicatePurchasePolicy.DISALLOW,
    ...overrides,
  };
}

export function makeThresholdCandidateProduct(
  overrides: Partial<ThresholdCandidateProduct> = {},
): ThresholdCandidateProduct {
  return {
    productId: "prod-wraps",
    shopifyProductId: "gid://shopify/Product/202",
    title: "Hand Wraps",
    categoryTags: ["hand-wraps", "wraps"],
    disciplineTags: ["boxing"],
    variants: [
      {
        id: "var-wraps-black",
        shopifyVariantId: "gid://shopify/ProductVariant/202",
        title: "Black",
        price: 14.99,
        inventoryQuantity: 25,
      },
    ],
    ...overrides,
  };
}

export function makeNearThresholdCart() {
  return [
    makeThresholdCartItem({
      productId: "prod-gloves",
      variantId: "var-gloves-1",
      title: "Boxing Gloves",
      categoryTags: ["gloves", "boxing-gloves"],
      disciplineTags: ["boxing"],
      unitPrice: 79.99,
    }),
  ];
}

export function makeQualifiedThresholdCart() {
  return [
    makeThresholdCartItem({
      productId: "prod-gloves",
      variantId: "var-gloves-1",
      title: "Boxing Gloves",
      categoryTags: ["gloves", "boxing-gloves"],
      disciplineTags: ["boxing"],
      unitPrice: 89.99,
    }),
    makeThresholdCartItem({
      productId: "prod-shin-guards",
      variantId: "var-shin-guards-1",
      title: "Shin Guards",
      categoryTags: ["shin-guards"],
      disciplineTags: ["muay-thai"],
      unitPrice: 39.99,
    }),
  ];
}

export function makeLowRelevanceThresholdCart() {
  return [
    makeThresholdCartItem({
      productId: "prod-gift-card",
      shopifyProductId: "gid://shopify/Product/777",
      variantId: "var-gift-card-1",
      shopifyVariantId: "gid://shopify/ProductVariant/777",
      title: "Gift Card",
      categoryTags: ["gift-card"],
      disciplineTags: [],
      unitPrice: 92,
    }),
  ];
}