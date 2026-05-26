# Implementation Plan: Style & Colorway Matching

**Branch**: `011-style-colorway-matching` | **Date**: 2026-05-26 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/011-style-colorway-matching/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Complete the shopper-facing style and colorway matching slice by wiring the existing visual-profile knowledge graph into cart recommendation flows, strengthening deterministic coherence scoring for ambiguous and variant-specific cases, and returning subtle add-or-swap guidance that honors merchant overrides without surfacing weak or manipulative recommendations.

## Technical Context

**Language/Version**: TypeScript 5.x  
**Primary Dependencies**: React Router 7, `@shopify/shopify-app-react-router`, Polaris, App Bridge, Prisma, PostgreSQL, Zod, existing visual-profile helpers in `app/lib/knowledge-graph/colorways.ts`, existing style scorer in `app/lib/cart-intelligence/style-coherence.ts`, existing payload builders in `app/lib/cart-intelligence/recommendations.ts`  
**Storage**: PostgreSQL via Prisma; existing `Product`, `ProductVariant`, `ProductVisualProfile`, and `ColorCompatibilityRule` data are reused as the style-matching source of truth  
**Testing**: Vitest unit and integration tests in `tests/unit/cart-intelligence`, `tests/unit/knowledge-graph`, and `tests/integration/routes`  
**Target Platform**: Shopify embedded admin app on Vercel serverless plus shopper-facing cart recommendation surfaces  
**Project Type**: Web service / embedded Shopify app feature extension  
**Performance Goals**: In-process style coherence scoring under 50 ms for carts up to ~20 lines; shopper-facing style payload generation under 200 ms p95; refreshed cart style guidance visible within 1 second end to end  
**Constraints**: Deterministic ranking only; no LLM scoring in the cart path; merchant overrides must outrank inferred matches; unavailable or duplicate products must never be suggested; ambiguous carts should suppress rather than force a recommendation; admin control stays inside Polaris/App Bridge  
**Scale/Scope**: Up to 10k products per merchant; carts up to ~20 lines; style candidate pools expected to remain O(10^2) after category and availability filtering

### Planning Assumptions

- `ProductVisualProfile` and `ColorCompatibilityRule` are already the persisted source of truth for effective colorways, collections, and merchant compatibility intent.
- `app/lib/cart-intelligence/style-coherence.ts` is the owning algorithmic surface for visual scoring, but it still needs stronger suppression and variant-aware handling to satisfy the shopper-facing spec.
- `app/lib/cart-intelligence/recommendations.ts` already contains a `buildVisualRecommendations()` helper, but shopper-facing route integration is incomplete or absent and must be part of this slice.
- Merchant overrides remain managed in the existing `app/routes/app.knowledge-graph.tsx` colorways tab rather than a new top-level admin route.
- The shopper path can hydrate style candidates entirely from Prisma-backed catalog data without live Shopify Admin API reads.

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
- The shopper-facing style slice is designed to run from Prisma-backed product and visual-profile data, so no new Shopify Admin GraphQL query is required in the recommendation path.
- Any new route or preview boundary will validate cart and product identifiers explicitly before hydrating candidate data.
- No new webhook surface is introduced; existing HMAC-verified ingestion and knowledge-graph maintenance remain unchanged.
- Admin-side follow-up stays in the existing Polaris knowledge-graph route rather than introducing a parallel UI system.

## Project Structure

### Documentation (this feature)

```text
specs/011-style-colorway-matching/
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
│   │   ├── style-coherence.ts              -- refine dominant-theme detection, suppression, and swap/add ranking
│   │   └── recommendations.ts             -- extend shopper-facing style payload shaping
│   ├── db/
│   │   └── queries.ts                      -- add cart visual hydration and style candidate sourcing helpers
│   └── knowledge-graph/
│       └── colorways.ts                    -- extend variant-aware effective visual resolution and reasoning helpers
├── routes/
│   ├── app.knowledge-graph.tsx             -- preserve merchant override control; optional preview enhancements
│   └── api.ai.recommendations.tsx          -- new or completed shopper-facing recommendation route for style payloads
tests/
├── integration/
│   └── routes/
│       └── style-recommendations.test.ts   -- route-level coverage for shopper-facing style output
└── unit/
    ├── cart-intelligence/
    │   ├── style-coherence.test.ts         -- extend ambiguity, suppression, and swap-ranking coverage
    │   └── style-recommendations.test.ts   -- new payload-shaping coverage
    └── knowledge-graph/
        └── colorways.test.ts               -- extend variant and effective-visual-resolution coverage
```

**Structure Decision**: Extend the existing single-app Shopify architecture. Merchant-managed visual rules remain in the current knowledge-graph route and Prisma models, while the style-matching slice completes the shopper-facing path by refining the existing scorer, hydrating local candidate data, and shaping a stable recommendation payload for cart consumers.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| None | N/A | N/A |

## Phase 0: Research Output

Research decisions are captured in [research.md](./research.md) and resolve the main planning questions:

1. **Persistence reuse**: Reuse the existing visual-profile and compatibility-rule schema rather than adding a second style-recommendation persistence layer.
2. **Owning code path**: Treat `style-coherence.ts` as the owning analysis layer and `recommendations.ts` as the shopper payload layer.
3. **Candidate sourcing**: Hydrate cart lines and style candidates from Prisma-backed product, variant, and visual-profile data instead of runtime Admin API reads.
4. **Suppression policy**: Suppress shopper-facing guidance when carts are cohesive, ambiguous, or unsupported by credible candidates.
5. **Variant handling**: Prefer selected-variant colorway context when present and fall back to product-level effective colorways otherwise.
6. **Merchant continuity**: Keep merchant control in the existing knowledge-graph colorways tab and reuse the same effective data for shopper-facing output.

## Phase 1: Design Output

- Data model: [data-model.md](./data-model.md)
- Contracts:
  - [contracts/style-coherence-evaluation.md](./contracts/style-coherence-evaluation.md) — internal analysis input/output for cart visual scoring
  - [contracts/shopper-style-recommendations.md](./contracts/shopper-style-recommendations.md) — shopper-facing summary and ranked opportunity payload
  - [contracts/merchant-visual-admin.md](./contracts/merchant-visual-admin.md) — existing admin boundary the shopper slice depends on for approved visual rules
- Quickstart: [quickstart.md](./quickstart.md)

## Post-Design Constitution Check

- [x] The shopper-facing style slice reads Prisma-backed product and visual-profile data, so no new over-fetching Shopify Admin GraphQL path is planned. Principle III: PASS.
- [x] Any new recommendation route or preview boundary will validate incoming cart identifiers and action inputs before hydrating data. Principle II: PASS.
- [x] No new webhook boundary is introduced; existing HMAC-verified ingestion remains the only external sync trigger. Principles I & II: PASS.
- [x] Style analysis, payload contracts, and candidate hydration stay explicitly typed in TypeScript with no planned `any` escape hatches. Principle IV: PASS.
- [x] Unit tests for scoring and payload shaping plus integration tests for the shopper-facing route are part of the implementation scope. Principle V: PASS.
- [x] Merchant-side follow-up remains in the Polaris knowledge-graph route with App Bridge authentication. Principle I: PASS.

**Post-Design Gate Result**: PASS
