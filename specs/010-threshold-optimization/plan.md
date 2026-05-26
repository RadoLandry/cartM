# Implementation Plan: Threshold Optimization

**Branch**: `010-optimize-threshold` | **Date**: 2026-05-26 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/010-threshold-optimization/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Add a deterministic threshold-optimization slice that lets merchants define active spend thresholds, evaluates near-threshold carts against those rules, ranks up to three contextually relevant add-on products, and returns shopper-facing reasoning while suppressing filler recommendations when the cart lacks a credible path to threshold completion.

## Technical Context

**Language/Version**: TypeScript 5.x  
**Primary Dependencies**: React Router 7, `@shopify/shopify-app-react-router`, Polaris, App Bridge, Prisma, PostgreSQL, existing cart-intelligence helpers in `app/lib/cart-intelligence`, existing product relationship and catalog query helpers in `app/lib/db/queries.ts`  
**Storage**: PostgreSQL via Prisma; new threshold-rule persistence extends the existing merchant-authored merchandising models  
**Testing**: Vitest unit and integration tests in `tests/unit/cart-intelligence` and `tests/integration/routes`  
**Target Platform**: Shopify embedded admin app on Vercel serverless plus shopper-facing cart recommendation surfaces  
**Project Type**: Web service / embedded Shopify app feature extension  
**Performance Goals**: In-process threshold evaluation under 50 ms for typical carts; shopper-facing threshold payload generation under 200 ms p95; refreshed cart recommendation visibility within 1 second end-to-end  
**Constraints**: Deterministic request-time logic only; no LLM ranking; no filler suggestions below minimum relevance; single shop and currency context per evaluation; v1 uses merchant-managed threshold rules rather than importing native Shopify shipping/discount thresholds automatically; admin UI must stay within Polaris + App Bridge  
**Scale/Scope**: Up to 10k products per merchant; carts up to ~20 lines; active threshold rules per shop expected to remain O(10^1); initial scope covers rule persistence, admin CRUD, evaluation, and shopper payload shaping

### Planning Assumptions

- The current owning shopper-payload surface is `app/lib/cart-intelligence/recommendations.ts`, which already translates deterministic bundle and size-analysis results into cart-ready recommendation payloads.
- Merchant-authored merchandising rules already follow a Prisma + `app/lib/db/queries.ts` + Polaris route pattern through the bundle manager, and Threshold Optimization should mirror that shape.
- `app/routes/app.additional.tsx` is a template placeholder and is the cleanest top-level admin navigation slot to replace with a threshold manager route.
- Existing product catalog, category tags, discipline tags, relationship records, prices, and inventory signals are sufficient for v1 candidate ranking without adding new Shopify Admin API reads in the shopper path.
- Threshold rules in v1 are source-of-truth records inside CartMind rather than a synchronized mirror of Shopify's native shipping or discount configuration.

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
- Threshold Optimization stays on Prisma-backed merchant data and hydrated cart/catalog inputs, so no new Shopify Admin GraphQL query is required on the recommendation path.
- Merchant CRUD inputs and any preview/test payloads will be validated with Zod at the route boundary before persistence or evaluation.
- No webhook surface is added in this slice; existing HMAC-verified webhook infrastructure remains unchanged.
- The feature is deterministic and TypeScript-typed end to end, matching the current bundle and kit logic patterns.

## Project Structure

### Documentation (this feature)

```text
specs/010-threshold-optimization/
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
│   │   ├── threshold.ts                 -- new deterministic threshold evaluator and candidate ranking
│   │   └── recommendations.ts          -- extend with shopper-facing threshold payload builders
│   ├── db/
│   │   └── queries.ts                  -- add threshold rule CRUD, reads, and preview helpers
│   └── knowledge-graph/
│       └── thresholds.ts               -- shared threshold contracts, scoring helpers, and seed templates
├── routes/
│   ├── app.thresholds.tsx              -- new Polaris threshold manager route
│   ├── app.additional.tsx              -- remove or replace placeholder usage
│   └── app.tsx                         -- update top-level admin navigation
prisma/
└── schema.prisma                       -- add threshold rule model(s) and enums
tests/
├── integration/
│   └── routes/
│       └── threshold-manager.test.ts   -- loader/action coverage for admin CRUD and preview
└── unit/
    └── cart-intelligence/
        ├── threshold.test.ts           -- gap calculation, suppression, and ranking behavior
        └── threshold-recommendations.test.ts -- shopper payload shaping and messaging
```

**Structure Decision**: Extend the existing single-app Shopify architecture. Threshold rules become a new persisted merchandising model in Prisma, evaluation lives in `app/lib/cart-intelligence/threshold.ts`, shared rule and scoring contracts live in `app/lib/knowledge-graph/thresholds.ts`, shopper payload shaping stays inside `app/lib/cart-intelligence/recommendations.ts`, and merchant management uses a dedicated Polaris route that replaces the current placeholder additional page in the top-level navigation.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| None | N/A | N/A |

## Phase 0: Research Output

Research decisions are captured in [research.md](./research.md) and resolve the main planning questions:

1. **Threshold source of truth**: Persist threshold rules in CartMind rather than depending on runtime reads of native Shopify shipping or discount configuration.
2. **Evaluation strategy**: Select the nearest qualifying threshold only when the cart is within a merchant-defined actionable window and at least one candidate clears a minimum relevance floor.
3. **Ranking strategy**: Score candidates by contextual fit first, then price-gap fitness and availability, to avoid random filler items.
4. **Suppression policy**: Return no threshold recommendation when the cart is already qualified, too far away, or lacks credible in-stock complements.
5. **Merchant control surface**: Replace the placeholder additional page with a dedicated Polaris threshold manager route following the existing bundle CRUD pattern.
6. **Shopper payload design**: Use the existing recommendation-payload style of summary plus surfaced opportunities with shopper-readable explanations.

## Phase 1: Design Output

- Data model: [data-model.md](./data-model.md)
- Contracts:
  - [contracts/threshold-evaluation.md](./contracts/threshold-evaluation.md) — canonical threshold-analysis request/result contract
  - [contracts/threshold-recommendations.md](./contracts/threshold-recommendations.md) — shopper-facing payload contract for cart surfaces
  - [contracts/merchant-threshold-admin.md](./contracts/merchant-threshold-admin.md) — Polaris threshold manager loader/action contract
- Quickstart: [quickstart.md](./quickstart.md)

## Post-Design Constitution Check

- [x] Threshold Optimization reads only Prisma-backed merchant rule data and already-ingested catalog/cart context; no new over-fetching Admin GraphQL path is introduced. Principle III: PASS.
- [x] Merchant CRUD and preview flows remain Zod-validated at the route boundary before writes or evaluation. Principle II: PASS.
- [x] No new webhook surface is introduced in this planning slice; existing HMAC-verified infrastructure remains unchanged. Principles I & II: PASS.
- [x] Shared threshold contracts, evaluation outputs, and admin payloads remain explicitly typed in TypeScript with no planned `any` escape hatches. Principle IV: PASS.
- [x] Unit tests for evaluation and shopper payload shaping plus integration tests for the admin route are part of the implementation scope. Principle V: PASS.
- [x] Merchant threshold management is planned as a Polaris + App Bridge route. Principle I: PASS.

**Post-Design Gate Result**: PASS
