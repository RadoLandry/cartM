# Contract: Threshold Evaluation

## Purpose

Defines the deterministic service contract for evaluating a cart against active threshold rules before shopper payload shaping.

## Request

```ts
interface ThresholdEvaluationRequest {
  shop: string;
  currencyCode: string;
  cartSubtotal: number;
  cartItems: Array<{
    productId: string;
    shopifyProductId: string;
    variantId: string;
    shopifyVariantId: string;
    title: string;
    quantity: number;
    unitPrice: number | null;
    availableForSale: boolean;
    categoryTags: string[];
    disciplineTags: string[];
  }>;
  thresholdRules: ThresholdRuleRecord[];
}
```

## Result

```ts
interface ThresholdEvaluationResult {
  selectedRule?: {
    key: string;
    label: string;
    benefitType: "FREE_SHIPPING" | "DISCOUNT_TIER" | "CUSTOM";
    benefitLabel: string;
    priority: number;
    targetSubtotal: number;
    actionableWindow: number;
  };
  status: "not_applicable" | "eligible" | "qualified" | "suppressed";
  gapAmount: number | null;
  suppressionReason?:
    | "already_qualified"
    | "outside_actionable_window"
    | "no_active_rules"
    | "no_in_stock_candidates"
    | "below_relevance_floor";
  candidates: Array<{
    productId: string;
    variantId?: string;
    title: string;
    unitPrice: number | null;
    relevanceScore: number;
    gapFitScore: number;
    compositeScore: number;
    wouldOvershoot: boolean;
    reasoning: string[];
  }>;
}
```

## Behavioral Rules

- Exactly zero or one threshold rule may be selected per evaluation.
- Candidates must already satisfy availability and exclusion checks before being returned.
- `eligible` requires at least one candidate whose composite score clears the relevance floor.
- `qualified` and `suppressed` results may still carry a selected rule for explanation, but they must not return surfaced shopper suggestions.