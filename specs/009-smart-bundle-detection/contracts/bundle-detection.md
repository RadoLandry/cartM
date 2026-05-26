# Contract: Bundle Detection

This contract defines the canonical request and result shape for deterministic cart-level bundle analysis.

## Consumers

- `app/lib/cart-intelligence/bundles.ts`
- `app/lib/cart-intelligence/recommendations.ts`
- cart recommendation API routes that aggregate bundle opportunities
- future checkout and function projection builders

## Input

```ts
interface BundleDetectionRequest {
  shop: string;
  cartItems: CartItemForBundle[];
  bundleRules: BundleRuleRecord[];
}

interface CartItemForBundle {
  productId: string;
  shopifyProductId: string;
  variantId: string;
  shopifyVariantId: string;
  title: string;
  quantity: number;
  availableForSale: boolean;
  categoryTags: string[];
  disciplineTags: string[];
  unitPrice?: number | null;
}

interface BundleRuleRecord {
  id: string;
  key: string;
  label: string;
  description?: string | null;
  priority: number;
  completionThreshold: number;
  discountType: "PERCENTAGE" | "FIXED";
  discountValue: string;
  components: BundleRuleComponentRecord[];
}

interface BundleRuleComponentRecord {
  componentKey: string;
  label: string;
  isRequired: boolean;
  sortOrder: number;
  minQuantity: number;
  matchMode: "CATEGORY" | "PRODUCT" | "VARIANT" | "CATEGORY_OR_PRODUCT";
  acceptedCategoryTags: string[];
  acceptedShopifyProductIds: string[];
  acceptedShopifyVariantIds: string[];
}
```

## Output

```ts
interface BundleDetectionResult {
  matches: BundleMatch[];
  summary: {
    qualifiedCount: number;
    nearCompleteCount: number;
    competingOfferCount: number;
  };
}

interface BundleMatch {
  bundleKey: string;
  label: string;
  priority: number;
  status: "qualified" | "nearly_complete" | "partial" | "not_applicable";
  coverageRatio: number;
  matchedComponents: BundleComponentCoverage[];
  missingComponents: BundleMissingComponent[];
  qualifiedCartItemIds: string[];
  competitionGroupKeys: string[];
  savings: {
    discountType: "PERCENTAGE" | "FIXED";
    discountValue: string;
  };
  reasons: Array<{
    reasonType: "qualified" | "near_complete" | "missing_required" | "overlap";
    message: string;
    confidence: number;
  }>;
}

interface BundleComponentCoverage {
  componentKey: string;
  label: string;
  requiredQuantity: number;
  matchedQuantity: number;
  matchedCartItemIds: string[];
}

interface BundleMissingComponent {
  componentKey: string;
  label: string;
  requiredQuantity: number;
  remainingQuantity: number;
  isRequired: boolean;
}
```

## Behaviour Rules

1. Evaluate every active bundle rule independently against the current cart.
2. A rule is `qualified` only when every required component meets its minimum quantity.
3. A rule is `nearly_complete` when required coverage meets or exceeds the rule threshold but one or more required quantities are still missing.
4. A rule is `partial` when it has meaningful evidence but does not meet the near-complete threshold.
5. A rule is `not_applicable` when the cart has no meaningful overlap with its required components.
6. Matching must be deterministic and based only on product, variant, category, and quantity evidence from the request and persisted rule.
7. `competitionGroupKeys` must identify overlapping opportunities that rely on the same qualifying cart evidence.
8. Matches returned for shopper-facing consumption should preserve stable bundle keys and component keys across reruns.
9. Inactive or archived rules must never appear in results.
10. Missing optional components may inform completion messaging but may not block `qualified` status.

## Error Conditions

| Condition | Behaviour |
|---|---|
| Empty cart | Return empty `matches` and zeroed summary |
| No active bundle rules | Return empty `matches` and zeroed summary |
| Invalid rule threshold or quantity | Reject at route or persistence boundary before detection runs |
| Cart item lacks product/category evidence | Ignore that evidence for the affected component match only |
| Competing rules share evidence | Return both matches with `competitionGroupKeys` populated |