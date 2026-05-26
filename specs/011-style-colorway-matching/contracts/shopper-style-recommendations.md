# Contract: Shopper Style Recommendations

## Purpose

Defines the shopper-facing payload contract returned by the style-matching slice for cart surfaces.

## Output Shape

```ts
interface StyleRecommendationPayload {
  summary: {
    status: "hidden" | "cohesive" | "mixed" | "clashing";
    coherenceScore: string;
    dominantTheme?: {
      type: "collection" | "colorway" | "mixed";
      key: string;
      label: string;
      confidence: number;
    };
    reason?: string;
  };
  opportunities: ShopperStyleOpportunity[];
}

interface ShopperStyleOpportunity {
  type: "collection_completion" | "swap";
  productId: string;
  variantId?: string;
  title: string;
  confidence: number;
  rank: number;
  reasonLabel: string;
  projectedCoherenceScore?: string;
  reasons: Array<{
    reasonType:
      | "same_collection"
      | "compatible_colorway"
      | "merchant_override"
      | "fallback_palette_match";
    confidence: number;
    source: "AUTO" | "MERCHANT" | "HYBRID" | "SYSTEM";
    message: string;
  }>;
}
```

## Response Semantics

- `summary.status = "hidden"` means no shopper-facing style suggestion should be rendered.
- `summary.status = "cohesive"` may be used to reinforce that the current cart already looks coordinated, but `opportunities` should be empty.
- `summary.status = "mixed"` or `"clashing"` may include ranked opportunities when confidence is sufficient.
- `collection_completion` opportunities extend an already-supported theme with a missing coordinated item.
- `swap` opportunities replace a current item or variant with a same-role alternative that improves coherence.

## Ranking Rules

- Opportunities are sorted by descending confidence, then by strongest fit to the dominant theme.
- The payload returns at most three shopper-visible opportunities.
- Unavailable and duplicate candidates are excluded before ranking.

## Suppression Rules

The payload must return `summary.status = "hidden"` and an empty `opportunities` list when any of the following are true:

- The cart is already cohesive and no reinforcement message is required.
- The cart contains multiple plausible themes with no clear dominant theme.
- Candidate confidence does not clear the minimum threshold.
- No in-stock candidate preserves shopper intent.

## Notes

- This contract is intentionally shopper-facing and does not expose admin-only fields such as raw extraction summaries.
- Storefront consumers should render suggestions subtly and should not treat them as blocking errors.