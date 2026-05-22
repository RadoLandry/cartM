# Implementation Plan: Product Relationship Mapping

**Branch**: `[004-product-relationship-mapping]` | **Date**: 2026-05-22 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/004-product-relationship-mapping/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Add a relationship graph layer to the existing knowledge graph so CartMind can generate, persist, review, and serve product-to-product relationships for complements, upgrades, alternatives, conflicts, and same-collection links. The implementation extends the current catalog ingestion and taxonomy pipeline with relationship generation, merchant overrides in the admin knowledge-graph surface, and a downstream read model that only exposes approved active relationships.

## Technical Context

**Language/Version**: TypeScript 5.x  
**Primary Dependencies**: React Router 7, `@shopify/shopify-app-react-router`, Polaris, Prisma, PostgreSQL, pgvector, Vercel AI SDK  
**Storage**: PostgreSQL via Prisma, with pgvector already used for embeddings  
**Testing**: Vitest for unit/integration tests in `tests/unit` and `tests/integration`  
**Target Platform**: Shopify embedded admin app on Vercel serverless plus background ingestion flows  
**Project Type**: Web service / Shopify app  
**Performance Goals**: Keep downstream relationship reads suitable for cart-intelligence usage, target incremental remapping only for changed products, and avoid full-catalog recomputation during normal webhook syncs  
**Constraints**: Must preserve Shopify-first admin patterns, validate all route inputs, avoid over-fetching Shopify GraphQL, respect current strict TypeScript posture, and support merchant overrides that survive remapping  
**Scale/Scope**: Growth-tier catalogs up to roughly 10k products with relationship generation focused on changed products and bounded candidate sets

### Planning Assumptions

- `complements` and `upgrades` are directional by default.
- `alternatives`, `conflicts`, and `same-collection` are symmetric by default at the business level, but the persistence layer may normalize them into one canonical record shape for query simplicity.
- Purchase co-occurrence evidence will be designed as an input source, but initial implementation can ship with catalog, taxonomy, merchant-rule, collection, and embedding evidence if order-history ingestion is not yet available.
- The first admin experience extends the existing knowledge-graph route rather than creating a separate graph visualization surface.

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
- No new Shopify webhook endpoint is required; existing verified ingestion entry points remain the only webhook boundary touched by this feature.
- Admin curation will stay inside Polaris/App Bridge patterns by extending the existing embedded knowledge-graph route.
- Downstream relationship retrieval is planned as database-backed query logic, not new Shopify GraphQL reads.

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)
```text
app/
├── lib/
│   ├── db/
│   │   └── queries.ts
│   └── knowledge-graph/
│       ├── ingestion.ts
│       ├── taxonomy.ts
│       ├── llm-classifier.ts
│       ├── embeddings.ts
│       └── relationships.ts
├── routes/
│   └── app.knowledge-graph.tsx
prisma/
└── schema.prisma
tests/
├── integration/
│   └── routes/
└── unit/
    └── knowledge-graph/
```

**Structure Decision**: Keep the existing single Shopify-app structure. Extend `prisma/schema.prisma` for relationship persistence, add relationship generation and normalization logic under `app/lib/knowledge-graph/relationships.ts`, add persistence and read-model helpers to `app/lib/db/queries.ts`, and extend `app/routes/app.knowledge-graph.tsx` for merchant review/edit flows. Unit tests belong in `tests/unit/knowledge-graph`, with route/integration coverage under `tests/integration/routes`.

## Phase 0: Research Output

Research decisions are captured in [research.md](./research.md) and resolve the main planning questions:

1. How to represent directional and symmetric relationships without duplicating merchant intent.
2. How to combine evidence sources while allowing merchant overrides to persist.
3. How to expose a downstream approved relationship view that cart intelligence can consume safely.
4. How to keep remapping incremental so ingestion remains bounded.

## Phase 1: Design Output

- Data model: [data-model.md](./data-model.md)
- Contracts: [contracts/relationship-read-model.md](./contracts/relationship-read-model.md), [contracts/merchant-relationship-review.md](./contracts/merchant-relationship-review.md)
- Quickstart: [quickstart.md](./quickstart.md)

## Post-Design Constitution Check

- [x] All new GraphQL queries remain field-minimal or are avoided entirely for this feature.
- [x] All new route/action inputs are planned to be validated and sanitized at the boundary.
- [x] Existing webhook verification remains intact; no bypass path is introduced.
- [x] The design keeps all persistence and service logic typed through Prisma and TypeScript.
- [x] Unit and integration test extensions are explicitly part of the implementation slice.
- [x] Merchant-facing admin work remains inside Polaris/App Bridge patterns.

**Post-Design Gate Result**: PASS

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| None | N/A | N/A |
