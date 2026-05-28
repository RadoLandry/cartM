# Contract: Replenishment Recommendation Response

## Purpose

Defines the shopper-facing replenishment section added to the existing cart recommendation response.

## Response Shape

```ts
interface ReplenishmentRecommendationPayload {
  summary: {
    status: "hidden" | "eligible" | "due";
    totalCandidates: number;
    dueCount: number;
    approachingCount: number;
    highestPriorityCategory?: string;
    message?: string;
  };
  opportunities: Array<{
    candidateKey: string;
    productId: string;
    variantId?: string;
    categoryTag: string;
    title: string;
    dueState: "approaching" | "due";
    confidence: number;
    expectedReplacementAt: string;
    actionType: "reorder" | "upgrade";
    reason: string;
    actionTarget?: {
      productId: string;
      variantId?: string;
      available: boolean;
    };
  }>;
  refreshCart?: {
    suggestionKey: string;
    totalItems: number;
    actions: Array<{
      productId: string;
      variantId?: string;
      quantity: number;
      actionType: "reorder" | "upgrade";
    }>;
  };
}
```

## Validation Rules

- The replenishment section is present only for recognized shoppers with replenishment-eligible history.
- `summary.status` is `hidden` when no credible replenishment action should be shown.
- `opportunities` must exclude unavailable direct reorder targets unless a valid upgrade action exists.
- `expectedReplacementAt` must use an ISO-8601 timestamp.
- `confidence` must be normalized to the 0–1 range.

## Response Expectations

- The payload must not expose raw order history, raw webhook payloads, or admin-only customer data.
- Shopper-facing reasons should explain why the reminder is timely without leaking implementation details.
- `refreshCart` is optional and appears only when at least one executable action target exists.

## Notes

- This contract extends the existing `api.ai.recommendations.tsx` response rather than creating a separate replenishment endpoint.
- Storefront clients can hide the entire section when `summary.status` is `hidden`.