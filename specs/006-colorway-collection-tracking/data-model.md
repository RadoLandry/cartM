# Data Model: Colorway & Collection Tracking

## New Prisma Models

### ProductVisualProfile

Stores derived and merchant-curated visual data for a synced product. One row per product.

```text
ProductVisualProfile
├── id                    String   @id @default(cuid())
├── productId             String   @unique
├── shop                  String
├── dominantColors        Json     -- normalized palette array copied from extraction stage
├── detectedColorwayKeys  String[] -- e.g. ["black-gold", "matte-black"]
├── overrideColorwayKeys  String[] -- merchant-set replacement, empty when none
├── detectedCollections   Json     -- array of { shopifyCollectionId, handle, title }
├── overrideCollections   Json?    -- merchant-defined effective collection groups
├── visualConfidence      Float?
├── reviewStatus          VisualReviewStatus @default(NEEDS_REVIEW)
├── source                VisualProfileSource @default(AUTO)
├── extractionSummary     Json?    -- signal provenance and parsing notes
├── createdAt             DateTime @default(now())
└── updatedAt             DateTime @updatedAt

@@index([shop, reviewStatus])
@@index([shop, visualConfidence])
```

**Effective values**
- Effective colorway keys = `overrideColorwayKeys` when non-empty, otherwise `detectedColorwayKeys`
- Effective collections = `overrideCollections` when non-null, otherwise `detectedCollections`

---

### ColorCompatibilityRule

Shop-level rule table for explicit matching or complementary colorway behavior.

```text
ColorCompatibilityRule
├── id                 String   @id @default(cuid())
├── shop               String
├── sourceColorwayKey  String   -- normalized, e.g. "black-gold"
├── targetColorwayKey  String   -- normalized, e.g. "black"
├── compatibility      ColorCompatibility
├── source             VisualProfileSource @default(MERCHANT)
├── rationale          String?
├── createdAt          DateTime @default(now())
└── updatedAt          DateTime @updatedAt

@@unique([shop, sourceColorwayKey, targetColorwayKey])
@@index([shop, sourceColorwayKey])
@@index([shop, targetColorwayKey])
```

Rules are directional only when the merchant chooses to differentiate them. The scorer normalizes or mirrors rules during evaluation where appropriate.

---

## Enum Extensions

```text
enum VisualProfileSource {
  AUTO
  MERCHANT
  HYBRID
}

enum VisualReviewStatus {
  NEEDS_REVIEW
  AUTO_APPROVED
  MERCHANT_REVIEWED
}

enum ColorCompatibility {
  MATCHING
  COMPLEMENTARY
  NEUTRAL
  AVOID
}
```

Optional extension to the existing relationship evidence enum:

```text
enum EvidenceType {
  ...
  COLORWAY
}
```

This lets `ProductRelationship` and future recommendation analytics reuse the same evidence vocabulary.

---

## Existing Model Usage and Extensions

### Product (existing)

The existing `Product` model remains the raw catalog record and continues storing:
- `dominantColors`: the raw extracted palette written during ingestion
- `collectionIds`: Shopify-derived collection membership from the Admin API

No merchant override data is stored directly on `Product`.

### ProductRelationship (existing)

`RelationshipType.SAME_COLLECTION` remains valid, but future relationship generation should prefer the effective collection data from `ProductVisualProfile` over raw Shopify collection IDs when merchant overrides exist.

### Shopify product normalization (existing)

The current normalized collection data in [app/lib/knowledge-graph/normalization.ts](c:\Users\Landry\Documents\CARTMIND\cart-mind\app\lib\knowledge-graph\normalization.ts#L1) is extended from `collectionIds: string[]` to a richer collection summary object during ingestion, while preserving field-minimal GraphQL usage.

---

## Relationships Between Models

```text
Product 1────1 ProductVisualProfile
ProductVisualProfile N────M ColorCompatibilityRule (resolved by effective colorway keys)
ProductVisualProfile ────feeds──── style-coherence scorer and collection recommendation logic
```

Compatibility rules are matched by normalized colorway keys, not foreign keys to products, so merchants can define reusable shop-level semantics across the catalog.

---

## Query Patterns

### Admin review list

```text
SELECT Product, ProductVisualProfile
WHERE shop = $shop
ORDER BY reviewStatus ASC, visualConfidence ASC, updatedAt DESC
LIMIT 50
```

### Effective visual profile resolution

```text
Load Product + ProductVisualProfile
effectiveColorways = overrideColorwayKeys if not empty else detectedColorwayKeys
effectiveCollections = overrideCollections if present else detectedCollections
```

### Cart style-coherence evaluation

```text
Load cart products + profiles + matching color compatibility rules
Compute weighted score from:
- shared effective collection groups
- explicit compatibility rules
- palette similarity from dominantColors
- shared taxonomy/category context
Emit recommendation objects only when confidence >= threshold
```