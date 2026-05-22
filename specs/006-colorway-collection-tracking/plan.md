# Implementation Plan: Colorway & Collection Tracking

**Branch**: `006-size-fit-intelligence` | **Date**: 2026-05-22 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/006-colorway-collection-tracking/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Add a merchant-curated visual profile layer to CartMind's existing product knowledge graph so the cart can reason about coordinated collections and compatible colorways. The feature builds on the current ingestion path that already stores `dominantColors` and Shopify `collectionIds`, adds a derived `ProductVisualProfile` model plus merchant-managed `ColorCompatibilityRule` overrides, extends the existing Polaris knowledge-graph route with a dedicated colorways review tab, and introduces a deterministic style-coherence scorer that powers collection-completion and visual-swap recommendations.

## Technical Context

**Language/Version**: TypeScript 5.x  
**Primary Dependencies**: React Router 7, `@shopify/shopify-app-react-router`, Polaris, Prisma, PostgreSQL, Zod, existing Shopify Admin GraphQL helpers, server-side image color extraction inside `app/lib/knowledge-graph/colorways.ts`  
**Storage**: PostgreSQL via Prisma; existing `Product` rows remain the raw sync source, with new `ProductVisualProfile` and `ColorCompatibilityRule` models for derived visual state and merchant overrides  
**Testing**: Vitest unit and integration tests in `tests/unit/knowledge-graph`, `tests/unit/cart-intelligence`, and `tests/integration/routes`  
**Target Platform**: Shopify embedded admin app on Vercel serverless plus shopper-facing cart intelligence APIs
**Project Type**: Web service / embedded Shopify app feature extension  
**Performance Goals**: Visual-profile backfill should process products in batch without increasing webhook acknowledgement latency; cart style-coherence scoring should run in-process under 50 ms per cart analysis; knowledge-graph colorway tab should load under 300 ms p95 for the first 50 products  
**Constraints**: Preserve merchant overrides across catalog re-syncs; keep Admin GraphQL queries field-minimal; no new custom admin shell outside Polaris/App Bridge; unavailable variants must never be recommended; color extraction must degrade safely when images are missing or processing fails  
**Scale/Scope**: Up to 10k products per merchant; up to 50 admin-reviewed low-confidence visual profiles per page; compatibility rules expected to remain under O(200) rows per shop

### Planning Assumptions

- The existing `Product.dominantColors` and `Product.collectionIds` fields remain as raw ingestion outputs and are not used directly as the merchant-facing source of truth.
- The current `extractDominantColors()` stub in [app/lib/knowledge-graph/colorways.ts](c:\Users\Landry\Documents\CARTMIND\cart-mind\app\lib\knowledge-graph\colorways.ts#L1) is replaced by a deterministic extraction pipeline with a safe fallback; tests continue to use mocked color extraction.
- The existing knowledge-graph route in [app/routes/app.knowledge-graph.tsx](c:\Users\Landry\Documents\CARTMIND\cart-mind\app\routes\app.knowledge-graph.tsx#L1) is the correct admin surface for merchant review, rather than introducing a new top-level route.
- Collection titles and handles needed for merchant review are added to the existing field-minimal Shopify product fragment, rather than fetched via an additional Admin API query.

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
- The only expected Shopify query change is enriching the existing product fragment with collection `title` and `handle`, which remains field-minimal and avoids a second query path.
- Merchant edits for visual profiles and compatibility rules will be validated at the route action boundary with Zod before any Prisma write.
- No new webhook endpoint is introduced; colorway enrichment stays inside the existing ingestion/backfill flow and preserves current HMAC-verified boundaries.
- All admin review surfaces stay inside the existing Polaris knowledge-graph route.

## Project Structure

### Documentation (this feature)

```text
specs/006-colorway-collection-tracking/
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
│   │   ├── recommendations.ts                -- extend visual recommendation orchestration
│   │   └── style-coherence.ts                -- NEW: score coherence, suggest add/swap actions
│   ├── db/
│   │   └── queries.ts                        -- extend with visual profile and compatibility rule helpers
│   ├── knowledge-graph/
│   │   ├── colorways.ts                      -- extend extraction, normalization, effective profile logic
│   │   ├── ingestion.ts                      -- extend sync/backfill flow to build visual profiles
│   │   ├── normalization.ts                  -- extend normalized collection metadata
│   │   └── relationships.ts                  -- extend SAME_COLLECTION evidence with effective collection keys
│   └── shopify/
│       └── graphql.ts                        -- extend product fragment with collection title/handle
├── routes/
│   └── app.knowledge-graph.tsx               -- extend with Colorways tab loader/actions
prisma/
└── schema.prisma                             -- extend with ProductVisualProfile and ColorCompatibilityRule
scripts/
└── backfill-colorway-profiles.ts             -- NEW: rebuild visual profiles for existing catalogs
tests/
├── integration/
│   └── routes/
│       └── knowledge-graph-colorways.test.ts -- NEW: loader/action integration coverage for admin tab
└── unit/
  ├── cart-intelligence/
  │   └── style-coherence.test.ts           -- NEW: collection completion and swap suggestion tests
  └── knowledge-graph/
    └── colorways.test.ts                 -- extend existing extractor/profile tests
```

**Structure Decision**: Extend the existing single-app Shopify architecture. Raw Shopify product data continues to land in `Product` rows; derived and merchant-curated visual state is added via Prisma-backed helpers and consumed by a new cart-intelligence scorer plus the existing knowledge-graph admin route.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| None | N/A | N/A |

## Phase 0: Research Output

Research decisions are captured in [research.md](./research.md) and resolve the main planning questions:

1. **Visual profile persistence**: Keep raw ingestion fields on `Product`, but add a separate `ProductVisualProfile` model for normalized colorway labels, effective collections, confidence, and merchant overrides.
2. **Collection tracking**: Extend the existing Shopify product fragment with collection `title` and `handle` so collection review data arrives during normal sync without a second query path.
3. **Colorway detection**: Combine image-derived palette extraction with title, variant, tag, and metafield token parsing to derive normalized colorway keys.
4. **Compatibility scoring**: Use deterministic weighted scoring across collection overlap, colorway compatibility, and taxonomy alignment; emit add/swap suggestions only above a confidence threshold.
5. **Merchant control**: Extend the existing Polaris knowledge-graph route with a Colorways tab for low-confidence review, per-product overrides, and compatibility-rule editing.
6. **Reasoning trace**: Return structured recommendation reasons from collection membership, compatibility rules, and override provenance so merchant admins can inspect why a suggestion was produced.

## Phase 1: Design Output

- Data model: [data-model.md](./data-model.md)
- Contracts:
  - [contracts/style-coherence.md](./contracts/style-coherence.md) — scorer input/output for cart visual analysis
  - [contracts/merchant-visual-admin.md](./contracts/merchant-visual-admin.md) — knowledge-graph colorway tab loader/action contract
  - [contracts/visual-recommendations.md](./contracts/visual-recommendations.md) — shopper-facing recommendation payload and reasoning contract
- Quickstart: [quickstart.md](./quickstart.md)

## Post-Design Constitution Check

- [x] The only Admin GraphQL expansion is adding collection title/handle to the existing product fragment, keeping the query field-minimal. Principle III: PASS.
- [x] All new admin actions for visual-profile overrides and compatibility rules are planned with Zod-validated boundaries. Principle II: PASS.
- [x] No new webhook boundary is introduced; existing HMAC-verified webhook ingestion remains the only external sync trigger. Principles I & II: PASS.
- [x] New visual-profile, scorer, and contract surfaces are typed through Prisma and explicit TypeScript interfaces with no planned `any` escapes. Principle IV: PASS.
- [x] Unit tests for extraction/profile derivation and style-coherence scoring, plus integration tests for the admin route, are part of the implementation scope. Principle V: PASS.
- [x] The merchant review UI stays inside the Polaris knowledge-graph route with App Bridge authentication. Principle I: PASS.

**Post-Design Gate Result**: PASS
