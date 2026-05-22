# Quickstart: Size & Fit Intelligence

## What This Feature Adds

- `SizeChart` and `CrossSizeMapping` database tables for per-category size data
- `SizeReturnRecord` table for future return-data feedback
- `app/lib/knowledge-graph/sizing.ts` — size recommendation and conflict detection logic
- `app/lib/cart-intelligence/size-conflicts.ts` — cart-level conflict orchestration
- A "Size Charts" tab in the existing knowledge-graph admin route
- Controlled `sizeCategory` vocabulary for `ProductVariant`

## Local Development Setup

### 1. Run the database migration

After pulling this feature branch, create and apply the new Prisma migration:

```bash
npx prisma migrate dev --name add_size_fit_intelligence
```

Expected new tables: `SizeChart`, `CrossSizeMapping`, `SizeReturnRecord`.

### 2. Seed default size charts

A seed script populates baseline size charts for common combat sports categories (boxing gloves by oz, shorts by waist, and apparel by S/M/L/XL). Run it after migrating:

```bash
npx tsx scripts/seed-size-charts.ts
```

This script creates `AUTO` source `SizeChart` rows for `gloves_oz`, `clothing`, and `shorts_waist` category tags, and seeds the standard adult cross-size mappings (`clothing ↔ clothing`, `shorts_waist ↔ clothing`).

### 3. Verify the admin tab

Start the dev server and navigate to **Knowledge Graph → Size Charts** in the Shopify Admin to confirm the tab renders and size chart rows are present.

```bash
npm run dev
```

### 4. Test a recommendation

Use the Vitest suite to confirm the recommendation lookup works end-to-end:

```bash
npx vitest run tests/unit/knowledge-graph/sizing.test.ts
```

### 5. Test conflict detection

```bash
npx vitest run tests/unit/knowledge-graph/size-conflicts.test.ts
```

---

## Key Files

| File | Purpose |
|---|---|
| `prisma/schema.prisma` | `SizeChart`, `CrossSizeMapping`, `SizeReturnRecord` model definitions |
| `app/lib/knowledge-graph/sizing.ts` | `getSizeRecommendation()`, `seedDefaultSizeCharts()` |
| `app/lib/cart-intelligence/size-conflicts.ts` | `detectSizeConflicts()` |
| `app/routes/app.knowledge-graph.tsx` | Size Charts admin tab (loader + actions) |
| `scripts/seed-size-charts.ts` | One-time default chart seeding |
| `tests/unit/knowledge-graph/sizing.test.ts` | Unit tests for recommendation logic |
| `tests/unit/knowledge-graph/size-conflicts.test.ts` | Unit tests for conflict detection |
| `tests/integration/routes/knowledge-graph-sizing.test.ts` | Admin action integration tests |

---

## Common Tasks

### Add a new size chart for a custom category

In the admin UI, navigate to **Knowledge Graph → Size Charts** and use the "Add chart" action. Set the `categoryTag` to match the value used in `ProductVariant.sizeCategory` for that product type.

### Override a size chart for a brand that runs large

In the admin UI, select the chart row and click "Override". Edit the breakpoint ranges and save. The override takes effect immediately for all new recommendations. To revert, use the "Reset to default" action.

### Add a cross-size mapping

Navigate to the **Cross-Size Mappings** section within the Size Charts tab. Use "Add mapping" to define an expected size correspondence between two category tags.

### Manually trigger a return-data adjustment run

```bash
npx tsx scripts/run-size-chart-adjustment.ts --shop <myshopify-domain>
```

This processes unprocessed `SizeReturnRecord` rows and adjusts `breakpoints` for categories that meet the minimum sample threshold.
