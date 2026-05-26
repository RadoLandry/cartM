# Contract: Merchant Threshold Admin

## Purpose

Defines the loader and action contract for the Polaris threshold manager route.

## Loader

### Response

```ts
interface ThresholdManagerLoaderData {
  thresholdRules: ThresholdRuleRecord[];
  categoryTags: string[];
  disciplineTags: string[];
  products: Array<{
    id: string;
    shopifyProductId: string;
    title: string;
    categoryTags: string[];
    disciplineTags: string[];
    variants: Array<{
      id: string;
      shopifyVariantId: string;
      title: string;
      inventoryQuantity: number | null;
    }>;
  }>;
}
```

## Actions

### `save-threshold-rule`

- Validates merchant input with Zod before persistence.
- Creates or updates a draft or active threshold rule.

Required fields:

```ts
interface SaveThresholdRuleInput {
  id?: string;
  key: string;
  label: string;
  description?: string;
  status: "ACTIVE" | "DRAFT" | "ARCHIVED";
  priority: number;
  benefitType: "FREE_SHIPPING" | "DISCOUNT_TIER" | "CUSTOM";
  benefitLabel: string;
  targetSubtotal: string;
  actionableWindow: string;
  allowOvershoot: "true" | "false";
  maxSuggestions: number;
  supportedCategoryTags?: string;
  supportedDisciplineTags?: string;
  excludedShopifyProductIds?: string;
  duplicatePurchasePolicy: "DISALLOW" | "ALLOW_REPEATABLE";
}
```

### `preview-threshold-rule`

- Accepts a cart fixture payload and returns the deterministic evaluation plus shopper payload for the specified rule.
- Used to validate suppression and ranking behavior before activating a rule.

### `archive-threshold-rule`

- Marks a rule archived so it is ignored during future evaluations.

## Response Shape

```ts
interface ThresholdManagerActionResult {
  ok: boolean;
  intent: string;
  error?: string;
  preview?: {
    evaluation: ThresholdEvaluationResult;
    payload: ThresholdRecommendationPayload;
  };
}
```