# Contract: Merchant Visual Admin

## Purpose

Defines the existing merchant-side contract boundaries that style matching depends on for approved visual merchandising data.

## Loader Responsibilities

The knowledge-graph route must provide:

```ts
interface MerchantVisualAdminLoaderData {
  visualProfiles: Array<{
    id: string;
    productId: string;
    title: string;
    handle: string;
    detectedColorwayKeys: string[];
    effectiveColorwayKeys: string[];
    detectedCollections: CollectionSummary[];
    effectiveCollections: CollectionSummary[];
    visualConfidence: number | null;
    reviewStatus: "NEEDS_REVIEW" | "AUTO_APPROVED" | "MERCHANT_REVIEWED";
    source: "AUTO" | "MERCHANT" | "HYBRID";
  }>;
  compatibilityRules: Array<{
    id: string;
    sourceColorwayKey: string;
    targetColorwayKey: string;
    compatibility: "MATCHING" | "COMPLEMENTARY" | "NEUTRAL" | "AVOID";
    source: "AUTO" | "MERCHANT" | "HYBRID";
    rationale: string | null;
  }>;
}
```

## Action Responsibilities

The admin route must continue to support:

- Saving effective colorway overrides for a product.
- Saving effective collection overrides for a product.
- Creating compatibility rules.
- Deleting compatibility rules.
- Resetting product visual overrides.

## Validation Rules

- Colorway keys must be normalized before persistence.
- Empty override input means fall back to detected values, not a broken visual profile.
- Compatibility rules must reject blank source or target keys.
- Merchant overrides remain authoritative over auto-derived profile values.

## Dependency on Style Matching

The shopper-facing style slice assumes:

- Effective colorway keys from this route are the same values consumed by style scoring.
- Effective collections from this route are the same values used to detect collection completion opportunities.
- Merchant compatibility rules and avoid rules are applied before any fallback palette heuristics.

## Optional Preview Extension

If implementation adds merchant preview support, the preview response should reuse the shopper-facing style payload contract rather than inventing a separate explanation format.