# Implementation Plan: Catalog Ingestion & Sync

**Branch**: `001-catalog-ingestion-sync` | **Date**: 2026-05-18 | **Spec**: `/specs/001-catalog-ingestion-sync/spec.md`
**Input**: Feature specification from `/specs/001-catalog-ingestion-sync/spec.md`

## Summary

Build the first production catalog-ingestion slice for CartMind by importing each merchant's active and published Shopify products into the app database, reconciling product changes through verified webhooks, enriching products with embeddings and dominant colors, and surfacing sync progress plus failures in the embedded admin dashboard.

The design extends the existing Shopify React Router application with knowledge-graph ingestion modules, shared Shopify GraphQL helpers, durable sync-job tracking, idempotent webhook event handling, and Polaris-based admin status surfaces. This feature also moves the repository off the template-only data model by introducing the domain entities needed for product ingestion and sync observability.

## Technical Context

**Language/Version**: TypeScript 5.9, React 18, Node.js 20+  
**Primary Dependencies**: `@shopify/shopify-app-react-router`, `@shopify/app-bridge-react`, React Router 7, Prisma 6, Vite 6  
**Storage**: Prisma ORM with current template SQLite dev storage; feature target is PostgreSQL-backed product and sync data  
**Testing**: Automated unit and integration tests plus repository validation through `npm run lint` and `npm run typecheck`  
**Target Platform**: Embedded Shopify admin app and Shopify webhook endpoints on a Node server runtime  
**Project Type**: Shopify embedded web application  
**Performance Goals**: Full sync of 5,000 products within 15 minutes; webhook-driven product updates reflected within 30 seconds; webhook handlers respond within Shopify's 5-second limit  
**Constraints**: Shopify Admin GraphQL only; field-minimal queries; cursor pagination; HMAC verification on all webhooks; only `custom.*` and `cartmind.*` metafields ingested; one active sync job per shop; duplicate webhooks suppressed by event ID  
**Scale/Scope**: Single feature slice covering install-time sync, webhook reconciliation, enrichment retry handling, and admin sync visibility for merchants with catalogs of 5,000+ products

## Constitution Check

*GATE: Must pass before implementation begins. Re-check after design changes.*

- [x] All new GraphQL queries are field-minimal — no over-fetching (Principle III)
- [x] All external inputs validated and sanitized at network boundaries (Principle II)
- [x] Webhook handlers include HMAC signature verification (Principles I & II)
- [x] TypeScript strict mode passes with no new unexcused `any` escapes (Principle IV)
- [x] New business logic has corresponding tests before/alongside implementation (Principle V)
- [x] All admin UI uses Polaris components and App Bridge (Principle I)
- [x] No secrets hard-coded or committed to source control (Principle II)

## Project Structure

### Documentation (this feature)

```text
specs/001-catalog-ingestion-sync/
├── contracts/
├── plan.md
├── spec.md
└── tasks.md
```

### Source Code (repository root)

```text
app/
├── components/
│   └── admin/
├── lib/
│   ├── db/
│   ├── knowledge-graph/
│   └── shopify/
├── routes/
├── db.server.ts
└── shopify.server.ts

prisma/
└── schema.prisma

extensions/
└── .gitkeep
```

**Structure Decision**: Keep the existing single Shopify app structure and add domain modules under `app/lib/knowledge-graph/`, `app/lib/shopify/`, and `app/lib/db/`. Admin sync-status UI remains inside the embedded admin route tree and uses Polaris components. No workspace split or separate service is required for this feature.

## Architecture & Design Decisions

### Data Flow

1. App installation or a merchant-triggered re-sync creates a `SyncJob` for the shop.
2. The ingestion module pulls Shopify products through Admin GraphQL using cursor pagination.
3. Product payloads are normalized, filtered to active and published products, and restricted to `custom.*` and `cartmind.*` metafields.
4. Product and variant records are upserted into the local database.
5. Enrichment workers generate embeddings and dominant colors; transient failures retry up to 3 times over 24 hours.
6. Product webhooks reconcile creates, updates, and deletes after HMAC validation and duplicate-event suppression.
7. Admin dashboard loaders surface sync progress, last-run state, and permanently failed items.

### Key Design Choices

- **Shopify Admin GraphQL only**: Ingestion and reconciliation use Shopify's sanctioned GraphQL APIs and SDK-authenticated admin access.
- **Idempotent webhook processing**: Webhook event IDs are persisted so duplicate deliveries return HTTP 200 without double-mutating local state.
- **Single active sync per shop**: Manual re-sync requests are rejected while a sync job is already `IN_PROGRESS`.
- **Best-effort enrichment**: Product persistence succeeds even when embeddings or color extraction fail; retry metadata and permanent failure state are tracked separately.
- **Polaris-only admin UI**: Merchant-facing sync status components use Polaris inside the embedded admin shell to satisfy Shopify-first governance.

### Planned Files

- `prisma/schema.prisma`
- `app/shopify.server.ts`
- `app/routes/app._index.tsx`
- `app/routes/webhooks.products.create.tsx`
- `app/routes/webhooks.products.update.tsx`
- `app/routes/webhooks.products.delete.tsx`
- `app/lib/db/queries.ts`
- `app/lib/knowledge-graph/ingestion.ts`
- `app/lib/knowledge-graph/normalization.ts`
- `app/lib/knowledge-graph/embeddings.ts`
- `app/lib/knowledge-graph/colorways.ts`
- `app/lib/knowledge-graph/sync-status.ts`
- `app/lib/shopify/graphql.ts`
- `app/lib/shopify/webhooks.ts`
- `app/components/admin/SyncStatusCard.tsx`
- `app/components/admin/SyncFailureTable.tsx`

## Requirement Mapping

| Requirement | Planned Design |
|-------------|----------------|
| FR-001 / FR-002 | Sync orchestration in `app/lib/knowledge-graph/ingestion.ts` with cursor-paginated Admin GraphQL queries |
| FR-003 / FR-004 / FR-014 | Shopify webhook helpers and dedicated product webhook routes using SDK verification and event-id persistence |
| FR-005 / FR-008 / FR-009 | Product normalization and upsert logic in `app/lib/knowledge-graph/normalization.ts` and `app/lib/db/queries.ts` |
| FR-006 / FR-007 / FR-011 | Enrichment modules for embeddings and color extraction with retry tracking |
| FR-010 / FR-013 | `SyncJob` persistence, loaders, and dashboard actions in the admin route and components |
| SC-001 to SC-006 | Covered through sync orchestration, idempotency, retry policy, and dashboard visibility |

## Test Strategy

- **Unit tests**: normalization filters, metafield namespace filtering, retry scheduling, duplicate-event suppression, sync-state transitions
- **Integration tests**: full-sync orchestration against mocked Shopify GraphQL responses; webhook HMAC verification and duplicate-delivery replay; delete-event soft-inactivation; dashboard loaders returning status and failure data
- **Validation commands**: `npm run lint` and `npm run typecheck` before completion

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Current repository still has template Shopify config and SQLite datasource | High | Update configuration and Prisma schema in foundational work before feature logic lands |
| Long-running syncs may exceed request lifetimes | High | Run sync work asynchronously and keep webhook handlers fast with immediate acknowledgment |
| Duplicate or out-of-order webhook deliveries can corrupt local state | High | Persist event IDs and design reconciliation as idempotent upsert and soft-delete operations |
| Enrichment providers may fail transiently | Medium | Persist products first, retry enrichment up to 3 times over 24 hours, then surface permanent failures |
| Admin visibility can drift from persisted sync state | Medium | Source dashboard state from `SyncJob` and failure records rather than client-only state |

## Complexity Tracking

No constitution exceptions are required for this feature.
