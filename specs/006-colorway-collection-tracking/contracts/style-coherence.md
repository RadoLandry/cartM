# Contract: Style Coherence Scoring

## Purpose

Define the input and output contract for deterministic cart-level visual analysis.

## Input

```ts
type CartVisualItem = {
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
};

type StyleCoherenceInput = {
  shop: string;
  items: CartVisualItem[];
  compatibilityRules: Array<{
    sourceColorwayKey: string;
    targetColorwayKey: string;
    compatibility: "MATCHING" | "COMPLEMENTARY" | "NEUTRAL" | "AVOID";
  }>;
};
```

## Output

```ts
type StyleReason = {
  reasonType: "same_collection" | "compatible_colorway" | "merchant_override" | "fallback_palette_match";
  confidence: number;
  source: "auto" | "merchant" | "hybrid";
  details: Record<string, unknown>;
};

type VisualSuggestion = {
  type: "add" | "swap";
  candidateProductId: string;
  candidateVariantId?: string;
  confidence: number;
  reasons: StyleReason[];
};

type StyleCoherenceResult = {
  coherenceScore: number;
  status: "cohesive" | "mixed" | "clashing";
  reasons: StyleReason[];
  suggestions: VisualSuggestion[];
};
```

## Rules

- The scorer must return `cohesive` when the score is high enough that no corrective suggestion is required.
- Suggestions must exclude unavailable products or variants.
- A `swap` suggestion must remain in the shopper's intended product category.
- Every suggestion must include at least one structured reason.