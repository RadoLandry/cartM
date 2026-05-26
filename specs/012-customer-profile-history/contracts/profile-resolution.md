# Contract: Profile Resolution

## Purpose

Defines the internal contract for resolving a shopper's effective personalization context from stored profile data, request-time identifiers, and explicit shopper input.

## Input

```ts
interface ResolveCustomerProfileInput {
  shop: string;
  shopifyCustomerId?: string;
  sessionId?: string;
  cartSignals?: {
    disciplineTags?: string[];
    categoryTags?: string[];
    knownSizes?: Record<string, string>;
  };
  browsingSignals?: {
    disciplineTags?: string[];
    productIds?: string[];
    categoryTags?: string[];
  };
  explicitProfile?: {
    discipline?: string;
    experienceLevel?: string;
    weightClass?: string;
    knownSizes?: Record<string, string>;
    priceSensitivity?: "budget" | "mid" | "premium";
  };
}
```

## Input Rules

- At least one of `shopifyCustomerId` or `sessionId` should be supplied when persistence-backed personalization is desired.
- `explicitProfile` fields are optional but authoritative for the attributes they provide.
- Cart and browsing signals may be partial and should not be treated as high-confidence without corroboration.

## Output

```ts
interface ResolvedCustomerProfile {
  profileKey: string;
  identityMode: "customer" | "session" | "anonymous";
  confidence: number;
  guidanceMode: "generic" | "light_personalization" | "strong_personalization";
  disciplinePreferences: Array<{
    key: string;
    score: number;
    source: "explicit" | "purchase_history" | "behavior";
  }>;
  knownSizes: Record<string, string>;
  experienceLevel?: string;
  weightClass?: string;
  priceSensitivity?: "budget" | "mid" | "premium";
  purchaseFrequency?: "one_off" | "occasional" | "repeat" | "high_frequency";
  sourceSummary: Array<{
    attribute: string;
    source: "explicit" | "purchase_history" | "behavior" | "size_profile" | "fallback";
    confidence: number;
  }>;
}
```

## Output Rules

- `identityMode = "customer"` means the resolved profile is anchored to a persistent recognized shopper.
- `identityMode = "session"` means the profile is anonymous but persisted to a current-session identity.
- `identityMode = "anonymous"` means insufficient identity context was provided for persistence-backed reuse.
- `guidanceMode` must soften as confidence drops or signals conflict.
- Explicit values must override conflicting inferred values in the same output.

## Error and Fallback Semantics

- Missing identifiers do not fail resolution; the resolver may return a generic anonymous profile.
- Sparse or conflicting signals must reduce confidence rather than fabricate precision.
- Purchase-history summary is optional at resolution time; if absent, the resolver falls back to stored behavior and explicit signals.