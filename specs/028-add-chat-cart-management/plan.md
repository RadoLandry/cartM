# Implementation Plan: Chat Cart Management

**Branch**: `[028-add-chat-cart-management]` | **Date**: 2026-06-12 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/028-add-chat-cart-management/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Add complete conversational cart management in the storefront chat so shoppers can add items, remove items, replace variants, and adjust quantities from the cart drawer/cart page flow. The implementation will extend the existing cart tool proposal pipeline, harden mutation execution semantics in the storefront cart mutation adapter, and keep confirmation/idempotency boundaries in `api.ai.chat.actions.confirm.tsx` so every cart change remains explicit, safe, and replay-resistant.

## Technical Context

<!--
  ACTION REQUIRED: Replace the content in this section with the technical details
  for the project. The structure here is presented in advisory capacity to guide
  the iteration process.
-->

**Language/Version**: TypeScript 5.9, React 18.3, React Router 7.12  
**Primary Dependencies**: `zod`, `ai`, `@shopify/shopify-app-react-router`, Shopify app proxy helpers, storefront widget React hooks/components  
**Storage**: In-memory action lifecycle/context stores for chat actions in current slice; existing Prisma/PostgreSQL app data unchanged for this feature scope  
**Testing**: Vitest unit tests for cart tool inference and mutation adapter semantics, Vitest integration tests for confirmation endpoint execution/idempotency, storefront widget action-flow tests  
**Target Platform**: Shopify storefront cart drawer/cart page (Theme App Extension + storefront widget) and app backend routes  
**Project Type**: Shopify embedded web app with storefront widget bundle and server routes  
**Performance Goals**: Successful chat-confirmed cart mutations return confirmation payload in <= 3s for at least 90% of valid requests; no blocking regressions in cart drawer open/close interactions  
**Constraints**: Confirmation token and scope validation required for every execution, no partial destructive cart changes on failed operations, strict TypeScript/no new unjustified `any`, no secrets in code, preserve existing cart controls/UX  
**Scale/Scope**: Session-scoped conversational mutations for add/remove/change-quantity/swap-variant on active cart sessions; excludes checkout mutation UX and admin configuration changes

### Planning Assumptions

- The existing chat action proposal and confirmation flow in `app/lib/ai/tools.ts` and `app/routes/api.ai.chat.actions.confirm.tsx` is the canonical path to extend for cart mutation coverage.
- `app/lib/shopify/storefront-cart.ts` remains the mutation abstraction boundary for this feature phase, with deterministic outcomes and explicit error codes.
- Existing app proxy token checks and origin validation stay mandatory for all storefront chat mutation calls.
- This feature focuses on cart mutation behavior and action semantics, not broader recommendation strategy changes.

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
- No new Shopify Admin GraphQL operations are required for this feature; existing cart payload and storefront mutation abstractions are reused.
- Route boundary validation is already established with Zod and token/origin checks; plan preserves and extends this pattern for new action paths.
- No webhook or admin UI surface changes are part of this scope, so those gates remain satisfied by non-impact.
- New mutation semantics will ship with focused unit/integration tests mapped to each user story.

## Project Structure

### Documentation (this feature)

```text
specs/028-add-chat-cart-management/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)
<!--
  ACTION REQUIRED: Replace the placeholder tree below with the concrete layout
  for this feature. Delete unused options and expand the chosen structure with
  real paths (e.g., apps/admin, packages/something). The delivered plan must
  not include Option labels.
-->

```text
app/
├── lib/
│   ├── ai/
│   │   ├── schemas.ts
│   │   ├── storefront-chat.ts
│   │   └── tools.ts
│   └── shopify/
│       └── storefront-cart.ts
└── routes/
  ├── api.ai.chat.tsx
  └── api.ai.chat.actions.confirm.tsx

storefront-widget/
└── src/
  ├── hooks/
  │   └── useStorefrontChat.ts
  └── components/
    └── ChatMessageList.tsx

extensions/
└── cart-drawer-block/
  └── blocks/
    └── ai-cart.liquid

tests/
├── unit/
│   ├── ai/
│   └── shopify/
└── integration/
  └── routes/
```

**Structure Decision**: Keep the existing single Shopify app + storefront widget structure. Extend chat tool inference, confirmation execution, and mutation adapter behavior in place to avoid new services and preserve current token/idempotency boundaries.

## Phase 0: Research Output

- Completed: [research.md](./research.md)
- All technical unknowns from this feature slice resolved with explicit decisions for intent parsing, mutation execution atomicity, idempotency handling, and storefront synchronization.

## Phase 1: Design & Contracts Output

- Completed: [data-model.md](./data-model.md)
- Completed: [quickstart.md](./quickstart.md)
- Completed: [contracts/chat-cart-management-contract.md](./contracts/chat-cart-management-contract.md)

## Post-Design Constitution Check

- [x] All new GraphQL queries are field-minimal — no over-fetching (Principle III)
- [x] All external inputs validated and sanitized at network boundaries (Principle II)
- [x] Webhook handlers include HMAC signature verification (Principles I & II)
- [x] TypeScript strict mode passes with no new unexcused `any` escapes (Principle IV)
- [x] New business logic has corresponding tests before/alongside implementation (Principle V)
- [x] All admin UI uses Polaris components and App Bridge (Principle I)
- [x] No secrets hard-coded or committed to source control (Principle II)

**Gate Result**: PASS

Post-design notes:
- Contract defines strict request/response validation and terminal action replay semantics for conversational mutations.
- Data model enforces no-partial-update guarantees, explicit conflict handling, and variant/quantity validation boundaries.
- Quickstart maps each user story to automated and manual validation paths, including edge/failure scenarios.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No constitutional violations requiring justification.
