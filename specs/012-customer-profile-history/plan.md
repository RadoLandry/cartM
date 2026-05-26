# Implementation Plan: Customer Profile & History

**Branch**: `012-customer-profile-history` | **Date**: 2026-05-26 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/012-customer-profile-history/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Expand the current size-only customer persistence into a lightweight shopper-profile pipeline that resolves persistent and session-scoped personalization context, feeds that context into recommendation flows, and keeps purchase-history hydration off the shopper request path by using locally persisted profile summaries instead of live Admin API lookups.

## Technical Context

**Language/Version**: TypeScript 5.x  
**Primary Dependencies**: React Router 7, `@shopify/shopify-app-react-router`, Prisma, PostgreSQL, Zod, existing cart-intelligence recommendation builders, existing Shopify GraphQL helper module  
**Storage**: PostgreSQL via Prisma; expand the existing `CustomerProfile` row and reuse JSON-backed summary fields for inferred and explicit profile data  
**Testing**: Vitest unit and integration tests in `tests/unit/cart-intelligence` and `tests/integration/routes`  
**Target Platform**: Shopify embedded app on Vercel with shopper-facing recommendation APIs consumed by storefront/cart surfaces  
**Project Type**: Web service / embedded Shopify app feature extension  
**Performance Goals**: Profile resolution from local persistence under 50 ms per request; personalized recommendation enrichment under 200 ms p95; no synchronous Shopify Admin API reads in the shopper request path  
**Constraints**: Explicit shopper inputs must outrank inferred signals; anonymous personalization must remain session-scoped until identity is established; GraphQL history hydration must be field-minimal and background-friendly; recommendation behavior must degrade gracefully under sparse or conflicting evidence  
**Scale/Scope**: Up to 100k shopper profiles per merchant, carts up to ~20 lines, repeated recommendation requests per active session, and lightweight per-shop profile summaries rather than full order-history replication

### Planning Assumptions

- The existing `CustomerProfile` Prisma model is the correct persistence anchor and should be extended rather than replaced by a second customer-profile subsystem.
- The repo already supports profile-aware sizing through `sizeProfile`; this slice generalizes that same persistence layer into broader personalization context.
- The shopper-facing route can receive `shopifyCustomerId`, `sessionId`, and explicit profile inputs from upstream storefront or app-proxy integration even though that wiring is not complete yet.
- Purchase history should be summarized into local profile data ahead of recommendation use; live Admin API reads during shopper recommendation requests are out of scope for this slice.
- Recommendation payload shaping should remain centralized in `app/lib/cart-intelligence/recommendations.ts` so future non-style recommendation slices can consume the same personalization context.

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
- Shopper-request personalization will resolve against local Prisma data, so any new Shopify GraphQL customer or order lookups stay outside the latency-sensitive recommendation path.
- Route inputs such as `shopifyCustomerId`, `sessionId`, and explicit profile fields will be validated with Zod before profile resolution.
- If order or customer-history webhooks are added in implementation, they will follow the same authenticated Shopify webhook route pattern already used for product sync.
- No new admin surface is required for this slice; existing Polaris/App Bridge conventions remain intact.

## Project Structure

### Documentation (this feature)

```text
specs/012-customer-profile-history/
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
│   │   ├── customer-profile.ts           -- new profile resolution, inference, confidence, and merge logic
│   │   └── recommendations.ts            -- extend shopper payload shaping to consume personalization context
│   ├── db/
│   │   └── queries.ts                     -- expand customer-profile fetch/upsert/merge/query helpers
│   ├── knowledge-graph/
│   │   └── sizing.ts                      -- continue consuming saved size profile data from resolved personalization context
│   └── shopify/
│       └── graphql.ts                     -- add field-minimal customer/order summary queries if background history hydration is needed
├── routes/
│   ├── api.ai.recommendations.tsx         -- validate shopper identity/profile input and inject personalization context
│   ├── webhooks.orders.create.tsx         -- optional purchase-summary refresh trigger if order webhooks are adopted
│   └── webhooks.orders.updated.tsx        -- optional purchase-summary refresh trigger for post-purchase profile maintenance
prisma/
└── schema.prisma                          -- extend CustomerProfile persistence fields
tests/
├── integration/
│   └── routes/
│       └── customer-profile-recommendations.test.ts
└── unit/
    └── cart-intelligence/
        ├── customer-profile.test.ts
        └── personalized-recommendations.test.ts
```

**Structure Decision**: Extend the existing single-app Shopify architecture. Customer-profile persistence stays in Prisma, profile resolution and confidence logic live in a dedicated cart-intelligence module, and the existing recommendation route becomes the shopper-facing integration surface for identity-aware personalization.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| None | N/A | N/A |

## Phase 0: Research Output

Research decisions are captured in [research.md](./research.md) and resolve the main planning questions:

1. **Persistence model**: Expand the existing `CustomerProfile` row with structured summary fields instead of introducing a second profile store.
2. **Owning logic surface**: Add a dedicated `app/lib/cart-intelligence/customer-profile.ts` module for profile resolution, signal merging, and confidence scoring.
3. **History hydration strategy**: Keep shopper requests DB-only and refresh purchase-history summaries asynchronously or outside the recommendation path.
4. **Identity precedence**: Resolve identified shoppers by `shopifyCustomerId`, fall back to `sessionId`, and merge anonymous state forward once identity is established.
5. **Override policy**: Explicit shopper inputs override inferred attributes, while low-confidence or conflicting evidence softens personalization.
6. **Recommendation integration**: Extend the recommendation route and payload layer to consume personalization context rather than creating a separate customer-profile endpoint for cart analysis.

## Phase 1: Design Output

- Data model: [data-model.md](./data-model.md)
- Contracts:
  - [contracts/profile-resolution.md](./contracts/profile-resolution.md) — internal profile resolution input/output contract
  - [contracts/recommendation-personalization-request.md](./contracts/recommendation-personalization-request.md) — shopper-facing request contract for passing identity and explicit profile input
  - [contracts/profile-update-ingestion.md](./contracts/profile-update-ingestion.md) — persistence/update contract for signal merges and purchase-summary refresh
- Quickstart: [quickstart.md](./quickstart.md)

## Post-Design Constitution Check

- [x] Any added Shopify GraphQL customer/order queries remain field-minimal and stay off the shopper request path. Principle III: PASS.
- [x] Request payloads carrying shopper identifiers or explicit profile inputs are validated at the route boundary before profile resolution. Principle II: PASS.
- [x] Any future order/customer webhook additions will reuse authenticated Shopify webhook handlers with HMAC verification. Principles I & II: PASS.
- [x] Profile resolution, merge logic, and payload shaping remain explicitly typed with Prisma/Zod/TypeScript contracts and no planned `any` escape hatches. Principle IV: PASS.
- [x] Unit coverage for profile inference and integration coverage for identity-aware recommendation routes are part of scope. Principle V: PASS.
- [x] No new admin UI is required; existing embedded admin surfaces remain Polaris/App Bridge based. Principle I: PASS.

**Post-Design Gate Result**: PASS
