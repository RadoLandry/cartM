# Quickstart: Size Conflict Detection

## What This Feature Adds

- Richer deterministic cart-level size conflict detection on top of the existing `CrossSizeMapping` model
- A normalized `SizeChart`-backed fallback rule (`measurement_rule_mismatch`) for category pairs that share a `sizeSystem` but have no explicit mapping
- Structured correction suggestions that respect variant availability (never promote an out-of-stock or nonexistent size as the primary action)
- Shopper-facing size conflict recommendation payloads for cart and checkout consumers
- A merchant "Preview Compatibility" control in the Knowledge Graph admin for read-only, non-persisting rule testing
- Regression and integration coverage for conflict detection, payload building, and admin mapping workflows

## Local Development Setup

### 1. Confirm the size-intelligence schema is applied

This feature reuses the existing size-intelligence tables. If your local database is not current, apply pending Prisma migrations first:

```bash
npx prisma migrate dev
```

### 2. Start the app

```bash
npm run dev
```

Navigate to **Knowledge Graph** in the embedded admin and confirm the existing **Size Charts** and **Cross-Size Mappings** sections load.

### 3. Run the focused unit tests

Current and planned validation for this feature lives in targeted size-conflict suites:

```bash
npx vitest run tests/unit/knowledge-graph/size-conflicts.test.ts
```

After implementation expands payload building, run the corresponding cart-intelligence test slice:

```bash
npx vitest run tests/unit/cart-intelligence/size-conflict-recommendations.test.ts
```

### 4. Run the admin integration slice

```bash
npx vitest run tests/integration/routes/knowledge-graph-size-conflicts.test.ts
```

### 5. Verify a mapping-driven conflict manually

Use the Knowledge Graph admin to create or confirm a `CrossSizeMapping` for a known pair, then run the focused unit tests or a local fixture against `detectSizeConflicts` to confirm:
- the mismatch is detected
- the severity is correct
- the preferred correction is only shown when the expected size is available

### 6. Try the admin "Preview Compatibility" control

In the **Size Charts** tab, use the **Preview Compatibility** card to test a source/target category + size pair. This calls the `preview-cross-size-conflict` action and renders an inline banner without persisting anything.

## Key Files

| File | Purpose |
|---|---|
| `app/lib/cart-intelligence/size-conflicts.ts` | Core detector and correction-resolution logic |
| `app/lib/cart-intelligence/recommendations.ts` | Shopper-facing payload builder for size conflict results |
| `app/lib/knowledge-graph/sizing.ts` | Shared request/result interfaces and sizing helpers |
| `app/lib/db/queries.ts` | Mapping, chart, and variant-availability query helpers |
| `app/routes/app.knowledge-graph.tsx` | Polaris admin surface for size charts and cross-size mappings |
| `prisma/schema.prisma` | Existing persisted sizing models reused by this feature |
| `tests/unit/knowledge-graph/size-conflicts.test.ts` | Detector regression tests |
| `tests/unit/cart-intelligence/size-conflict-recommendations.test.ts` | Payload and correction-selection tests |
| `tests/integration/routes/knowledge-graph-size-conflicts.test.ts` | Admin loader/action integration tests |

## Common Tasks

### Add or adjust a cross-size mapping

Open **Knowledge Graph** and use the size tooling to create or update a mapping for the affected category pair. The detector will begin using the new rule on the next cart analysis.

### Validate that a correction will not suggest an unavailable size

Set the expected target size on a mapped category pair, then ensure the corresponding variant is out of stock in local data. The conflict should still appear, but the preferred corrective action must not present that unavailable variant as the shopper recommendation.

### Confirm low-noise behavior for incomplete carts

Run the unit suite with carts that contain only one sized item, missing `sizeValue`, unsupported size labels, or no mapping/shared `SizeChart` sizeSystem between categories. The detector should return no conflict rather than inferring one from incomplete evidence.

### Exercise a shopper-facing payload build

Use a fixture that returns both warning- and error-level conflicts, then pass it through the recommendation builder. Confirm the payload groups severity, carries stable conflict keys, and preserves structured suggestions for downstream UI rendering.
