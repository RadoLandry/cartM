# Contract: Style Coherence Evaluation

## Purpose

Defines the internal analysis contract for evaluating cart visual coherence and deriving raw add or swap suggestions before shopper-facing payload shaping.

## Input

```ts
interface StyleCoherenceInput {
  shop: string;
  items: CartVisualItem[];
  compatibilityRules: StyleCompatibilityRule[];
  candidateProducts?: CartVisualItem[];
}

interface CartVisualItem {
  productId: string;
  title: string;
  categoryTags: string[];
  availableForSale: boolean;
  selectedVariantId?: string;
  selectedColorwayKey?: string | null;
  visualProfile: {
    dominantColors: string[];
    effectiveColorwayKeys: string[];
    effectiveCollections: Array<{
      key: string;
      label: string;
      source: "shopify" | "merchant";
    }>;
    visualConfidence: number | null;
  };
}

interface StyleCompatibilityRule {
  sourceColorwayKey: string;
  targetColorwayKey: string;
  compatibility: "MATCHING" | "COMPLEMENTARY" | "NEUTRAL" | "AVOID";
}
```

## Input Rules

- `items` must contain the current cart contents only.
- `candidateProducts` may include potential add or swap targets, but unavailable items must not survive to emitted suggestions.
- Swap evaluation must only consider candidates that preserve at least one category tag shared with the item being replaced.
- Variant-specific colorway context should be supplied through `selectedColorwayKey` when available.

## Output

```ts
interface StyleCoherenceResult {
  coherenceScore: number;
  status: "cohesive" | "mixed" | "clashing";
  reasons: StyleReason[];
  suggestions: StyleSuggestion[];
}

interface StyleReason {
  reasonType:
    | "same_collection"
    | "compatible_colorway"
    | "merchant_override"
    | "fallback_palette_match";
  confidence: number;
  source: "AUTO" | "MERCHANT" | "HYBRID" | "SYSTEM";
  message: string;
  metadata?: Record<string, unknown>;
}

interface StyleSuggestion {
  type: "add" | "swap";
  candidateProductId: string;
  candidateVariantId?: string;
  confidence: number;
  reasons: StyleReason[];
}
```

## Output Rules

- `coherenceScore` is normalized to the range `0..1`.
- `status` reflects the interpreted cart state after scoring.
- `suggestions` is empty when the cart is cohesive, ambiguous, or unsupported by credible candidates.
- `swap` suggestions must preserve category intent.
- `reasons` must be sufficient to explain why the cart scored as cohesive, mixed, or clashing.

## Error and Suppression Semantics

- Missing or low-confidence visual data should reduce confidence and may suppress suggestions entirely.
- Competing dominant themes without a clear winner should return no shopper-facing suggestion.
- Merchant `AVOID` rules must outrank palette-only matching.