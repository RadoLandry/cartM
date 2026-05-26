# Implementation Plan: Size Conflict Detection

**Branch**: `008-size-conflict-detection` | **Date**: 2026-05-26 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/008-size-conflict-detection/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Turn the existing deterministic `detectSizeConflicts` helper into a complete shopper-facing cart-intelligence slice. The plan keeps `CrossSizeMapping`, `SizeChart`, and the Polaris knowledge-graph size tooling as the persisted source of truth, then adds richer conflict result contracts, availability-aware correction suggestions, low-noise multi-conflict handling, and a recommendation payload that storefront and checkout consumers can render without reimplementing sizing logic.

## Technical Context

**Language/Version**: TypeScript 5.x  
**Primary Dependencies**: React Router 7, `@shopify/shopify-app-react-router`, Polaris, Prisma, PostgreSQL, existing sizing helpers in `app/lib/knowledge-graph/sizing.ts`, existing detector in `app/lib/cart-intelligence/size-conflicts.ts`  
**Storage**: PostgreSQL via Prisma; reuse existing `SizeChart`, `CrossSizeMapping`, `ProductVariant`, and `CustomerProfile` schema surfaces with no required new persistence model for v1  
**Testing**: Vitest unit and integration tests in `tests/unit/knowledge-graph`, `tests/unit/cart-intelligence`, and `tests/integration/routes`  
**Target Platform**: Shopify embedded admin app on Vercel serverless plus shopper-facing cart and checkout consumers  
**Project Type**: Web service / embedded Shopify app feature extension  
**Performance Goals**: In-process conflict detection under 50 ms for typical carts; end-to-end shopper payload generation under 200 ms p95; no extra Shopify API round trip in the cart path  
**Constraints**: No LLM calls in request-time detection; merchant overrides remain authoritative through catalog re-syncs; unavailable sizes must not be suggested as the preferred correction; checkout consumers must remain compatible with `@shopify/checkout-ui-extensions-react`; admin changes stay inside Polaris + App Bridge  
**Scale/Scope**: Up to 10k products per merchant; carts up to ~20 lines; cross-size mappings per shop remain O(100); target product types include apparel, protective gear, and weight-based combat-sports sizing

### Planning Assumptions

- The current owning implementation surface is [app/lib/cart-intelligence/size-conflicts.ts](./../../app/lib/cart-intelligence/size-conflicts.ts), which already detects child/adult mismatches and mapping-based warnings but does not yet expose a full shopper-facing contract.
- Merchant configuration for size charts and cross-size mappings already lives in [app/routes/app.knowledge-graph.tsx](./../../app/routes/app.knowledge-graph.tsx), so this feature extends that route rather than introducing a separate size-conflict admin page.
- `ProductVariant.inventoryQuantity`, `sizeValue`, `sizeCategory`, and `sizeNumeric` are sufficient to validate whether a suggested corrective size is actually purchasable without introducing a new inventory model.
- Shopper-facing surfaces do not yet have a dedicated size-conflict recommendation payload builder, so `app/lib/cart-intelligence/recommendations.ts` becomes the nearest shared abstraction for downstream consumers.
- Same-category conflicts are intentionally out of scope for the first release unless a merchant-defined mapping explicitly models them; the spec focuses on cross-item compatibility between related product types.

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
- The planned slice reuses local Prisma-backed sizing data; no new Shopify Admin GraphQL reads are required in the cart path.
- Existing and new admin writes remain Zod-validated in the knowledge-graph route before any mutation.
- No new webhook boundary is introduced; the feature relies on already-synced catalog and variant data.
- Shopper-facing detection stays deterministic and server-side, which keeps the cart path aligned with the no-LLM performance constraint.

## Project Structure

### Documentation (this feature)

```text
specs/008-size-conflict-detection/
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
│   │   ├── size-conflicts.ts                -- extend detector, correction resolution, conflict dedupe
│   │   └── recommendations.ts              -- add shopper-facing size conflict payload builder
│   ├── db/
│   │   └── queries.ts                       -- extend mapping, variant availability, and admin query helpers
│   └── knowledge-graph/
│       └── sizing.ts                        -- extend shared sizing/conflict interfaces and normalization helpers
├── routes/
│   └── app.knowledge-graph.tsx              -- extend size tooling with richer compatibility management and preview/test flow
extensions/
└── checkout-ui/
    └── src/
        └── Checkout.tsx                     -- optional downstream consumer for pre-computed conflict payloads
tests/
├── integration/
│   └── routes/
│       └── knowledge-graph-size-conflicts.test.ts  -- admin loader/action coverage for mapping management
└── unit/
    ├── cart-intelligence/
    │   └── size-conflict-recommendations.test.ts   -- payload-building and correction-selection tests
    └── knowledge-graph/
        └── size-conflicts.test.ts                  -- detector regression and edge-case coverage
```

**Structure Decision**: Extend the existing single-app Shopify architecture. Persisted size intelligence remains in Prisma, conflict logic stays in `app/lib/cart-intelligence`, shared contracts live in `app/lib/knowledge-graph/sizing.ts`, and the Polaris knowledge-graph route remains the merchant control point. Shopper-facing rendering is intentionally downstream from the detector rather than coupled into the core logic.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| None | N/A | N/A |

## Phase 0: Research Output

Research decisions are captured in [research.md](./research.md) and resolve the main planning questions:

1. **Persistence strategy**: Reuse existing `CrossSizeMapping` and `SizeChart` models instead of adding a new conflict-specific persistence layer.
2. **Correction resolution**: Build structured correction suggestions from variant availability and mapping expectations rather than returning a single freeform string.
3. **Detection scope**: Keep detection deterministic and pairwise, but emit separate conflicts for multi-item carts with explicit low-noise skipping for incomplete evidence.
4. **Merchant control**: Keep compatibility management in the existing Polaris knowledge-graph route and extend it only where the richer conflict contract requires additional admin affordances.
5. **Downstream consumption**: Add a size-conflict recommendation payload builder so storefront and checkout surfaces can consume the same canonical result shape.
6. **Weight-based logic**: Use existing size-chart normalization and mapped category rules when they exist; do not introduce an AI scorer or a new measurement model in this slice.

## Phase 1: Design Output

- Data model: [data-model.md](./data-model.md)
- Contracts:
  - [contracts/size-conflict-detection.md](./contracts/size-conflict-detection.md) — canonical cart-analysis input/output contract
  - [contracts/merchant-size-compatibility-admin.md](./contracts/merchant-size-compatibility-admin.md) — knowledge-graph size compatibility loader/action contract
  - [contracts/size-conflict-recommendations.md](./contracts/size-conflict-recommendations.md) — shopper-facing payload contract for cart and checkout consumers
- Quickstart: [quickstart.md](./quickstart.md)

## Post-Design Constitution Check

- [x] The feature continues to use local Prisma-backed sizing data with no new over-fetching GraphQL path. Principle III: PASS.
- [x] Merchant compatibility edits and any preview/test admin actions remain Zod-validated at the route boundary. Principle II: PASS.
- [x] No new webhook surface is introduced; existing HMAC-verified ingestion remains unchanged. Principles I & II: PASS.
- [x] Shared contracts and payload builders remain explicitly typed in TypeScript with no planned `any` escape hatches. Principle IV: PASS.
- [x] Unit tests for detection and payload building plus integration tests for the admin route are part of the implementation scope. Principle V: PASS.
- [x] Admin controls stay within the Polaris knowledge-graph route and App Bridge-authenticated surface. Principle I: PASS.

**Post-Design Gate Result**: PASS
