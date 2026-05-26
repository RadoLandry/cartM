# Data Model: Size Conflict Detection

## Persisted Models Reused By This Feature

This feature reuses the existing schema introduced by the size-intelligence slice. No new Prisma model is required for the initial implementation.

### ProductVariant (existing)

Provides the purchasable size and inventory context required for conflict detection and correction suggestions.

```text
ProductVariant
├── id                 String   @id
├── productId          String
├── shopifyVariantId   String   -- storefront/admin identifier
├── title              String
├── sizeValue          String?  -- selected size label, e.g. "M", "16oz", "32"
├── sizeCategory       String?  -- normalized category family, e.g. "clothing", "gloves_oz"
├── sizeNumeric        Float?   -- numeric interpretation when available
├── inventoryQuantity  Int?
└── imageUrl           String?
```

**Feature role**:
- Supplies the selected or expected size label for each cart line.
- Determines whether a corrective size is actually available before recommending it.
- Supports filtering out unavailable corrections while still preserving the mismatch explanation.

---

### CrossSizeMapping (existing)

Stores expected size correspondence between related product categories.

```text
CrossSizeMapping
├── id                  String   @id @default(cuid())
├── shop                String
├── sourceCategoryTag   String
├── sourceSize          String
├── targetCategoryTag   String
├── targetSize          String
├── severityOnMismatch  SizeConflictSeverity
├── source              SizeChartSource
├── createdAt           DateTime
└── updatedAt           DateTime

@@unique([shop, sourceCategoryTag, sourceSize, targetCategoryTag])
@@index([shop, sourceCategoryTag])
@@index([shop, targetCategoryTag])
```

**Feature role**:
- Remains the authoritative deterministic mapping for cross-category size expectations.
- Encodes whether a mismatch should be treated as `WARNING` or `ERROR`.
- Supplies the expected size used to construct correction candidates.

---

### SizeChart (existing)

Provides normalization and merchant override support for categories that depend on measurement- or weight-based sizing.

```text
SizeChart
├── id                  String   @id @default(cuid())
├── shop                String
├── categoryTag         String
├── sizeSystem          String
├── breakpoints         Json
├── overrideBreakpoints Json?
├── source              SizeChartSource
├── version             Int
├── createdAt           DateTime
└── updatedAt           DateTime

@@unique([shop, categoryTag, sizeSystem])
@@index([shop])
```

**Feature role**:
- Supports normalized sizing rules when category pairs rely on measurements or weight rather than direct string equality.
- Preserves merchant override precedence during both detection and explanation.
- Allows future expansion of weight-based conflict reasoning without a new schema model.

---

### CustomerProfile (existing)

Used only as an optional supporting signal when a cart already has persisted size-profile context.

```text
CustomerProfile
├── id                String   @id @default(cuid())
├── shop              String
├── shopifyCustomerId String?
├── sessionId         String?
├── sizeProfile       Json
├── createdAt         DateTime
└── updatedAt         DateTime
```

**Feature role**:
- Optional source of known sizes or prior fit signals when conflict explanations need additional context.
- Not required for the base deterministic mismatch detection flow.

## Derived Read Models

### CartItemForConflict

The normalized cart line shape passed into the detector.

```ts
interface CartItemForConflict {
  productId: string;
  variantId: string;
  categoryTag: string;
  sizeValue: string;
  sizeCategory: string;
  isChildProduct: boolean;
  title?: string;
  inventoryQuantity?: number | null;
  sizeNumeric?: number | null;
}
```

---

### SizeConflictSuggestion

A structured correction candidate derived from mapping expectations and variant availability.

```ts
interface SizeConflictSuggestion {
  targetItem: "itemA" | "itemB";
  currentVariantId: string;
  currentSize: string;
  suggestedSize: string;
  suggestedVariantId?: string;
  availability: "available" | "unavailable" | "unknown";
  confidence: number;
  reason: string;
}
```

---

### SizeConflict

The canonical conflict record returned by cart analysis.

```ts
interface SizeConflict {
  conflictKey: string;
  severity: "ERROR" | "WARNING";
  itemA: ConflictingItem;
  itemB: ConflictingItem;
  message: string;
  reasonType: "child_adult_mismatch" | "mapped_size_mismatch" | "measurement_rule_mismatch";
  suggestions: SizeConflictSuggestion[];
}
```

**Conflict key rule**:
- Stable across reruns for the same pair and rule type.
- Computed from ordered variant IDs, severity, and rule type.
- Used by downstream surfaces to reconcile resolved versus active conflicts.

---

### SizeConflictResult

Top-level read model used by cart-intelligence consumers.

```ts
interface SizeConflictResult {
  conflicts: SizeConflict[];
  hasErrors: boolean;
  hasWarnings: boolean;
  summary: {
    total: number;
    errorCount: number;
    warningCount: number;
  };
}
```

## Relationships Between Models

```text
ProductVariant ── provides selected size + inventory ──┐
                                                      ├──> CartItemForConflict ──> SizeConflictResult
CrossSizeMapping ── defines expected pairing rules ────┘

SizeChart ── optional normalization / merchant override support ──> conflict explanation and severity logic
CustomerProfile ── optional known-size context ───────────────────> explanation enrichment only
```

## Query Patterns

### Fetch compatibility mappings for a cart pair

```text
SELECT * FROM CrossSizeMapping
WHERE shop = $shop
  AND (
    (sourceCategoryTag = $catA AND targetCategoryTag = $catB) OR
    (sourceCategoryTag = $catB AND targetCategoryTag = $catA)
  )
```

### Resolve an available corrective variant

```text
SELECT id, sizeValue, inventoryQuantity
FROM ProductVariant
WHERE productId = $productId
  AND sizeValue = $expectedSize
LIMIT 1
```

### Load merchant-admin compatibility state

```text
SELECT * FROM SizeChart WHERE shop = $shop ORDER BY categoryTag, sizeSystem;
SELECT * FROM CrossSizeMapping WHERE shop = $shop ORDER BY sourceCategoryTag, sourceSize;
SELECT DISTINCT sizeCategory FROM ProductVariant WHERE product.shop = $shop;
```

## Migration Impact

No new Prisma migration is required for the initial implementation if the current schema from the size-intelligence feature is already applied. If downstream implementation reveals a missing supporting index for variant-availability lookup, that can be added as a focused follow-up migration without changing the core data model.
