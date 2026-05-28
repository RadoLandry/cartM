# Quickstart: Replenishment Prediction

## Goal

Validate that CartMind can identify due-for-replacement gear for returning shoppers, rank credible reorder or upgrade paths from local persistence, and expose grouped refresh-cart actions without adding Shopify Admin API latency to the shopper request path.

## Prerequisites

- The customer-profile feature is in place and recognized shoppers resolve through `CustomerProfile`.
- Catalog sync keeps product and variant availability current enough to support reorder or upgrade actions.
- Prisma migrations for replenishment lifecycle and purchase snapshot tables have been applied.
- The existing order webhook path is active and can be extended safely for incremental replenishment hydration.
- If historical orders need to be seeded, a background-safe backfill mechanism is available outside the shopper request path.

## Implementation Flow

1. Add replenishment persistence.
   - Add `ReplenishmentLifecycleRule` and `CustomerPurchaseSnapshot` to Prisma.
   - Extend DB helpers to upsert lifecycle rules, ingest purchase snapshots, and query due candidates efficiently.

2. Build the replenishment engine.
   - Add `app/lib/cart-intelligence/replenishment.ts` for due-window evaluation, cadence adjustment, confidence scoring, and grouped refresh-cart assembly.
   - Keep reorder-first behavior when the prior product remains viable, and suppress dead-end actions.

3. Extend shopper-facing recommendations.
   - Update `api.ai.recommendations.tsx` to load replenishment candidates for recognized shoppers only.
   - Extend `recommendations.ts` to format a stable shopper-facing replenishment payload.

4. Enrich order ingestion.
   - Update `webhooks.orders.create.tsx` to normalize product, quantity, and timestamp data into purchase snapshots.
   - Optionally add a field-minimal backfill path for historical customer orders.

5. Validate suppression and grouped refresh behavior.
   - Verify recently purchased items do not trigger early reminders.
   - Verify shoppers with multiple due items can rebuild a replacement cart quickly.

## Suggested Validation Commands

```powershell
npx vitest run tests/unit/cart-intelligence/replenishment.test.ts
npx vitest run tests/unit/cart-intelligence/replenishment-recommendations.test.ts
npx vitest run tests/integration/routes/replenishment-recommendations.test.ts
npx vitest run tests/integration/routes/webhooks-orders-create-replenishment.test.ts
```

## Manual Validation Scenarios

1. Seed a recognized shopper with prior purchases for wraps, mouthguard, and gloves, then verify only the due or approaching items surface.
2. Mark the prior item unavailable and verify the shopper sees an upgrade or alternative path instead of a dead-end reorder.
3. Create repeated purchase history for one category with a non-default cadence and verify future timing shifts toward the shopper's pattern.
4. Ingest a new order for an item that was previously due, then verify the next recommendation cycle suppresses that reminder.
5. Present a shopper with several due items across mixed priorities and verify the grouped refresh action ranks the more urgent categories first.

## Exit Criteria

- Returning shoppers get replenishment suggestions only from eligible lifecycle-backed purchase history.
- Reorder and upgrade actions are locally resolvable from synced catalog and relationship data.
- Recently replenished items no longer appear as due.
- Low-confidence or sparse-history shoppers receive no premature replenishment prompt.
- Unit and integration coverage exists for evaluation, route payloads, and webhook ingestion.