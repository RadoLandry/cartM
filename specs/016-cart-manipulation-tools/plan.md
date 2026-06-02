# Implementation Plan: Cart Manipulation via Tools

**Branch**: `016-cart-manipulation-tools` | **Date**: 2026-06-02 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/016-cart-manipulation-tools/spec.md`

## Summary

Add confirmation-gated cart mutation tooling to storefront chat so shoppers can safely add, remove, change quantity, and swap variants through conversation. The implementation extends the existing app-proxy bootstrap + direct SSE stream architecture with typed tool-action proposal and result events, explicit approve/decline flow, stale-state revalidation at confirmation time, and at-most-once execution guarantees using action identifiers and idempotent lifecycle tracking.

## Technical Context

**Language/Version**: TypeScript 5.9, React 18.3, React Router 7.12  
**Primary Dependencies**: `@shopify/shopify-app-react-router`, `ai` (Vercel AI SDK), Zod 4, Shopify Storefront GraphQL API, Prisma, Vitest 4  
**Storage**: Existing PostgreSQL/Prisma stack for application data and server-side action lifecycle records; storefront widget session state for local action history rendering  
**Testing**: Vitest integration tests for route contracts and mutation lifecycle, Vitest unit tests for action reducers/schemas/execution mapping  
**Target Platform**: Shopify storefront cart drawer/cart page widget plus app backend routes  
**Project Type**: Shopify React Router web application with standalone storefront widget bundle  
**Performance Goals**: >=95% of approved actions reflected in cart summary within 2 seconds (SC-002), no blocking cart UI interactions while action proposal/confirmation is in progress  
**Constraints**: Explicit confirmation before every mutation; strict origin/token validation; stale cart revalidation on approval; at-most-once execution for duplicate approvals; no hard-coded secrets  
**Scale/Scope**: One active shopper session per cart widget instance; multiple independently confirmable actions per turn; session-visible action history covering proposed/approved/declined/failed/expired

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
- This feature introduces no new webhook handlers; webhook gate remains satisfied by existing implementation.
- New network boundaries are storefront chat stream and action confirmation routes; both are covered by schema + token + origin validation.
- Feature scope is storefront widget behavior, so Polaris/App Bridge admin UI gate is unaffected.

## Project Structure

### Documentation (this feature)

```text
specs/016-cart-manipulation-tools/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── storefront-cart-tool-stream.md
│   ├── storefront-cart-action-confirmation.md
│   └── storefront-cart-mutation-adapter.md
└── tasks.md
```

### Source Code (repository root)

```text
app/
├── routes/
│   ├── api.ai.chat.tsx
│   ├── api.app-proxy.chat-bootstrap.tsx
│   └── api.ai.chat.actions.confirm.tsx           # new
├── lib/
│   ├── ai/
│   │   ├── schemas.ts
│   │   ├── storefront-chat.ts
│   │   └── tools.ts                              # new
│   ├── shopify/
│   │   ├── app-proxy.ts
│   │   └── storefront-cart.ts                    # new adapter
│   └── cart-intelligence/
storefront-widget/
├── src/
│   ├── hooks/
│   │   ├── useStorefrontChat.ts
│   │   └── useChatSessionState.ts
│   └── components/
│       └── guidance/
tests/
├── integration/routes/
│   ├── storefront-chat-stream.test.ts
│   └── storefront-chat-cart-tools.test.ts        # new
└── unit/
    ├── storefront/
    │   ├── chat-session-state.test.ts
    │   └── chat-action-approval-state.test.ts    # new
    └── ai/
        └── cart-tool-execution.test.ts           # new
```

**Structure Decision**: Reuse existing storefront chat architecture and extend it with a narrow action-confirmation route, typed tool schemas, and a storefront cart mutation adapter so tasks map cleanly to route/service/widget/test boundaries already present in the repo.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| None | N/A | N/A |

## Phase 0: Research Output

Research findings are documented in [research.md](./research.md):

1. Use structured tool proposals with explicit approval gating.
2. Execute approved mutations through Storefront cart mutations.
3. Revalidate line/variant/quantity/cart scope at approval time.
4. Guarantee at-most-once execution with action IDs and token-backed lifecycle.
5. Extend SSE with typed tool action events for deterministic widget rendering.
6. Validate behavior with Vitest integration/unit suites aligned with existing test architecture.

## Phase 1: Design Output

- Data model: [data-model.md](./data-model.md)
- Contracts:
  - [contracts/storefront-cart-tool-stream.md](./contracts/storefront-cart-tool-stream.md)
  - [contracts/storefront-cart-action-confirmation.md](./contracts/storefront-cart-action-confirmation.md)
  - [contracts/storefront-cart-mutation-adapter.md](./contracts/storefront-cart-mutation-adapter.md)
- Quickstart: [quickstart.md](./quickstart.md)

## Post-Design Constitution Check

- [x] Storefront GraphQL mutations are explicitly constrained to field-minimal payloads and normalized errors. Principle III: PASS.
- [x] Stream and confirmation endpoints include schema validation, token verification, and origin checks. Principle II: PASS.
- [x] No webhook surface modified; existing HMAC-compliant handlers remain unchanged. Principles I & II: PASS.
- [x] All new contracts and entities are typed with discriminated unions and strict schemas. Principle IV: PASS.
- [x] Design includes targeted integration/unit test coverage mapped to user stories and edge cases. Principle V: PASS.
- [x] No admin UI scope in this feature; Polaris/App Bridge requirements remain satisfied for existing admin surfaces. Principle I: PASS.
- [x] No secret material introduced in specs/contracts; token signing uses existing env-based secret model. Principle II: PASS.

**Post-Design Gate Result**: PASS
