# Contract: Visual Recommendations

## Purpose

Define the shopper-facing payload for collection-completion and style-improving recommendations.

## Payload

```ts
type VisualRecommendationReason = {
  reasonType: "same_collection" | "compatible_colorway" | "merchant_override" | "fallback_palette_match";
  source: "auto" | "merchant" | "hybrid";
  confidence: number;
  message: string;
};

type VisualRecommendation = {
  id: string;
  recommendationType: "collection_completion" | "swap";
  productId: string;
  variantId?: string;
  title: string;
  confidence: number;
  reasons: VisualRecommendationReason[];
  visualContext: {
    matchedCollectionKeys: string[];
    matchedColorwayKeys: string[];
    currentCoherenceScore: number;
    projectedCoherenceScore?: number;
  };
};
```

## Rules

- `collection_completion` is used when the shopper already owns a meaningful subset of a coordinated collection.
- `swap` is used only when the recommendation preserves the intended product role and improves coherence.
- `projectedCoherenceScore` is required for swap recommendations.
- Every recommendation must be explainable from contract data alone; no hidden log-only reasoning is allowed.