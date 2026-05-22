# Quickstart: Kit Completeness Detection

## What This Feature Adds

- A `KitDefinition` and `KitRequirement` layer for merchant-editable kit templates
- A deterministic `kit-detection` scorer for inferred discipline, completeness score, and missing-item ranking
- A `Kits` tab in the existing knowledge-graph route for managing required items, priorities, and substitutes
- A backfill script to seed default kits from current taxonomy and relationship data

## Local Development Setup

### 1. Run the database migration

```bash
npx prisma migrate dev --name add_kit_completeness_detection
```

Expected new tables: `KitDefinition`, `KitRequirement`.

### 2. Seed default kit definitions for a shop

```bash
npx tsx scripts/backfill-kit-definitions.ts --shop <myshopify-domain>
```

This script should:
- create starter kit definitions for the supported disciplines
- derive default requirement ordering from existing taxonomy and `COMPLEMENTS` relationships
- preserve merchant-edited kit definitions unless `--reseed` is explicitly requested

### 3. Start the app and review the admin tab

```bash
npm run dev
```

Navigate to **Knowledge Graph → Kits** in the Shopify Admin. Confirm that:
- active kit definitions load with their requirements and priorities
- required and optional slots can be edited
- substitute products or accepted categories can be added and saved
- updates change later kit-assessment output without leaving the page

### 4. Run the focused tests

```bash
npx tsc --noEmit
npx vitest run tests/unit/knowledge-graph/kits.test.ts
npx vitest run tests/unit/cart-intelligence/kit-detection.test.ts
npx vitest run tests/integration/routes/knowledge-graph-kits.test.ts
```

## Key Files

| File | Purpose |
|---|---|
| `prisma/schema.prisma` | `KitDefinition` and `KitRequirement` definitions |
| `app/lib/knowledge-graph/kits.ts` | default templates, fulfillment helpers, and reason construction |
| `app/lib/cart-intelligence/kit-detection.ts` | deterministic kit inference and completeness scoring |
| `app/lib/cart-intelligence/recommendations.ts` | recommendation orchestration for missing kit items |
| `app/routes/app.knowledge-graph.tsx` | merchant review UI and actions for kit definitions |
| `app/lib/db/queries.ts` | query helpers for kit CRUD and lookup |
| `scripts/backfill-kit-definitions.ts` | starter kit seeding and maintenance rebuild |

## Common Tasks

### Add a new required slot to a kit

Open the `Kits` tab, select a kit definition, add a requirement such as `mouthguard`, mark it as required, and place it ahead of optional accessories in priority order.

### Register a substitute product

For a requirement that can be fulfilled by multiple SKUs, add accepted product IDs or alternate-category coverage so the scorer does not flag the slot as missing when a substitute is already present.

### Reseed defaults after taxonomy cleanup

```bash
npx tsx scripts/backfill-kit-definitions.ts --shop <myshopify-domain> --reseed
```

Use this only when you want to refresh auto-generated starter kits after major taxonomy or relationship cleanup. Merchant-edited kits should otherwise remain untouched.