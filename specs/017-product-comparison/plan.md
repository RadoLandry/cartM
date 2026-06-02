# Implementation Plan: Product Comparison

**Branch**: `017-add-product-comparison` | **Date**: 2026-06-02 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/017-product-comparison/spec.md`

## Summary

Add a comparison workflow to storefront chat that lets shoppers compare multiple products side by side, receive a rationale-backed recommendation, and apply a follow-up choice directly from the comparison outcome. The implementation extends existing storefront chat streaming and action-confirmation infrastructure with a new comparison tool contract, normalized comparison payloads, and session-scoped comparison context to support safe, deterministic follow-up actions.

## Technical Context

**Language/Version**: TypeScript 5.9, React 18.3, React Router 7.12  
**Primary Dependencies**: `@shopify/shopify-app-react-router`, `ai` (Vercel AI SDK), Zod 4, Shopify Storefront GraphQL API, Prisma, Vitest 4  
**Storage**: Existing PostgreSQL/Prisma stack for app data and session-scoped action lifecycle state; in-memory/session widget state for rendered comparison context  
**Testing**: Vitest integration tests for route/stream contracts and unit tests for comparison schema normalization and recommendation logic  
**Target Platform**: Shopify storefront cart drawer/cart page widget plus app backend routes  
**Project Type**: Shopify React Router web application with standalone storefront widget bundle  
**Performance Goals**: >=90% of valid comparisons rendered in <=2.0s server time; follow-up selection acknowledgements visible in <=1.0s for non-error path  
**Constraints**: Comparison output must use field-minimal Storefront GraphQL fetches; follow-up actions require explicit shopper confirmation; no secrets hard-coded; no blocking cart UI while comparison stream is in progress  
**Scale/Scope**: One active shopper session per widget instance; comparison between 2-5 products per request in v1; multiple comparisons per session with isolated context IDs

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
- This feature modifies storefront chat and comparison tooling only; no new webhook entry points are introduced.
- Network boundaries are `api.ai.chat.tsx` (stream/tool payloads) and `api.ai.chat.actions.confirm.tsx` (follow-up confirmation), both covered by schema + scope validation.
- No new admin surfaces are required for this scope, so Polaris/App Bridge posture remains unchanged.

## Project Structure

### Documentation (this feature)

```text
specs/017-product-comparison/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── storefront-product-comparison-stream.md
│   ├── storefront-product-comparison-followup-action.md
│   └── storefront-product-comparison-data-source.md
└── tasks.md
```

### Source Code (repository root)

```text
app/
├── routes/
│   ├── api.ai.chat.tsx
│   ├── api.ai.chat.actions.confirm.tsx
│   └── api.app-proxy.chat-bootstrap.tsx
├── lib/
│   ├── ai/
│   │   ├── tools.ts
│   │   ├── schemas.ts
│   │   └── storefront-chat.ts
│   └── shopify/
│       └── cart.ts
storefront-widget/
├── src/
│   ├── hooks/
│   │   ├── useStorefrontChat.ts
│   │   └── useChatSessionState.ts
│   └── components/
│       └── guidance/
tests/
├── integration/
│   └── routes/
│       └── storefront-chat-stream.test.ts
└── unit/
    └── storefront/
```

**Structure Decision**: Reuse the current storefront chat stream architecture and action-confirmation route, then add comparison-specific schemas/tool handlers and widget rendering state. This avoids introducing a parallel comparison endpoint and keeps comparison + follow-up flows in one session transport model.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| None | N/A | N/A |

## Phase 0: Research Output

Research findings are documented in [research.md](./research.md):

1. Represent product comparison as a tool-call contract with typed stream parts.
2. Fetch comparison data from Storefront GraphQL with minimal field sets and normalization.
3. Bind follow-up selection actions to explicit comparison context IDs and existing confirmation gating.
4. Handle stale availability and pricing with snapshot metadata and deterministic fallback behavior.
5. Validate with integration + unit tests mapped directly to US1-US3 and edge cases.

## Phase 1: Design Output

- Data model: [data-model.md](./data-model.md)
- Contracts:
  - [contracts/storefront-product-comparison-stream.md](./contracts/storefront-product-comparison-stream.md)
  - [contracts/storefront-product-comparison-followup-action.md](./contracts/storefront-product-comparison-followup-action.md)
  - [contracts/storefront-product-comparison-data-source.md](./contracts/storefront-product-comparison-data-source.md)
- Quickstart: [quickstart.md](./quickstart.md)

## Post-Design Constitution Check

- [x] Comparison queries are explicitly field-minimal with normalized response mapping. Principle III: PASS.
- [x] Comparison request payloads and follow-up action payloads are schema-validated and session-scoped. Principle II: PASS.
- [x] No webhook behavior changed. Existing verified handlers remain unchanged. Principles I & II: PASS.
- [x] Contracts and entities use discriminated unions and strict TypeScript-compatible schema definitions. Principle IV: PASS.
- [x] Design includes integration and unit test slices for primary stories and failure states. Principle V: PASS.
- [x] No admin UI additions; existing Polaris/App Bridge compliance remains intact. Principle I: PASS.
- [x] No secrets introduced in design artifacts; existing environment-secret model remains unchanged. Principle II: PASS.

**Post-Design Gate Result**: PASS
