# Contract: Size Conflict Recommendations

## Purpose

Define the shopper-facing payload built from raw size conflict analysis for cart and checkout consumers.

## Producer

- `app/lib/cart-intelligence/recommendations.ts`

## Consumers

- Storefront cart recommendation surfaces
- Checkout warning surfaces
- Future recommendation API routes that serialize cart-intelligence output

## Payload

```ts
interface SizeConflictRecommendationPayload {
  summary: {
    totalConflicts: number;
    errorCount: number;
    warningCount: number;
    highestSeverity: "ERROR" | "WARNING" | null;
  };
  conflicts: ShopperSizeConflictCard[];
}

interface ShopperSizeConflictCard {
  conflictKey: string;
  severity: "ERROR" | "WARNING";
  title: string;
  message: string;
  affectedItems: Array<{
    productId: string;
    variantId: string;
    categoryTag: string;
    selectedSize: string;
    expectedSize?: string;
  }>;
  primarySuggestion?: ShopperSizeConflictSuggestion;
  additionalSuggestions: ShopperSizeConflictSuggestion[];
}

interface ShopperSizeConflictSuggestion {
  targetItemVariantId: string;
  suggestedSize: string;
  suggestedVariantId?: string;
  availability: "available" | "unavailable" | "unknown";
  confidence: number;
  label: string;
  reason: string;
}
```

## Transformation Rules

1. Only conflicts returned by the canonical detection contract may be transformed.
2. `primarySuggestion` must be omitted when no suggestion has `availability: "available"`.
3. `additionalSuggestions` may include unavailable or unknown candidates for explanatory purposes but must preserve their availability state.
4. Error-level conflicts sort ahead of warning-level conflicts.
5. Within the same severity, conflicts sort deterministically by `conflictKey` unless a stronger product-specific priority is introduced later.
6. The `title` should summarize the mismatch in short shopper-facing language, while `message` carries the fuller explanation.
7. The payload summary must be derivable entirely from the included conflict list.

## Example intent

- Cart drawer: render one banner per `ShopperSizeConflictCard`.
- Checkout: render only `ERROR` cards or the highest-severity subset when space is constrained.
- Chat or AI layer: quote `message` and `primarySuggestion` without recomputing the conflict.
