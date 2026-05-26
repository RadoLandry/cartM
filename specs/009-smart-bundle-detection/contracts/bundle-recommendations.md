# Contract: Bundle Recommendations

This contract defines the shopper-facing payload built from canonical bundle detection results.

## Consumers

- cart recommendation aggregation in `app/lib/cart-intelligence/recommendations.ts`
- storefront cart UI surfaces
- future checkout warning and offer surfaces

## Input

```ts
interface BuildBundleRecommendationsInput {
  detection: BundleDetectionResult;
  completionCandidates?: Record<string, BundleCompletionCandidate[]>;
}

interface BundleCompletionCandidate {
  componentKey: string;
  productId: string;
  variantId?: string;
  title: string;
  availableForSale: boolean;
  confidence: number;
  reason: string;
}
```

## Output

```ts
interface BundleRecommendationPayload {
  summary: {
    qualifiedCount: number;
    nearCompleteCount: number;
    primaryBundleKey?: string;
  };
  opportunities: ShopperBundleOpportunity[];
}

interface ShopperBundleOpportunity {
  bundleKey: string;
  label: string;
  status: "qualified" | "nearly_complete";
  priority: number;
  message: string;
  savings: {
    label: string;
    discountType: "PERCENTAGE" | "FIXED";
    discountValue: string;
  };
  completionProgress: {
    matchedRequiredCount: number;
    totalRequiredCount: number;
    coverageRatio: number;
  };
  completionActions: ShopperBundleCompletionAction[];
  isCompetingOffer: boolean;
}

interface ShopperBundleCompletionAction {
  componentKey: string;
  title: string;
  remainingQuantity: number;
  productId?: string;
  variantId?: string;
  availability: "available" | "unavailable" | "unknown";
  confidence: number;
  reason: string;
}
```

## Behaviour Rules

1. Only `qualified` and `nearly_complete` matches may be emitted as shopper opportunities.
2. `qualified` opportunities must emphasize unlocked savings and suppress completion actions for already satisfied required components.
3. `nearly_complete` opportunities must include actionable completion steps only for purchasable candidates.
4. If a missing component has no available completion candidate, the payload may describe the gap but must not frame it as a direct add-to-cart action.
5. Opportunity ordering must follow bundle priority first, then match quality.
6. `isCompetingOffer` must be `true` when the underlying match reports overlap with another surfaced opportunity.
7. The payload must remain presentation-neutral: no UI-specific styling or component names.

## Error Conditions

| Condition | Behaviour |
|---|---|
| No surfaced matches | Return empty `opportunities` and zeroed summary |
| Missing completion candidate data | Emit informational completion action with `availability: "unknown"` or omit action entirely |
| Multiple top-priority opportunities | Preserve deterministic ordering by priority then bundle key |