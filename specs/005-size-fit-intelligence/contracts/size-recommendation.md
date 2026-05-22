# Contract: Size Recommendation Read Model

This contract describes the interface consumed by the cart widget, the conversational AI, and the checkout extension to request size recommendations for a product.

## Consumer

- Cart intelligence layer (`app/lib/knowledge-graph/sizing.ts`)
- Conversational AI tool (`app/lib/ai/tools.ts` — `getSizeRecommendation` tool)

---

## Input

```typescript
interface SizeRecommendationRequest {
  shop: string;
  productId: string;       // internal CartMind product ID
  categoryTag: string;     // e.g., "gloves_oz", "clothing", "shorts_waist"
  sizeSystem: string;      // e.g., "gloves_oz", "clothing"
  customerAttributes?: {
    weightKg?: number;
    chestCm?: number;
    waistCm?: number;
    weightClass?: string;  // e.g., "lightweight", "middleweight"
  };
  knownSizes?: Record<string, string>; // categoryTag → known size label from profile
}
```

## Output

```typescript
interface SizeRecommendationResult {
  recommended: string | null;  // size label (e.g., "M", "14oz") or null if unavailable
  rationale: string | null;    // human-readable explanation (e.g., "Recommended for your weight class")
  confidence: "high" | "medium" | "low";
  source: "profile" | "chart" | "none";
  alternatives?: string[];     // adjacent sizes if confidence < high
}
```

## Behaviour Rules

1. If `knownSizes[categoryTag]` is present → return it with `source: "profile"` and `confidence: "high"`.
2. If a `SizeChart` row exists for `(shop, categoryTag, sizeSystem)` and a matching customer attribute is provided → perform breakpoint lookup and return result with `source: "chart"`.
3. If the customer attribute falls on a boundary between two breakpoints → return the larger size with `confidence: "medium"` and include both sizes in `alternatives`.
4. If no chart or profile data is available → return `{ recommended: null, rationale: null, confidence: "low", source: "none" }`. Never guess or fabricate a size label.
5. Merchant `overrideBreakpoints` MUST be used instead of `breakpoints` when present.

## Error Conditions

| Condition | Behaviour |
|---|---|
| `categoryTag` not found in any `SizeChart` | Return `source: "none"`, `recommended: null` |
| Customer attributes missing for a chart-based lookup | Return `source: "none"`, `recommended: null` |
| Invalid `sizeSystem` value | Reject at the boundary with a validation error |
