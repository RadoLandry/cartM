# Implementation Plan: Colorway Preview

**Branch**: `020-run-git-hook` | **Date**: 2026-06-02 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/020-colorway-preview/spec.md`

## Summary

Deliver a deterministic side-by-side colorway comparison flow that reuses the existing kit composition foundation to preview current vs proposed variants, supports partial rendering safely, and optimizes repeat interactions through signature-based reuse.

## Technical Context

**Language/Version**: TypeScript 5.x, React 19, React Router 7.x  
**Primary Dependencies**: `@shopify/shopify-app-react-router`, Storefront cart access helpers, Sharp 0.33.x, Vercel runtime model, Zod 3.x  
**Storage**: PostgreSQL/Prisma for event metadata; blob/object storage for generated preview assets; deterministic lookup metadata keyed by normalized preview signature  
**Testing**: Vitest for unit and integration tests (route, normalization, comparison semantics, reuse behavior)  
**Target Platform**: Shopify storefront cart surfaces via app backend endpoint and storefront widget  
**Project Type**: Shopify embedded web app with storefront widget integration  
**Performance Goals**: Reused preview responses <= 1.0s for most repeat requests; first-generation comparison <= 3.0s for valid carts under normal load  
**Constraints**: Node runtime required for Sharp path; preview must not mutate cart; deterministic output for identical normalized inputs; partial output preferred over hard failure when at least one renderable item exists  
**Scale/Scope**: Shopper carts up to ~20 lines; one proposed swap per request in v1; high-frequency repeat previews within same session

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
- This feature touches storefront preview generation and comparison response semantics; no new admin UI is introduced.
- Input validation applies to proposed swap target, cart scope, and preview request context.
- Existing webhook/HMAC behavior remains unchanged.

## Project Structure

### Documentation (this feature)

```text
specs/020-colorway-preview/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── colorway-preview-endpoint.md
│   ├── colorway-preview-reuse-behavior.md
│   └── colorway-preview-result-semantics.md
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
│   └── shopify/
│       └── cart.ts
storefront-widget/
├── src/
│   ├── components/
│   │   └── chat/
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

**Structure Decision**: Extend the existing `/api/ai/kit-preview` route and visual composition modules so colorway preview remains an incremental enhancement over current kit rendering contracts, avoiding a parallel endpoint surface.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| None | N/A | N/A |

## Phase 0: Research Output

Research findings are documented in [research.md](./research.md):

1. Use Node runtime Sharp composition with side-by-side comparison assembly.
2. Normalize request inputs into stable signatures including proposed swap target.
3. Validate swap eligibility before composition and return actionable invalid states.
4. Reuse generated comparison assets via signature+template version metadata.
5. Prefer partial comparison with omissions over request-wide failure.
6. Keep endpoint and result contracts technology-agnostic and test-oriented.

## Phase 1: Design Output

- Data model: [data-model.md](./data-model.md)
- Contracts:
  - [contracts/colorway-preview-endpoint.md](./contracts/colorway-preview-endpoint.md)
  - [contracts/colorway-preview-reuse-behavior.md](./contracts/colorway-preview-reuse-behavior.md)
  - [contracts/colorway-preview-result-semantics.md](./contracts/colorway-preview-result-semantics.md)
- Quickstart: [quickstart.md](./quickstart.md)

## Post-Design Constitution Check

- [x] Planned cart and variant lookups remain field-minimal and scoped to comparison needs. Principle III: PASS.
- [x] Proposed swap and request payloads are validated at endpoint boundaries before processing. Principle II: PASS.
- [x] Webhook layer is unchanged and existing HMAC verification remains intact. Principles I & II: PASS.
- [x] Design artifacts preserve strict typing expectations for request/result contracts. Principle IV: PASS.
- [x] Unit/integration tests are defined for comparison generation, invalid requests, and reuse paths. Principle V: PASS.
- [x] No admin UI additions are in scope; Polaris/App Bridge compliance remains unchanged. Principle I: PASS.
- [x] No secrets or sensitive constants are introduced in planning artifacts. Principle II: PASS.

**Post-Design Gate Result**: PASS
