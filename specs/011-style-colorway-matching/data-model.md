# Data Model: Style & Colorway Matching

## Schema Impact

No new Prisma models are required for the v1 shopper-facing style-matching slice. The feature reuses the visual merchandising state already persisted for colorway tracking and adds runtime projection models for cart analysis and shopper payload shaping.

## Existing Persisted Entities Reused

### ProductVisualProfile

Existing source of truth for effective visual data per product.

```text
ProductVisualProfile
├── productId
├── dominantColors
├── detectedColorwayKeys
├── overrideColorwayKeys
├── detectedCollections
├── overrideCollections
├── visualConfidence
├── reviewStatus
├── source
└── extractionSummary
```

**Role in this feature**
- Supplies the effective colorway keys and collection groups used during cart scoring.
- Preserves merchant overrides so shopper-facing style guidance follows approved merchandising intent.

---

### ColorCompatibilityRule

Existing shop-level rule table for explicit visual compatibility between colorway keys.

```text
ColorCompatibilityRule
├── sourceColorwayKey
├── targetColorwayKey
├── compatibility
├── source
└── rationale
```

**Role in this feature**
- Overrides default palette-only matching.
- Allows merchants to mark pairings as matching, complementary, neutral, or avoid.

---

### Product and ProductVariant

Existing catalog records used to hydrate cart lines and recommendation candidates.

```text
Product
├── id
├── title
├── disciplineTags
├── categoryTags
├── dominantColors
└── status

ProductVariant
├── id
├── productId
├── title
├── price
├── inventoryQuantity
└── imageUrl
```

**Role in this feature**
- Provides the shopper-visible title, category role, availability, and selected variant context needed for add and swap suggestions.

## Runtime Projection Models

### CartVisualLine

Represents one shopper cart line normalized for style analysis.

```text
CartVisualLine
├── productId
├── selectedVariantId?
├── title
├── categoryTags[]
├── availableForSale
├── selectedColorwayKey?
└── visualProfile
    ├── dominantColors[]
    ├── effectiveColorwayKeys[]
    ├── effectiveCollections[]
    └── visualConfidence?
```

**Validation rules**
- `productId` is required.
- `categoryTags` must contain at least one product role for swap preservation.
- `selectedColorwayKey` wins over product-level keys when present.

---

### DominantVisualTheme

Derived representation of the strongest visual theme currently present in the cart.

```text
DominantVisualTheme
├── themeType           "collection" | "colorway" | "mixed"
├── key
├── label
├── supportingItemIds[]
├── confidence
└── source              "system" | "merchant"
```

**Purpose**
- Explains whether the cart is cohering around a collection, a compatible colorway family, or no strong theme.
- Drives suppression when multiple themes are tied or confidence is low.

---

### StyleSuggestionCandidate

Candidate add or swap item evaluated against the cart's dominant visual context.

```text
StyleSuggestionCandidate
├── productId
├── variantId?
├── title
├── suggestionType      "add" | "swap"
├── categoryRole
├── availableForSale
├── confidence
├── projectedScore?
└── reasons[]
```

**Validation rules**
- `swap` candidates must share at least one category tag with the cart item they would replace.
- Duplicate products already in the cart are excluded unless explicitly permitted by future policy.
- Unavailable candidates are filtered before ranking.

---

### StyleRecommendationResult

Structured shopper-facing output for cart surfaces.

```text
StyleRecommendationResult
├── summary
│   ├── status          "hidden" | "cohesive" | "mixed" | "clashing"
│   ├── coherenceScore
│   ├── dominantTheme?
│   └── reason?
└── opportunities[]
    ├── type            "collection_completion" | "swap"
    ├── productId
    ├── variantId?
    ├── title
    ├── confidence
    ├── reasonLabel
    ├── reasons[]
    └── projectedCoherenceScore?
```

**Purpose**
- Gives storefront consumers a stable payload for subtle add and swap suggestions.
- Preserves enough reasoning to explain whether a result came from collection completion, merchant compatibility, or soft palette matching.

## Relationships

```text
Product 1────1 ProductVisualProfile
ProductVariant N────1 Product
ColorCompatibilityRule ────applies-to──── effective colorway keys
CartVisualLine ────hydrates-from──── Product + ProductVariant + ProductVisualProfile
StyleSuggestionCandidate ────derived-from──── candidate Product/ProductVariant + DominantVisualTheme
StyleRecommendationResult ────built-from──── StyleCoherenceResult + ranked candidates
```

## Query Shapes

### Cart hydration

```text
Load cart product IDs + selected variant IDs
Join Product, ProductVariant, and ProductVisualProfile
Resolve effective collections and effective colorway keys
```

### Candidate pool hydration

```text
Load in-stock products in relevant categories/disciplines for the current cart
Join ProductVisualProfile and variant availability
Exclude cart duplicates and low-confidence visual records when needed
```

### Shopper payload shaping

```text
Input: StyleCoherenceResult + hydrated candidate records
Output: StyleRecommendationResult with summary + ranked opportunities
```

## Migration Notes

- No schema migration is planned for this feature unless implementation exposes a missing variant-level visual field that cannot be derived from existing records.
- If a later iteration needs analytics or preview persistence for style recommendations, that should be added as a separate schema change rather than folded into this slice.