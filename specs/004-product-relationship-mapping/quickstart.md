# Quickstart: Product Relationship Mapping

## Goal

Validate that relationship persistence, generation, merchant review, and downstream reads work end to end for a development store.

## Prerequisites

1. Database is available and Prisma can run migrations.
2. Catalog ingestion and taxonomy classification are already functional for the target shop.
3. Embedding generation is configured so similarity-based candidates can be produced.

## Setup

1. Add the new Prisma models and enums for product relationships and relationship evidence.
2. Run the Prisma workflow used by this repo to apply the schema changes.
3. Implement relationship generation in `app/lib/knowledge-graph/relationships.ts` and wire it into the ingestion flow after normalized product data, embeddings, and taxonomy tags are available.
4. Add persistence and approved-read helpers to `app/lib/db/queries.ts`.
5. Extend `app/routes/app.knowledge-graph.tsx` with Polaris-based review and override actions for relationship candidates.

## Verification Flow

1. Trigger a catalog sync for a shop with known boxing or MMA products.
2. Confirm that products with obvious complements or same-collection peers receive relationship candidates.
3. Open the admin knowledge-graph page and review low-confidence or candidate relationship rows.
4. Approve one candidate, reject one candidate, and create one merchant-authored relationship.
5. Call `getTrustedRelationshipsForProduct` (or `getApprovedRelationshipsForProduct` in queries.ts) for the affected product and confirm that:
   - Only status=ACTIVE, non-invalidated relationships are returned.
   - Results are ordered by relationship type priority (COMPLEMENTS → UPGRADES → ALTERNATIVES → CONFLICTS → SAME_COLLECTION) then by strength descending.
   - The `reviewedAt` field is populated for merchant-approved relationships.
6. Delete or archive one related product and confirm the approved view no longer exposes invalidated relationships after the next sync cycle.

## Test Targets

1. Unit tests in `tests/unit/knowledge-graph/relationships.test.ts`:
   - candidate generation, normalization, override precedence, and approved-row structural contract.
2. Integration tests in `tests/integration/routes/knowledge-graph-relationships.test.ts`:
   - admin review actions (approve, reject, disable, create).
   - `getApprovedRelationshipsForProduct` priority ordering, strength filtering, and reviewedAt contract.
3. Ingestion-path tests in `tests/unit/knowledge-graph/ingestion-webhooks.test.ts`:
   - `invalidateRelationshipsForProduct` is called on product delete events.
   - update events do not trigger relationship invalidation.
4. Route lifecycle tests in `tests/integration/routes/product-webhooks.test.ts`:
   - duplicate delete events are suppressed.
   - valid delete events delegate to `handleProductWebhook` which owns the invalidation call.

## Implementation Notes (Sprint 3 — 2026-08-31)

- `getApprovedRelationshipsForProduct` in `app/lib/db/queries.ts` is the approved read-model query with priority ordering and min-strength threshold support.
- `getTrustedRelationshipsForProduct` and `getTrustedRelationshipsOfType` in `app/lib/knowledge-graph/relationships.ts` are the canonical accessors for cart-intelligence consumers.
- `generateRelationshipsForShop` was optimized in T027 to collect and deduplicate all candidates in a single pass before persisting, reducing DB round-trips for large shops.
