# Implementation Plan: Smart Bundle Detection

**Branch**: `009-smart-bundle-detection` | **Date**: 2026-05-26 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/009-smart-bundle-detection/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Add a deterministic bundle-intelligence slice that persists merchant-authored bundle rules, matches carts against full and near-complete bundle definitions, returns shopper-facing completion and savings payloads, and produces a compact downstream rule projection that future Shopify Functions and checkout surfaces can consume without recomputing cart logic.

## Technical Context

**Language/Version**: TypeScript 5.x  
**Primary Dependencies**: React Router 7, `@shopify/shopify-app-react-router`, Polaris, App Bridge, Prisma, PostgreSQL, existing cart-intelligence helpers in `app/lib/cart-intelligence`, existing persistence helpers in `app/lib/db/queries.ts`  
**Storage**: PostgreSQL via Prisma; new bundle persistence will extend the existing catalog and kit-definition schema surfaces  
**Testing**: Vitest unit and integration tests in `tests/unit/cart-intelligence`, `tests/unit/knowledge-graph`, and `tests/integration/routes`  
**Target Platform**: Shopify embedded admin app on Vercel serverless plus shopper-facing cart and future checkout/function consumers  
**Project Type**: Web service / embedded Shopify app feature extension  
**Performance Goals**: In-process bundle matching under 50 ms for typical carts; shopper-facing recommendation payload generation under 200 ms p95; function projection compact enough for Shopify metafield transport  
**Constraints**: Deterministic request-time matching only; no LLM calls in detection; overlapping bundles must avoid misleading double-promotion; admin UI must stay within Polaris + App Bridge; future discount/cart-transform consumers must not rely on Node APIs at function runtime  
**Scale/Scope**: Up to 10k products per merchant; carts up to ~20 lines; active bundle rules per shop expected to remain O(10^2); initial scope covers cart analysis, admin rule management, shopper payload shaping, and function-ready rule projection

### Planning Assumptions

- The current owning cart-intelligence surfaces are `app/lib/cart-intelligence/recommendations.ts` and `app/lib/cart-intelligence/kit-detection.ts`, which establish the pattern for deterministic analysis plus shopper-ready payload builders.
- The repository already persists adjacent merchant-defined merchandising logic through `KitDefinition` and `KitRequirement`, but there is no existing `BundleRule` model or bundle matcher implementation yet.
- The current admin route surface does not include a bundle manager page, so this feature introduces a dedicated Polaris route rather than overloading `app/routes/app.knowledge-graph.tsx` further.
- Existing `Product`, `ProductVariant`, and `ProductRelationship` records provide enough catalog and availability evidence to match bundles and suppress impossible completion suggestions.
- Shopify Function runtime constraints are addressed by projecting compact active bundle rules out of the app backend; the function runtime itself remains a downstream consumer and not the source of truth.

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
- Bundle matching and projection are driven from Prisma-backed merchant rules and synced catalog data, so no new Shopify Admin GraphQL cart-path reads are required.
- Merchant-facing bundle CRUD and preview flows will remain Zod-validated at the route boundary before any persistence change.
- No new webhook boundary is introduced in this slice; existing HMAC-verified webhook infrastructure remains unchanged.
- The feature adds deterministic scoring and payload shaping only, which stays compatible with the no-LLM request-time constraint.

## Project Structure

### Documentation (this feature)

```text
specs/009-smart-bundle-detection/
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
│   │   ├── bundles.ts                    -- new deterministic bundle matcher and overlap handling
│   │   └── recommendations.ts            -- extend with shopper-facing bundle payload builders
│   ├── db/
│   │   └── queries.ts                    -- add bundle rule CRUD, reads, and projection helpers
│   └── knowledge-graph/
│       └── bundles.ts                    -- shared bundle contracts, templates, and shaping helpers
├── routes/
│   └── app.bundles.tsx                   -- new Polaris bundle-rule manager route
prisma/
└── schema.prisma                         -- new bundle rule models and enums
tests/
├── integration/
│   └── routes/
│       └── bundle-rule-manager.test.ts   -- loader/action coverage for admin CRUD and preview
└── unit/
    ├── cart-intelligence/
    │   ├── bundle-detection.test.ts      -- matcher, overlap, and near-complete scenarios
    │   └── bundle-recommendations.test.ts -- shopper payload shaping and prioritization
    └── knowledge-graph/
        └── bundles.test.ts               -- shared contract/template behavior
extensions/
├── discount-function/                    -- later consumer of projected active bundle rules
└── cart-transform/                       -- later consumer of projected bundle presentation data
```

**Structure Decision**: Extend the existing single-app Shopify architecture. Bundle rules become a new persisted merchandising model in Prisma, bundle matching lives in `app/lib/cart-intelligence`, shared request/result interfaces live in `app/lib/knowledge-graph/bundles.ts`, and merchant management gets a dedicated Polaris route rather than further expanding the already broad knowledge-graph page. Future Shopify Function consumers depend on the app-generated projection contract rather than duplicating detection logic.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| None | N/A | N/A |

## Phase 0: Research Output

Research decisions are captured in [research.md](./research.md) and resolve the main planning questions:

1. **Persistence strategy**: Add first-class bundle persistence in Prisma instead of hiding bundle rules inside ad hoc JSON or storefront metafields.
2. **Detection strategy**: Use deterministic rule coverage and quantity satisfaction, with explicit statuses for `qualified`, `nearly_complete`, and `not_applicable`.
3. **Overlap handling**: Return multiple opportunities when legitimate, but annotate competition so downstream surfaces can avoid misleading simultaneous promotions.
4. **Completion guidance**: Build missing-component suggestions from persisted bundle rule components plus current availability evidence.
5. **Merchant control surface**: Introduce a dedicated Polaris bundle manager route rather than overloading the knowledge-graph route.
6. **Function alignment**: Precompute a compact active-rule projection that future discount and cart-transform consumers can read without reimplementing matcher logic.

## Phase 1: Design Output

- Data model: [data-model.md](./data-model.md)
- Contracts:
  - [contracts/bundle-detection.md](./contracts/bundle-detection.md) — canonical cart-analysis request/result contract
  - [contracts/bundle-recommendations.md](./contracts/bundle-recommendations.md) — shopper-facing bundle payload contract for cart and checkout consumers
  - [contracts/merchant-bundle-admin.md](./contracts/merchant-bundle-admin.md) — Polaris bundle manager loader/action contract
- Quickstart: [quickstart.md](./quickstart.md)

## Post-Design Constitution Check

- [x] Bundle reads and future projection queries stay local to Prisma-backed shop data; no new over-fetching Admin GraphQL path is introduced. Principle III: PASS.
- [x] Merchant CRUD and preview/test flows remain validated with Zod at the route boundary before writes. Principle II: PASS.
- [x] No new webhook surface is added in this planning slice; existing HMAC-verified infrastructure remains unchanged. Principles I & II: PASS.
- [x] Shared bundle contracts, matcher outputs, and admin action payloads remain explicitly typed in TypeScript with no planned `any` escape hatches. Principle IV: PASS.
- [x] Unit tests for matcher and recommendation shaping plus integration tests for the admin route are part of the implementation scope. Principle V: PASS.
- [x] Merchant bundle management is planned as a Polaris + App Bridge route. Principle I: PASS.

**Post-Design Gate Result**: PASS
