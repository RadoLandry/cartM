# Implementation Plan: Budget-Aware Optimization

**Branch**: `018-product-comparison` | **Date**: 2026-06-02 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/018-budget-aware-optimization/spec.md`

## Summary

Add a budget-aware optimization workflow to storefront chat that transforms an over-budget cart into a shopper-approved, safety-preserving plan. The implementation extends existing chat stream and confirmation infrastructure with a structured optimization context, ranked candidate change proposals, stale-state revalidation, and explicit constraint-blocked outcomes when targets cannot be met safely.

## Technical Context

**Language/Version**: TypeScript 5.9, React 18.3, React Router 7.12  
**Primary Dependencies**: `@shopify/shopify-app-react-router`, `ai` (Vercel AI SDK), Zod 4, Shopify Storefront GraphQL API, Prisma, Vitest 4  
**Storage**: Existing PostgreSQL/Prisma stack for app/session data plus session-scoped in-memory lifecycle state for optimization contexts and confirmations  
**Testing**: Vitest integration tests for route/stream contracts and unit tests for ranking, safety constraints, and stale-state handling  
**Target Platform**: Shopify storefront cart drawer/cart page widget and app backend routes  
**Project Type**: Shopify React Router web application with standalone storefront widget bundle  
**Performance Goals**: >=90% of valid optimization requests produce proposal payload in <=2.0s server time; approved candidate execution acknowledgement in <=1.0s non-error path  
**Constraints**: preserve safety-critical items by default; revalidate price/availability at confirmation; no hard-coded secrets; no blocking storefront cart render during optimization generation  
**Scale/Scope**: one active shopper session per widget instance; cart sizes up to ~20 lines in v1; multiple optimization contexts per session with isolated IDs

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
- This feature modifies storefront chat stream/tooling and confirmation execution routes; webhook behavior is unchanged.
- Network boundaries for this scope remain `api.ai.chat.tsx` and `api.ai.chat.actions.confirm.tsx`, both already schema-validated and origin-scoped.
- No new admin surface is introduced for this feature.

## Project Structure

### Documentation (this feature)

```text
specs/018-budget-aware-optimization/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── storefront-budget-optimization-stream.md
│   ├── storefront-budget-optimization-action.md
│   └── storefront-budget-optimization-data-source.md
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
│   │   ├── storefront-chat.ts
│   │   └── prompts.ts
│   ├── cart-intelligence/
│   │   ├── recommendations.ts
│   │   └── threshold.ts
│   └── shopify/
│       ├── cart.ts
│       └── storefront-cart.ts
storefront-widget/
├── src/
│   ├── hooks/
│   │   └── useStorefrontChat.ts
│   └── components/
│       └── guidance/
tests/
├── integration/
│   └── routes/
│       └── storefront-chat-stream.test.ts
└── unit/
    ├── ai/
    └── storefront/
```

**Structure Decision**: Reuse the existing storefront chat streaming and action-confirmation architecture, extending it with budget optimization-specific schemas, context lifecycle tracking, and UI rendering state. This avoids introducing parallel endpoints and keeps optimization and execution in one session transport model.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| None | N/A | N/A |

## Phase 0: Research Output

Research findings are documented in [research.md](./research.md):

1. Model budget optimization as structured tool output, not free-form text.
2. Reuse confirmation/idempotency lifecycle for candidate execution.
3. Enforce safety-critical constraints as ranking guardrails.
4. Build from current cart + storefront snapshot, with confirm-time revalidation.
5. Return explicit constraint-blocked outcomes for impossible safe targets.
6. Extend integration and unit tests for deterministic optimization behavior.

## Phase 1: Design Output

- Data model: [data-model.md](./data-model.md)
- Contracts:
  - [contracts/storefront-budget-optimization-stream.md](./contracts/storefront-budget-optimization-stream.md)
  - [contracts/storefront-budget-optimization-action.md](./contracts/storefront-budget-optimization-action.md)
  - [contracts/storefront-budget-optimization-data-source.md](./contracts/storefront-budget-optimization-data-source.md)
- Quickstart: [quickstart.md](./quickstart.md)

## Post-Design Constitution Check

- [x] New optimization data fetches remain field-minimal and shopper-focused. Principle III: PASS.
- [x] Budget input, candidate selection, and confirm payloads are schema-validated and session-scoped. Principle II: PASS.
- [x] Webhook behavior is unchanged and existing verified handlers remain intact. Principles I & II: PASS.
- [x] Contracts/data model map cleanly to strict TypeScript/Zod discriminated unions. Principle IV: PASS.
- [x] Design includes integration and unit tests for primary and edge-case stories. Principle V: PASS.
- [x] No admin UI additions; Polaris/App Bridge compliance posture unchanged. Principle I: PASS.
- [x] No secrets introduced in artifacts; existing env-secret model unchanged. Principle II: PASS.

**Post-Design Gate Result**: PASS
