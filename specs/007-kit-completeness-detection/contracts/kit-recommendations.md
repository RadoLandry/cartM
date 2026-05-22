# Contract: Kit Recommendations

## Purpose

Define the shopper-facing payload for kit completeness signals and missing-item recommendations.

## Payload

```ts
type KitRecommendationReason = {
  reasonType:
    | "discipline_match"
    | "relationship_support"
    | "merchant_override"
    | "required_missing"
    | "optional_missing"
    | "substitute_match";
  source: "AUTO" | "MERCHANT" | "HYBRID";
  confidence: number;
  message: string;
};

type MissingKitRecommendation = {
  requirementKey: string;
  recommendationType: "required_missing" | "optional_missing";
  productId?: string;
  variantId?: string;
  title: string;
  disciplineTag: string;
  priority: number;
  confidence: number;
  reasons: KitRecommendationReason[];
};

type KitRecommendationPayload = {
  kitKey: string;
  label: string;
  disciplineTag: string;
  completenessScore: number;
  status: "partial" | "complete";
  missingRecommendations: MissingKitRecommendation[];
  summaryReasons: KitRecommendationReason[];
};
```

## Rules

- `missingRecommendations` must be empty when `status = "complete"`.
- Required items must appear ahead of optional items, then sort by ascending `priority`.
- Recommendations must exclude archived, inactive, or unavailable products and variants.
- The payload must remain explainable from contract data alone; no hidden log-only reasoning is allowed.