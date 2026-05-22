# Quickstart: Colorway & Collection Tracking

## What This Feature Adds

- A derived `ProductVisualProfile` layer for normalized colorways, collections, confidence, and merchant overrides
- A `ColorCompatibilityRule` table for explicit shop-level matching and complementary colorway rules
- An extended `app/lib/knowledge-graph/colorways.ts` pipeline for palette extraction and colorway normalization
- A `style-coherence` scorer for collection completion and swap recommendations
- A `Colorways` tab in the existing knowledge-graph admin route for merchant review and corrections

## Local Development Setup

### 1. Run the database migration

```bash
npx prisma migrate dev --name add_colorway_collection_tracking
```

Expected new tables: `ProductVisualProfile`, `ColorCompatibilityRule`.

### 2. Backfill visual profiles for the existing catalog

Run the feature backfill to derive visual profiles from already-synced products.

```bash
npx tsx scripts/backfill-colorway-profiles.ts --shop <myshopify-domain>
```

This script should:
- rebuild `ProductVisualProfile` rows from `Product`, variants, tags, metafields, and images
- preserve existing merchant overrides if the profile already exists
- mark low-confidence profiles for admin review

### 3. Start the app and review the admin tab

```bash
npm run dev
```

Navigate to **Knowledge Graph → Colorways** in the Shopify Admin. Confirm that:
- products render with detected colorways and collection labels
- low-confidence items are surfaced first
- merchant overrides can be saved without leaving the page
- compatibility rules can be created or deleted and immediately affect later visual scoring

### 4. Run the focused tests

```bash
npx tsc --noEmit
npx vitest run tests/unit/knowledge-graph/colorways.test.ts
npx vitest run tests/unit/cart-intelligence/style-coherence.test.ts
npx vitest run tests/integration/routes/knowledge-graph-colorways.test.ts
```

## Key Files

| File | Purpose |
|---|---|
| `prisma/schema.prisma` | `ProductVisualProfile` and `ColorCompatibilityRule` definitions |
| `app/lib/knowledge-graph/colorways.ts` | palette extraction, colorway normalization, effective profile resolution |
| `app/lib/knowledge-graph/ingestion.ts` | sync and backfill integration for visual profiles |
| `app/lib/cart-intelligence/style-coherence.ts` | cart-level visual scoring and suggestion generation |
| `app/routes/app.knowledge-graph.tsx` | merchant review UI and actions for colorway corrections |
| `app/lib/db/queries.ts` | query helpers for profiles, overrides, and compatibility rules |
| `scripts/backfill-colorway-profiles.ts` | one-time or maintenance rebuild of visual profiles |

## Common Tasks

### Review low-confidence visual profiles

Open the `Colorways` tab and filter to `NEEDS_REVIEW`. Confirm or adjust the effective colorways and collection groupings for each product.

### Add a complementary colorway rule

In the admin rule editor, create a rule such as `black-gold -> black = COMPLEMENTARY` with an optional merchant rationale. The style scorer should use this immediately in future recommendations.

### Rebuild profiles after collection taxonomy changes

```bash
npx tsx scripts/backfill-colorway-profiles.ts --shop <myshopify-domain> --recompute
```

Use this after major collection or metafield cleanup so auto-generated profiles match the latest catalog data while preserving merchant overrides.