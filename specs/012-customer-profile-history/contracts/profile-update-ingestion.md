# Contract: Profile Update Ingestion

## Purpose

Defines the internal persistence/update contract for recording new profile signals, explicit shopper input, and purchase-summary refreshes.

## Input Shape

```ts
interface ProfileUpdateCommand {
  shop: string;
  shopifyCustomerId?: string;
  sessionId?: string;
  explicitProfile?: {
    discipline?: string;
    experienceLevel?: string;
    weightClass?: string;
    knownSizes?: Record<string, string>;
    priceSensitivity?: "budget" | "mid" | "premium";
  };
  observedBehavior?: {
    disciplineTags?: string[];
    categoryTags?: string[];
    productIds?: string[];
    cartUpdatedAt?: string;
  };
  purchaseSummaryPatch?: {
    recentDisciplines?: Record<string, number>;
    purchaseFrequency?: "one_off" | "occasional" | "repeat" | "high_frequency";
    recentOrderCount?: number;
    lastPurchaseAt?: string;
  };
  mergeAnonymousSessionId?: string;
}
```

## Processing Rules

- The command must target either a recognized shopper or an anonymous session.
- `explicitProfile` updates replace the same fields in stored explicit state but must not erase unrelated persisted summaries.
- `observedBehavior` updates merge into recency-aware behavior summaries instead of overwriting the entire profile.
- `purchaseSummaryPatch` stores only aggregated customer-history information needed for personalization.
- `mergeAnonymousSessionId` is valid only when a `shopifyCustomerId` target exists and should consolidate recent anonymous signals into the identified profile.

## Persistence Guarantees

- Profile updates are idempotent for repeated identical commands.
- Recognized shopper updates persist across sessions.
- Anonymous updates remain isolated to the targeted session profile until merged explicitly.

## Error Semantics

- Invalid commands fail validation before any persistence occurs.
- Missing identifiers result in a no-op or validation error depending on the caller contract.
- Partial failures must not leave duplicate customer/session profile rows for the same identity key.