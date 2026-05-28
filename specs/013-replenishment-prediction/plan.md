# Implementation Plan: Replenishment Prediction

**Branch**: `013-replenishment-prediction` | **Date**: 2026-05-26 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/013-replenishment-prediction/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Add a replenishment engine that uses locally persisted purchase snapshots and merchant-approved lifecycle windows to surface timely reorder or upgrade opportunities for returning shoppers, expose grouped refresh-cart actions through the existing recommendation route, and keep shopper requests DB-only by moving order-history hydration to webhooks and optional background backfill.

## Technical Context

**Language/Version**: TypeScript 5.x  
**Primary Dependencies**: React Router 7, `@shopify/shopify-app-react-router`, Prisma, PostgreSQL, Zod, existing customer-profile resolver, existing recommendation builders, Shopify webhook authentication helpers  
**Storage**: PostgreSQL via Prisma; reuse `CustomerProfile` as the shopper identity anchor and add normalized replenishment lifecycle and purchase snapshot tables  
**Testing**: Vitest unit and integration tests in `tests/unit/cart-intelligence` and `tests/integration/routes`  
**Target Platform**: Shopify embedded app on Vercel with shopper-facing recommendation APIs consumed by storefront/cart surfaces  
**Project Type**: Web service / embedded Shopify app feature extension  
**Performance Goals**: Replenishment candidate evaluation under 50 ms from local persistence; recommendation enrichment under 200 ms p95; no synchronous Shopify Admin API reads on the shopper request path  
**Constraints**: Only eligible lifecycle-backed categories can surface replenishment; order-history hydration must be webhook- or job-driven and field-minimal; unavailable products cannot be shown as direct reorder actions; grouped refresh actions must degrade safely when candidate catalog data is stale  
**Scale/Scope**: Up to 100k shopper profiles per merchant, tens of replenishment snapshots per shopper across eligible categories, carts up to ~20 lines, and returning-shopper replenishment only

### Planning Assumptions

- The existing `CustomerProfile` row remains the identity boundary for recognized and session shoppers, but item-level replenishment history requires a normalized store beyond the current `purchaseSummary` JSON blob.
- The existing `webhooks.orders.create.tsx` route is the right ingestion anchor for incremental replenishment updates because it already authenticates Shopify order webhooks and updates profile purchase summaries.
- Initial historical replenishment context may require a field-minimal background/backfill query path, but shopper requests must continue reading only local persistence.
- Local product and variant records from catalog sync are the source of availability, titles, and upgrade target lookup when building reorder or upgrade actions.
- The existing `api.ai.recommendations.tsx` route remains the shopper-facing integration surface; replenishment should extend that payload rather than introduce a second cart recommendation endpoint.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

*Read `.specify/memory/constitution.md` for the full principle definitions. The
standard gates for CartMind (Principles I–V) are:*

- [x] All new GraphQL queries are field-minimal — no over-fetching (Principle III)
- [x] All external inputs validated and sanitized at network boundaries (Principle II)
- [x] Webhook handlers include HMAC signature verification (Principles I & II)
- [x] TypeScript strict mode passes with no new unexcused `any` escapes (Principle IV)
- [x] New business logic has corresponding tests before/alongside implementation (Principle V)
- [x] All admin UI uses Polaris components and App Bridge (Principle I)
- [x] No secrets hard-coded or committed to source control (Principle II)

**Gate Result**: PASS

Notes:
- Shopper-facing replenishment evaluation will resolve entirely from Prisma-backed purchase snapshots, lifecycle rules, and synced catalog data; any historical order backfill stays off the shopper request path.
- Recommendation route inputs remain Zod-validated before profile or replenishment evaluation, and webhook ingestion continues to rely on Shopify SDK authentication.
- No new admin UI is required in this slice; lifecycle rules can be seeded or managed later without violating the current Polaris/App Bridge gate.
- New business logic is confined to explicit cart-intelligence and DB helper surfaces, which keeps unit and integration test coverage straightforward.

## Project Structure

### Documentation (this feature)

```text
specs/013-replenishment-prediction/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
└── tasks.md
```

### Source Code (repository root)

```text
app/
├── lib/
│   ├── cart-intelligence/
│   │   ├── customer-profile.ts            -- extend purchase summary helpers consumed by replenishment
│   │   ├── replenishment.ts               -- new lifecycle evaluation, candidate ranking, and refresh-cart assembly
│   │   └── recommendations.ts             -- extend shopper payload shaping to expose replenishment results
│   ├── db/
│   │   └── queries.ts                     -- lifecycle-rule, purchase-snapshot, and candidate query helpers
│   └── shopify/
│       └── graphql.ts                     -- optional field-minimal historical order backfill helpers
├── routes/
│   ├── api.ai.recommendations.tsx         -- inject replenishment evaluation into the existing shopper recommendation response
│   └── webhooks.orders.create.tsx         -- enrich order ingestion with replenishment purchase snapshot updates
prisma/
└── schema.prisma                          -- add replenishment lifecycle and purchase snapshot persistence
scripts/
└── backfill-customer-purchases.ts         -- optional one-time historical replenishment seeding for existing merchants
tests/
├── integration/
│   └── routes/
│       ├── replenishment-recommendations.test.ts
│       └── webhooks-orders-create-replenishment.test.ts
└── unit/
  └── cart-intelligence/
    ├── replenishment.test.ts
    └── replenishment-recommendations.test.ts
```

**Structure Decision**: Extend the existing single-app Shopify architecture. Customer identity and profile state stay anchored in `CustomerProfile`, item-level replenishment logic gets a dedicated cart-intelligence module and normalized persistence, and the current recommendation route remains the sole shopper-facing integration surface.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| None | N/A | N/A |

## Phase 0: Research Output

Research decisions are captured in [research.md](./research.md) and resolve the main planning questions:

1. **Purchase persistence shape**: Store item-level replenishment history in a normalized purchase snapshot table instead of overloading `CustomerProfile.purchaseSummary`.
2. **Lifecycle configuration**: Persist per-shop lifecycle rules keyed by category tag so timing windows can be merchant-approved and locally queryable.
3. **Owning logic surface**: Add `app/lib/cart-intelligence/replenishment.ts` for due-window evaluation, ranking, confidence, and grouped refresh actions.
4. **History hydration strategy**: Enrich the existing order webhook for incremental updates and use only field-minimal background backfill for historical orders when needed.
5. **Action policy**: Prefer direct reorder when the original item is still viable, fall back to upgrade paths via existing product relationships, and suppress dead-end suggestions.
6. **Route integration**: Extend the existing recommendation route and payload builder rather than creating a separate replenishment endpoint.

## Phase 1: Design Output

- Data model: [data-model.md](./data-model.md)
- Contracts:
  - [contracts/replenishment-recommendation-response.md](./contracts/replenishment-recommendation-response.md) — shopper-facing payload contract for replenishment results
  - [contracts/replenishment-purchase-ingestion.md](./contracts/replenishment-purchase-ingestion.md) — webhook/backfill ingestion contract for purchase snapshots
  - [contracts/replenishment-lifecycle-rules.md](./contracts/replenishment-lifecycle-rules.md) — lifecycle rule persistence contract for eligible categories
- Quickstart: [quickstart.md](./quickstart.md)

## Post-Design Constitution Check

- [x] Any historical order backfill queries remain field-minimal and stay off the shopper request path. Principle III: PASS.
- [x] Recommendation route inputs and any ingestion payload normalization remain validated at the boundary before business logic runs. Principle II: PASS.
- [x] Incremental replenishment hydration extends the authenticated Shopify order webhook path rather than introducing unauthenticated ingestion. Principles I & II: PASS.
- [x] Replenishment evaluation, payload shaping, and persistence helpers remain explicitly typed with Prisma/Zod/TypeScript contracts and no planned `any` escape hatches. Principle IV: PASS.
- [x] Unit coverage for lifecycle evaluation and integration coverage for route plus webhook ingestion are part of scope. Principle V: PASS.
- [x] No new admin UI is required for this slice, so existing Polaris/App Bridge compliance remains intact. Principle I: PASS.

**Post-Design Gate Result**: PASS
