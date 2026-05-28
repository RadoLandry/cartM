# Data Model: Replenishment Prediction

## Schema Impact

This feature keeps `CustomerProfile` as the recognized/session shopper anchor, but adds dedicated replenishment persistence for lifecycle rules and item-level purchase snapshots. The design avoids raw order replication while preserving enough history for due-window evaluation.

## Persisted Entities

### CustomerProfile

Existing shopper identity anchor reused for profile lookup, recency, and high-level cadence context.

```text
CustomerProfile
├── id
├── shop
├── shopifyCustomerId?
├── sessionId?
├── sizeProfile
├── disciplineProfile
├── explicitProfile
├── purchaseSummary
├── behaviorSummary
├── confidenceSummary
├── lastActiveAt
├── createdAt
└── updatedAt
```

**Field roles for this feature**
- `purchaseSummary`: Stores shopper-level replenishment summaries such as last replenishment evaluation time, total eligible replenishment categories, and shopper cadence hints.
- `confidenceSummary`: Stores shopper-level replenishment confidence or suppression metadata that can soften reminders.
- `lastActiveAt`: Helps distinguish fresh cadence signals from stale purchase history.

---

### ReplenishmentLifecycleRule

Per-shop lifecycle timing rule for an eligible category.

```text
ReplenishmentLifecycleRule
├── id
├── shop
├── categoryTag
├── label
├── windowMinDays
├── windowMaxDays
├── priority
├── defaultAction         "reorder" | "upgrade_optional"
├── source                "seeded" | "merchant"
├── isActive
├── createdAt
└── updatedAt
```

**Validation rules**
- `shop + categoryTag` is unique for active evaluation.
- `windowMinDays` must be greater than 0.
- `windowMaxDays` must be greater than or equal to `windowMinDays`.
- `priority` must be stable enough to rank safety-critical categories ahead of optional accessories.

---

### CustomerPurchaseSnapshot

Normalized local summary of a recognized shopper's purchasable replenishment candidate.

```text
CustomerPurchaseSnapshot
├── id
├── shop
├── shopifyCustomerId
├── productId
├── variantId?
├── categoryTag
├── firstPurchasedAt
├── lastPurchasedAt
├── lastOrderId?
├── orderCount
├── totalQuantity
├── latestTitle
├── latestVariantTitle?
├── currencyCode?
├── lastUnitPrice?
├── inferredCadenceDays?
├── preferredAction       "reorder" | "upgrade"
├── createdAt
└── updatedAt
```

**Validation rules**
- Each row must reference a recognized shopper (`shopifyCustomerId`) and an eligible purchased product.
- `orderCount` must be at least 1.
- `totalQuantity` must be at least 1 and increases idempotently on repeated ingestion of the same normalized order event.
- `inferredCadenceDays` is optional and set only when repeated history supports a shopper-specific cadence.

## Runtime Projection Models

### ReplenishmentEvaluationInput

Joined input required to compute due-window status for a shopper.

```text
ReplenishmentEvaluationInput
├── shop
├── shopifyCustomerId
├── profile
├── purchaseSnapshots[]
├── lifecycleRules[]
└── candidateProducts[]
```

**Purpose**
- Ensures replenishment evaluation is fully local and deterministic.
- Separates data loading from ranking logic.

---

### ReplenishmentCandidate

Derived evaluation record for one purchased item.

```text
ReplenishmentCandidate
├── candidateKey
├── productId
├── variantId?
├── categoryTag
├── dueState                "not_due" | "approaching" | "due" | "suppressed"
├── expectedReplacementAt
├── confidence
├── urgencyScore
├── preferredAction         "reorder" | "upgrade"
├── reorderTarget?
├── upgradeTarget?
└── reasons[]
```

**Purpose**
- Captures whether an item should be surfaced and what action path is viable.
- Allows the recommendation builder to separate ranking from payload formatting.

---

### RefreshCartSuggestion

Grouped shopper-facing action composed from one or more due candidates.

```text
RefreshCartSuggestion
├── suggestionKey
├── shopperId
├── actions[]
├── totalDueItems
├── highestPriorityCategory
└── message
```

**Purpose**
- Supports one-click or low-friction cart rebuilding when multiple items are due together.

## Relationships

```text
CustomerProfile ────identified-by──── shopifyCustomerId or sessionId
CustomerProfile ────owns-many──── CustomerPurchaseSnapshot
ReplenishmentLifecycleRule ────matches──── CustomerPurchaseSnapshot.categoryTag
CustomerPurchaseSnapshot + ReplenishmentLifecycleRule + local catalog data ────resolve-to──── ReplenishmentCandidate
ReplenishmentCandidate[] ────assemble-into──── RefreshCartSuggestion
```

## Query Shapes

### Shopper replenishment lookup

```text
Input: shop + shopifyCustomerId
Read: recognized CustomerProfile + matching CustomerPurchaseSnapshot rows + active ReplenishmentLifecycleRule rows + local product/variant availability
Output: ranked due or approaching replenishment candidates
```

### Incremental order ingestion

```text
Input: authenticated order webhook payload
Normalize: customer identity, purchased products, quantities, processed timestamp
Write: upsert CustomerPurchaseSnapshot rows + refresh high-level CustomerProfile.purchaseSummary fields
```

### Historical backfill

```text
Input: shop + customer/order cursor
Fetch: field-minimal order history outside shopper request path
Write: same normalized snapshot shape as webhook ingestion
```

## Migration Notes

- A Prisma migration is required to add `ReplenishmentLifecycleRule` and `CustomerPurchaseSnapshot`.
- `CustomerProfile` stays intact; only high-level replenishment summary keys are added to existing JSON fields.
- Raw order payloads remain out of scope; only normalized, replenishment-relevant purchase snapshots are stored locally.