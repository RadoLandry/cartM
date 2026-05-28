# Research: Replenishment Prediction

## Store item-level replenishment history outside CustomerProfile JSON

### Decision
Keep `CustomerProfile` as the shopper identity anchor, but store replenishment-relevant purchase history in a normalized `CustomerPurchaseSnapshot` table instead of overloading the existing `purchaseSummary` JSON blob.

### Rationale
The current `purchaseSummary` supports lightweight counts and recency, but replenishment needs per-item timing, quantity, cadence, and direct reorder viability. A normalized snapshot table keeps shopper requests fast and queryable while avoiding ever-growing JSON payloads inside a single profile row.

### Alternatives considered
- Extend `CustomerProfile.purchaseSummary` with arrays of prior purchases: rejected because item-level queries, ranking, and idempotent webhook updates become brittle and row size grows over time.
- Query Shopify order history live during each recommendation request: rejected because it violates the latency and rate-limit constraints of the shopper path.

## Persist lifecycle timing as per-shop rules keyed by category tag

### Decision
Add a `ReplenishmentLifecycleRule` persistence model keyed by `shop + categoryTag` with minimum and maximum replacement windows, priority, and rule source.

### Rationale
The spec assumes merchants define or approve lifecycle expectations. A dedicated rule store keeps lifecycle timing local, testable, and easy to join against catalog categories and purchase snapshots without hard-coding replacement windows into the evaluation logic.

### Alternatives considered
- Hard-code lifecycle defaults in application code only: rejected because merchant approval and future overrides become hard to manage and audit.
- Store lifecycle windows as product metafields only: rejected because the recommendation engine still needs a local, queryable copy for fast evaluation.

## Create a dedicated replenishment evaluation module

### Decision
Introduce `app/lib/cart-intelligence/replenishment.ts` as the owning module for due-window evaluation, confidence scoring, action selection, and grouped refresh-cart assembly.

### Rationale
Replenishment is recommendation-domain logic, not route glue and not raw persistence. A dedicated module keeps cadence evaluation deterministic and unit-testable, while letting `recommendations.ts` focus on payload shaping and the route remain thin.

### Alternatives considered
- Put replenishment logic directly in `api.ai.recommendations.tsx`: rejected because the route would become hard to test and reuse.
- Put replenishment ranking entirely in `queries.ts`: rejected because DB helpers should not own business policy such as timing confidence or reorder-vs-upgrade decisions.

## Use webhook-first hydration plus optional background backfill

### Decision
Extend the existing authenticated `webhooks.orders.create.tsx` path to maintain replenishment purchase snapshots incrementally, and use only field-minimal background/backfill queries when historical orders must be seeded for existing merchants.

### Rationale
The repo already has an order webhook that updates customer purchase summaries. Reusing that path preserves Shopify authentication and keeps ongoing replenishment data fresh without adding shopper-path latency. A separate background backfill covers pre-install order history without forcing live Admin API reads during cart recommendation requests.

### Alternatives considered
- Depend only on future webhook traffic after install: rejected because returning-customer replenishment would be too empty for existing merchants at launch.
- Perform full order-history synchronization during recommendation requests: rejected because it is too slow and too expensive.

## Prefer reorder first, then upgrade if the original item is no longer the best path

### Decision
When surfacing replenishment, prefer direct reorder of the prior item if it is still available and still fits the lifecycle rule; otherwise look for a locally known upgrade path via existing product relationships and suppress the action if neither path is viable.

### Rationale
This matches the shopper expectation of replacing familiar gear quickly while still supporting higher-value upgrade behavior. It also keeps suggestions trustworthy by never surfacing dead-end reminders for unavailable products.

### Alternatives considered
- Always recommend the exact prior item: rejected because discontinued or obsolete products would create dead ends.
- Always recommend an upgrade when one exists: rejected because it ignores repeat shoppers who reliably reorder the same item.

## Extend the existing recommendation payload instead of introducing a second shopper API

### Decision
Expose replenishment results as a new section in the existing `api.ai.recommendations.tsx` response and format them through `app/lib/cart-intelligence/recommendations.ts`.

### Rationale
The current code already centralizes shopper-facing recommendation responses in one route. Adding replenishment there preserves a single cart recommendation surface for storefront clients and avoids splitting cart analysis across multiple endpoints.

### Alternatives considered
- Create a separate `/api/ai/replenishment` route: rejected because clients would have to orchestrate multiple recommendation calls for the same cart session.
- Keep replenishment as an internal-only signal inside customer profile resolution: rejected because storefront and chat surfaces need a stable, typed shopper-facing result.