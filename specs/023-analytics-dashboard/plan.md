# Implementation Plan: Analytics Dashboard

**Branch**: `023-analytics-dashboard` | **Date**: 2026-06-02 | **Spec**: `specs/023-analytics-dashboard/spec.md`
**Input**: Feature specification from `/specs/023-analytics-dashboard/spec.md`

## Summary

Deliver a merchant-facing Analytics Dashboard that exposes AI-cart business impact, recommendation performance, bundle outcomes, chat outcomes, and conversion funnel analytics with period-over-period comparisons and export capability. Implementation will use a stable event taxonomy, idempotent ingestion, KPI snapshot aggregation, and Polaris-first admin presentation to ensure trustworthy, auditable metrics aligned with the feature success criteria.

## Technical Context

**Language/Version**: TypeScript 5.x, React 19.x, React Router 7.x  
**Primary Dependencies**: `@shopify/shopify-app-react-router`, `@shopify/polaris`, `@shopify/app-bridge-react`, Prisma 6.x, Zod 3.x, Vitest  
**Storage**: PostgreSQL via Prisma (existing analytics/event tables plus derived KPI snapshot tables)  
**Testing**: Vitest unit/integration, route-level integration tests for analytics loaders/actions, export contract tests  
**Target Platform**: Shopify embedded admin app (web) on Vercel-hosted React Router server runtime  
**Project Type**: Web application (embedded Shopify admin + server routes)  
**Performance Goals**: Dashboard data API p95 <= 300 ms for standard ranges (<= 90 days), export trigger response <= 2 s, same-day freshness for eligible events  
**Constraints**: Polaris/App Bridge compliance, strict TypeScript, no secrets in source, event idempotency, clear empty states, auditable metric definitions  
**Scale/Scope**: Multi-tenant Shopify app usage; period queries across daily/weekly/monthly ranges; high-cardinality event streams with aggregation per shop

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Pre-Research Gate Status:

- [x] All new GraphQL queries are field-minimal - no over-fetching (Principle III)
- [x] All external inputs validated and sanitized at network boundaries (Principle II)
- [x] Webhook handlers include HMAC signature verification (Principles I & II)
- [x] TypeScript strict mode passes with no new unexcused `any` escapes (Principle IV)
- [x] New business logic has corresponding tests before/alongside implementation (Principle V)
- [x] All admin UI uses Polaris components and App Bridge (Principle I)
- [x] No secrets hard-coded or committed to source control (Principle II)

Post-Design Re-Check (after Phase 1 artifacts):

- [x] Data contracts enforce field-minimal retrieval for dashboard computations
- [x] Input schema validation is defined for filters, export payloads, and date ranges
- [x] No webhook-path changes are required; existing verified ingestion boundary remains unchanged
- [x] Planned types/models avoid new `any` escapes and rely on Prisma/Zod typed boundaries
- [x] Tests are explicitly mapped in quickstart and plan execution steps
- [x] Admin UI remains Polaris-first with chart-like custom blocks constrained to approved scope
- [x] No secret material introduced in planning artifacts

## Project Structure

### Documentation (this feature)

```text
specs/023-analytics-dashboard/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── analytics-dashboard.openapi.yaml
└── tasks.md
```

### Source Code (repository root)

```text
app/
├── routes/
│   ├── app.analytics.tsx
│   └── api.analytics.export.tsx
├── components/
│   └── admin/
│       └── analytics/
├── lib/
│   ├── db/
│   │   └── queries.ts
│   └── analytics/
│       ├── aggregation.ts
│       ├── attribution.ts
│       ├── definitions.ts
│       └── export.ts

prisma/
└── schema.prisma

tests/
├── integration/
│   └── analytics/
└── unit/
    └── analytics/
```

**Structure Decision**: Use the existing embedded web app structure (`app/routes`, `app/lib`, `tests`) with a focused analytics domain module (`app/lib/analytics`) to isolate aggregation and attribution logic from route/UI concerns.

## Phase 0: Research Output

Research findings are documented in `specs/023-analytics-dashboard/research.md` and resolve the following planning unknowns:

1. Event taxonomy and idempotency strategy for reliable KPI computation.
2. Baseline comparison policy for period-over-period metrics.
3. Attribution model for recommendation/chat/bundle funnel contribution.
4. Export behavior for small vs. large reporting windows.
5. Freshness strategy meeting same-day update requirements.

## Phase 1: Design & Contracts Output

1. Data model documented in `specs/023-analytics-dashboard/data-model.md`.
2. External interface contract documented in `specs/023-analytics-dashboard/contracts/analytics-dashboard.openapi.yaml`.
3. Developer/operator flow documented in `specs/023-analytics-dashboard/quickstart.md`.
4. Agent context updated in `.github/copilot-instructions.md` to point to this feature plan.

## Complexity Tracking

No constitution violations or exceptional complexity justifications identified at planning time.
