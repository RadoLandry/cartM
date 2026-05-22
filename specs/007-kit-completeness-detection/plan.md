# Implementation Plan: Kit Completeness Detection

**Branch**: `007-detect-kit-completeness` | **Date**: 2026-05-22 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/007-kit-completeness-detection/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Add a deterministic kit-assessment layer to CartMind's cart-intelligence engine so the app can infer the shopper's discipline intent, score kit completeness, and prioritize missing essentials without calling an LLM in the cart path. The feature builds on the existing taxonomy and relationship graph already stored on `Product` and `ProductRelationship`, introduces merchant-editable `KitDefinition` and `KitRequirement` models, adds a `kit-detection` module plus recommendation payloads, and extends the existing Polaris knowledge-graph route with a `Kits` tab for managing kit compositions, priorities, and substitutes.

## Technical Context

**Language/Version**: TypeScript 5.x  
**Primary Dependencies**: React Router 7, `@shopify/shopify-app-react-router`, Polaris, Prisma, PostgreSQL, Zod, existing taxonomy/relationship query helpers in `app/lib/db/queries.ts`  
**Storage**: PostgreSQL via Prisma; new `KitDefinition` and `KitRequirement` tables alongside existing product taxonomy and relationship data  
**Testing**: Vitest unit and integration tests in `tests/unit/cart-intelligence`, `tests/unit/knowledge-graph`, and `tests/integration/routes`  
**Target Platform**: Shopify embedded admin app on Vercel serverless plus shopper-facing cart recommendation APIs
**Project Type**: Web service / embedded Shopify app feature extension  
**Performance Goals**: Kit assessment should run in-process under 50 ms per cart analysis; the knowledge-graph `Kits` tab should load under 300 ms p95 for the first 50 kit definitions; no additional network round trip should be required during cart scoring  
**Constraints**: No LLM calls in the request-time cart path; multi-discipline carts must be evaluated independently; merchant overrides must survive catalog re-syncs; unavailable or archived products must not be suggested as missing-item recommendations; bundle rules remain distinct from kit-completeness logic  
**Scale/Scope**: Up to 10k products per merchant; initial starter templates for the combat-sports disciplines in the PRD; expected merchant-maintained kit definitions per shop remain under O(50)

### Planning Assumptions

- The current cart-intelligence surface in [app/lib/cart-intelligence/recommendations.ts](C:/Users/Landry/Documents/CARTMIND/cart-mind/app/lib/cart-intelligence/recommendations.ts#L1) has no kit module yet, so `kit-detection.ts` becomes the direct owning abstraction for this behavior.
- The existing knowledge-graph admin route in [app/routes/app.knowledge-graph.tsx](C:/Users/Landry/Documents/CARTMIND/cart-mind/app/routes/app.knowledge-graph.tsx#L1) is already the merchant review hub for taxonomy, visual profiles, and sizing, so kit-definition management belongs there rather than in a separate top-level page.
- Product taxonomy tags and active `ProductRelationship` edges are the authoritative evidence sources for kit inference; request-time kit detection will not query AI providers.
- Existing `BundleRule` data is not reused for this feature because discount-oriented bundle semantics do not capture required-vs-optional slots, substitute logic, or safety priorities.

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
- No new Shopify Admin GraphQL path is expected for kit scoring; the feature reuses already-synced product taxonomy and relationships plus merchant-authored kit metadata stored in Prisma.
- All merchant writes for kit definitions, priorities, and substitutes will be Zod-validated at the route action boundary before any Prisma mutation.
- No new webhook boundary is introduced; any optional default-kit backfill runs as an internal script or sync follow-up using existing authenticated paths.
- The merchant UI stays inside the Polaris knowledge-graph route and follows the same embedded admin conventions already in use.

## Project Structure

### Documentation (this feature)

```text
specs/007-kit-completeness-detection/
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
│   │   ├── kit-detection.ts                  -- NEW: infer kits, score completeness, rank missing items
│   │   └── recommendations.ts               -- extend orchestrator to emit kit recommendations
│   ├── db/
│   │   └── queries.ts                       -- extend with kit definition CRUD and lookup helpers
│   └── knowledge-graph/
│       └── kits.ts                          -- NEW: default kit templates, fulfillment helpers, reasoning utilities
├── routes/
│   └── app.knowledge-graph.tsx              -- extend with Kits tab loader/actions
prisma/
└── schema.prisma                            -- extend with KitDefinition and KitRequirement models
scripts/
└── backfill-kit-definitions.ts              -- NEW: seed or rebuild default kit definitions for a shop
tests/
├── integration/
│   └── routes/
│       └── knowledge-graph-kits.test.ts     -- NEW: loader/action coverage for the Kits tab
└── unit/
    ├── cart-intelligence/
    │   └── kit-detection.test.ts            -- NEW: single-kit, multi-kit, substitute, and complete-cart cases
    └── knowledge-graph/
        └── kits.test.ts                     -- NEW: default template derivation and requirement matching tests
```

**Structure Decision**: Extend the existing single-app Shopify architecture. Kit definitions live as merchant-curated knowledge-graph data in Prisma, the cart-intelligence engine consumes them through deterministic helpers, and the current knowledge-graph admin route is extended rather than creating a new navigation surface.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| None | N/A | N/A |

## Phase 0: Research Output

Research decisions are captured in [research.md](./research.md) and resolve the main planning questions:

1. **Kit persistence**: Introduce first-class `KitDefinition` and `KitRequirement` models instead of overloading `BundleRule` or raw relationship edges.
2. **Inference strategy**: Use a deterministic discipline-first scorer driven by taxonomy tags and active relationship data; do not call AI providers in the cart request path.
3. **Substitute handling**: Let requirement fulfillment recognize direct category matches first, then explicit product matches and alternative-product relationships.
4. **Merchant control**: Extend the existing Polaris knowledge-graph route with a `Kits` tab for editing required items, optional items, priorities, and substitute coverage.
5. **Reasoning trace**: Return structured kit-assessment reasons so downstream cart surfaces can explain inferred kits and prioritized missing items.
6. **Default templates**: Seed baseline combat-sports kit definitions from existing taxonomy/relationship evidence, then treat merchant edits as the source of truth.

## Phase 1: Design Output

- Data model: [data-model.md](./data-model.md)
- Contracts:
  - [contracts/kit-assessment.md](./contracts/kit-assessment.md) — deterministic cart kit-analysis input/output contract
  - [contracts/merchant-kit-admin.md](./contracts/merchant-kit-admin.md) — knowledge-graph `Kits` tab loader/action contract
  - [contracts/kit-recommendations.md](./contracts/kit-recommendations.md) — shopper-facing kit completeness recommendation payload contract
- Quickstart: [quickstart.md](./quickstart.md)

## Post-Design Constitution Check

- [x] The feature reuses existing synced taxonomy and relationship data instead of adding a broad new GraphQL query path, keeping external data access field-minimal. Principle III: PASS.
- [x] All new admin actions for saving kit definitions and requirement priorities are planned with Zod-validated boundaries. Principle II: PASS.
- [x] No new webhook boundary is introduced; existing HMAC-verified webhook handling remains unchanged. Principles I & II: PASS.
- [x] New cart-intelligence and data-model surfaces are typed through Prisma models and explicit TypeScript interfaces with no planned `any` escapes. Principle IV: PASS.
- [x] Unit tests for inference and fulfillment plus integration tests for the admin route are part of the implementation scope. Principle V: PASS.
- [x] The merchant kit editor stays inside the Polaris knowledge-graph route with App Bridge authentication. Principle I: PASS.

**Post-Design Gate Result**: PASS
