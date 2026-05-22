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
5. Request the approved relationship view for the affected product and confirm that only active approved relationships are returned.
6. Delete or archive one related product and confirm the approved view no longer exposes invalidated relationships after the next sync cycle.

## Test Targets

1. Add unit tests for candidate generation, normalization of symmetric vs directional types, and override precedence.
2. Add integration tests for admin review actions and downstream approved-read filtering.
3. Add ingestion-path tests confirming relationship invalidation after product deletion or status change.