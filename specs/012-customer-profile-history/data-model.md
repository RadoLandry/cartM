# Data Model: Customer Profile & History

## Schema Impact

This feature expands the existing `CustomerProfile` persistence model and introduces runtime projection models for personalization resolution. The design intentionally avoids a second profile table for v1.

## Persisted Entities

### CustomerProfile

Existing persistence anchor reused and expanded for broader shopper personalization.

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

**Field roles**
- `sizeProfile`: Existing JSON map of category-to-size preferences; remains the source for saved size signals.
- `disciplineProfile`: JSON summary of inferred discipline interests and their relative strength or recency.
- `explicitProfile`: JSON map of shopper-stated values such as discipline, experience level, weight class, and explicit size context.
- `purchaseSummary`: JSON summary of repeat-purchase counts, recent categories, and replenishment-relevant history.
- `behaviorSummary`: JSON summary of recent session/cart/browsing signals useful for anonymous and returning shoppers.
- `confidenceSummary`: JSON summary of confidence and freshness metadata used to soften or suppress personalization.
- `lastActiveAt`: Timestamp used to age stale signals and distinguish old history from current mission.

**Validation rules**
- Exactly one of `shopifyCustomerId` or `sessionId` is required for a persisted row.
- `shop + shopifyCustomerId` and `shop + sessionId` remain unique identity keys.
- `explicitProfile` values override matching inferred values at resolution time but do not erase unrelated inferred summaries.

## Runtime Projection Models

### ProfileSignalEnvelope

Normalized set of inputs considered during profile resolution.

```text
ProfileSignalEnvelope
├── shop
├── shopifyCustomerId?
├── sessionId?
├── cartSignals
├── browsingSignals
├── explicitInput?
├── storedProfile?
└── purchaseSummary?
```

**Purpose**
- Collects request-time and stored signals into one deterministic input for the profile resolver.
- Keeps route code thin and testable.

---

### ResolvedCustomerProfile

Recommendation-ready shopper context derived from stored and request-time signals.

```text
ResolvedCustomerProfile
├── profileKey
├── identityMode           "customer" | "session" | "anonymous"
├── disciplinePreferences[]
├── knownSizes
├── experienceLevel?
├── weightClass?
├── priceSensitivity?
├── purchaseFrequency?
├── confidence
├── recencyState           "fresh" | "aging" | "stale"
├── sourceSummary
└── guidanceMode           "generic" | "light_personalization" | "strong_personalization"
```

**Purpose**
- Gives downstream recommendation features a single typed personalization input.
- Makes confidence and freshness explicit so other modules can soften guidance when signals are unreliable.

---

### PersonalizationSourceSummary

Derived metadata explaining where a resolved attribute came from.

```text
PersonalizationSourceSummary
├── attribute
├── source                 "explicit" | "purchase_history" | "behavior" | "size_profile" | "fallback"
├── confidence
└── updatedAt?
```

**Purpose**
- Supports auditability in tests and future explanation surfaces.
- Helps downstream logic distinguish declared preferences from inferred ones.

---

### ProfileUpdateCommand

Normalized mutation payload used when persisting new profile signals.

```text
ProfileUpdateCommand
├── shop
├── shopifyCustomerId?
├── sessionId?
├── explicitInput?
├── observedBehavior?
├── purchaseSummaryPatch?
└── mergeAnonymousSessionId?
```

**Validation rules**
- Mutations must identify either a customer or a session target.
- `mergeAnonymousSessionId` is allowed only when a `shopifyCustomerId` target is present.
- Purchase summary patches update summary fields only; they do not persist raw order payloads.

## Relationships

```text
CustomerProfile ────identified-by──── shopifyCustomerId or sessionId
ProfileSignalEnvelope ────resolves-to──── ResolvedCustomerProfile
ProfileUpdateCommand ────writes-to──── CustomerProfile
ResolvedCustomerProfile ────feeds──── recommendation builders and sizing helpers
```

## Query Shapes

### Profile lookup

```text
Input: shop + shopifyCustomerId? + sessionId?
Priority: identified customer row first, then anonymous session row
Output: persisted CustomerProfile summary fields
```

### Anonymous-to-identified merge

```text
Input: shop + identified customer key + anonymous session key
Read both profiles
Merge size, behavior, and recent session signals forward
Persist a single updated identified row
```

### Purchase-summary refresh

```text
Input: shop + shopifyCustomerId
Fetch field-minimal customer/order summary outside shopper request path
Persist summary counts, recency, and category/discipline aggregates
```

## Migration Notes

- A Prisma migration is required to expand `CustomerProfile` beyond `sizeProfile`.
- The feature intentionally stores summary data, not raw browsing or raw order history payloads.
- If later work needs event-level analytics or replenishment scheduling, those should be added as separate tables rather than overloading the profile row further.