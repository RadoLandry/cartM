# Implementation Plan: Kit Composition Renderer

**Branch**: `019-render-kit-composition` | **Date**: 2026-06-02 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/019-render-kit-composition/spec.md`

## Summary

Deliver a server-side kit composition pipeline that converts current cart state into a deterministic visual kit preview, using discipline-aware layouts, robust fallback behavior, and hash-based asset reuse for unchanged carts.

## Technical Context

**Language/Version**: TypeScript 5.x, React 19, React Router 7.x  
**Primary Dependencies**: `@shopify/shopify-app-react-router`, Shopify Storefront API access patterns, Sharp 0.33.x, Vercel runtime model, Zod 3.x  
**Storage**: PostgreSQL/Prisma for app data; blob/object storage for composed image assets; cache metadata keyed by normalized snapshot signature  
**Testing**: Vitest for unit/integration tests with route-level coverage and deterministic composition/caching assertions  
**Target Platform**: Shopify storefront cart surfaces via app backend endpoint  
**Project Type**: Shopify embedded web app with storefront widget integration  
**Performance Goals**: First composition response <= 2.0s in normal path; unchanged-cart reuse responses <= 1.0s for majority of requests  
**Constraints**: `/api/ai/kit-preview` must run on Node runtime; no blocking storefront flows on hard failure; deterministic output for identical normalized inputs; no hard-coded secrets  
**Scale/Scope**: Cart sizes up to approximately 20 lines in v1; one preview request lifecycle per active shopper interaction

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] All new GraphQL queries are field-minimal — no over-fetching (Principle III)
- [x] All external inputs validated and sanitized at network boundaries (Principle II)
- [x] Webhook handlers include HMAC signature verification (Principles I & II)
- [x] TypeScript strict mode passes with no new unexcused `any` escapes (Principle IV)
- [x] New business logic has corresponding tests before/alongside implementation (Principle V)
- [x] All admin UI uses Polaris components and App Bridge (Principle I)
- [x] No secrets hard-coded or committed to source control (Principle II)

**Gate Result**: PASS

Notes:
- This feature primarily affects storefront preview endpoint and composition modules; webhook surface is unchanged.
- Boundary validation applies to preview request payloads and normalized cart snapshot construction.
- No new admin pages are introduced in this scope.

## Project Structure

### Documentation (this feature)

```text
specs/019-render-kit-composition/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── kit-preview-endpoint.md
│   ├── kit-preview-cache-behavior.md
│   └── kit-preview-composition-result.md
└── tasks.md
```

### Source Code (repository root)

```text
app/
├── routes/
│   └── api.ai.kit-preview.tsx
├── lib/
│   ├── visual/
│   │   ├── compositor.ts
│   │   └── templates.ts
│   ├── cart-intelligence/
│   │   └── recommendations.ts
│   └── shopify/
│       └── storefront-cart.ts
storefront-widget/
├── src/
│   ├── components/
│   │   └── guidance/
│   └── hooks/
│       └── useStorefrontChat.ts
tests/
├── integration/
│   └── routes/
│       └── kit-preview-route.test.ts
└── unit/
    └── visual/
        ├── compositor.test.ts
        └── templates.test.ts
```

**Structure Decision**: Extend existing backend route and visual subsystem rather than introducing a parallel service. Keep composition logic in visual library modules and expose deterministic behavior through a single kit-preview endpoint consumed by storefront experiences.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| None | N/A | N/A |

## Phase 0: Research Output

Research findings are documented in [research.md](./research.md):

1. Node runtime + Sharp is mandatory for server-side composition compatibility.
2. Canonical cart normalization is required for deterministic output and stable cache keys.
3. Discipline-first layouts with mixed fallback satisfy relevance and resiliency goals.
4. Hash-based reuse strategy is preferred over time-only caching.
5. Partial composition with omission reporting improves reliability under imperfect catalog data.
6. Contract-first endpoint definitions keep behavior testable and implementation-agnostic.

## Phase 1: Design Output

- Data model: [data-model.md](./data-model.md)
- Contracts:
  - [contracts/kit-preview-endpoint.md](./contracts/kit-preview-endpoint.md)
  - [contracts/kit-preview-cache-behavior.md](./contracts/kit-preview-cache-behavior.md)
  - [contracts/kit-preview-composition-result.md](./contracts/kit-preview-composition-result.md)
- Quickstart: [quickstart.md](./quickstart.md)

## Post-Design Constitution Check

- [x] Planned cart data access remains field-minimal and scoped to composition needs. Principle III: PASS.
- [x] Request payloads and composition inputs are explicitly validated at endpoint boundaries. Principle II: PASS.
- [x] Webhook behavior is unchanged; existing verified handlers remain intact. Principles I & II: PASS.
- [x] Contracts and data model align to strict TypeScript/Zod typing expectations. Principle IV: PASS.
- [x] Design includes targeted unit and integration tests for composition, fallback, and cache reuse behavior. Principle V: PASS.
- [x] No admin UI additions; Polaris/App Bridge compliance remains unchanged. Principle I: PASS.
- [x] No secrets are introduced in artifacts or contracts. Principle II: PASS.

**Post-Design Gate Result**: PASS
