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

## Example Payloads

### Cohesive cart — no suggestions rendered

```json
{
  "summary": {
    "status": "hidden",
    "coherenceScore": "0.88",
    "dominantTheme": {
      "type": "collection",
      "key": "mma-fight-kit",
      "label": "MMA Fight Kit",
      "confidence": 0.9
    }
  },
  "opportunities": []
}
```

### Mixed cart — collection completion opportunity

```json
{
  "summary": {
    "status": "mixed",
    "coherenceScore": "0.54",
    "dominantTheme": {
      "type": "collection",
      "key": "boxing-sparring-set",
      "label": "Boxing Sparring Set",
      "confidence": 0.78
    },
    "reason": "Most cart items belong to the Boxing Sparring Set collection. Adding matching headgear would improve visual coherence."
  },
  "opportunities": [
    {
      "type": "collection_completion",
      "productId": "gid://shopify/Product/42",
      "variantId": "gid://shopify/ProductVariant/421",
      "title": "Boxing Headgear Pro",
      "confidence": 0.81,
      "rank": 1,
      "reasonLabel": "Completes the Boxing Sparring Set look",
      "projectedCoherenceScore": "0.82",
      "reasons": [
        {
          "reasonType": "same_collection",
          "confidence": 0.9,
          "source": "SYSTEM",
          "message": "Items belong to the same coordinated collection."
        }
      ]
    }
  ]
}
```

### Clashing cart — swap opportunity with merchant override

```json
{
  "summary": {
    "status": "clashing",
    "coherenceScore": "0.28",
    "reason": "Cart items span incompatible colorways. Swapping the highlighted item would align your cart."
  },
  "opportunities": [
    {
      "type": "swap",
      "productId": "gid://shopify/Product/17",
      "variantId": "gid://shopify/ProductVariant/171",
      "title": "Combat Shorts — Black",
      "confidence": 0.93,
      "rank": 1,
      "reasonLabel": "Better colorway match for your kit",
      "projectedCoherenceScore": "0.71",
      "reasons": [
        {
          "reasonType": "compatible_colorway",
          "confidence": 0.93,
          "source": "MERCHANT",
          "message": "Colorway compatibility rule supports this pairing."
        }
      ]
    }
  ]
}
```

### Ambiguous cart — suppressed (hidden)

```json
{
  "summary": {
    "status": "hidden",
    "coherenceScore": "0.42"
  },
  "opportunities": []
}
```
