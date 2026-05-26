# Contract: Threshold Recommendation Payload

## Purpose

Defines the normalized shopper-facing payload returned to cart surfaces after threshold evaluation is translated into recommendation messaging.

## Payload

```ts
interface ThresholdRecommendationPayload {
  summary: {
    status: "hidden" | "eligible" | "qualified";
    thresholdKey?: string;
    benefitLabel?: string;
    targetSubtotal?: string;
    gapAmount?: string;
    reason?: string;
  };
  suggestions: Array<{
    productId: string;
    variantId?: string;
    title: string;
    priceLabel?: string;
    rank: number;
    reason: string;
    unlockMessage: string;
    wouldOvershoot: boolean;
  }>;
}
```

## Behavioral Rules

- `summary.status = "hidden"` means the UI should render no threshold prompt.
- `summary.status = "qualified"` may support passive messaging like "You unlocked free shipping" but must not present add-on prompts.
- `summary.status = "eligible"` may contain between one and three suggestions ordered by descending shopper value.
- Every surfaced suggestion must include both a contextual reason and an unlock message.