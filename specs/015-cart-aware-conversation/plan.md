# Implementation Plan: Cart-Aware Conversation

**Branch**: `015-cart-aware-conversation` | **Date**: 2026-05-29 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/015-cart-aware-conversation/spec.md`

## Summary

Deliver a storefront chat experience that is cart-aware on every turn, produces actionable shopping guidance (keep/add/remove/swap/size), and remains consistent when cart state changes. The implementation uses a proxied bootstrap handshake for authenticated shopper session setup, a direct SSE streaming route for low-latency responses, typed guidance blocks for safe rendering, and session-local thread continuity in the widget.

## Technical Context

**Language/Version**: TypeScript 5.9, React 18.3, React Router 7.12  
**Primary Dependencies**: `@shopify/shopify-app-react-router`, `ai`, `@ai-sdk/react`, Zod 4, Vite 6, Vitest 4  
**Storage**: Existing PostgreSQL/Prisma stack for app data; session-local browser state for chat thread continuity in this feature slice  
**Testing**: Vitest integration tests for routes and Vitest unit tests for widget state/render models  
**Target Platform**: Shopify storefront cart drawer/cart page + app backend routes  
**Project Type**: Embedded Shopify web app with dedicated storefront widget bundle  
**Performance Goals**: First streamed assistant output perceived as immediate, chat open/close interaction under 100 ms perceived latency, no cart blocking on chat response  
**Constraints**: App Proxy used only for bootstrap, not streaming; strict boundary validation; storefront origin validation for stream route; no hard-coded secrets  
**Scale/Scope**: One active in-session conversation per shopper session; structured guidance blocks for recommendation/comparison/size/fallback

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
- No new webhook logic is required for this feature; existing webhook standards remain unchanged.
- Chat bootstrap and stream routes are both validated with Zod and token/origin checks before producing outputs.
- This slice introduces shopper storefront behavior, not admin UI surfaces, so Polaris gate is unaffected.

## Project Structure

### Documentation (this feature)

```text
specs/015-cart-aware-conversation/
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
├── routes/
│   ├── api.app-proxy.chat-bootstrap.tsx
│   └── api.ai.chat.tsx
├── lib/
│   ├── ai/
│   │   ├── prompts.ts
│   │   ├── schemas.ts
│   │   └── storefront-chat.ts
│   └── shopify/
│       └── app-proxy.ts
storefront-widget/
├── src/
│   ├── CartMindChat.tsx
│   ├── components/
│   │   ├── ChatPanel.tsx
│   │   ├── ChatMessageList.tsx
│   │   ├── ChatComposer.tsx
│   │   └── guidance/
│   └── hooks/
│       ├── useStorefrontChat.ts
│       └── useChatSessionState.ts
extensions/
└── cart-drawer-block/
    ├── blocks/ai-cart.liquid
    └── assets/cartmind-chat.js
tests/
├── integration/routes/
│   ├── storefront-chat-bootstrap.test.ts
│   └── storefront-chat-stream.test.ts
└── unit/storefront/
    ├── chat-session-state.test.ts
    └── chat-guidance-model.test.ts
```

**Structure Decision**: Reuse the existing dedicated storefront widget plus route-layer chat architecture already present in the repo and formalize cart-aware conversation behavior contracts in this feature's artifacts.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| None | N/A | N/A |

## Phase 0: Research Output

Research decisions are captured in [research.md](./research.md):

1. Use App Proxy bootstrap + direct stream endpoint split.
2. Keep every turn cart-aware using an explicit cart snapshot payload.
3. Keep chat continuity session-local for v1 scope.
4. Use typed guidance blocks instead of free-form markup.
5. Keep token and origin checks at the stream boundary.
6. Validate via route/state automated tests plus focused manual storefront QA.

## Phase 1: Design Output

- Data model: [data-model.md](./data-model.md)
- Contracts:
  - [contracts/storefront-chat-bootstrap.md](./contracts/storefront-chat-bootstrap.md)
  - [contracts/storefront-chat-stream.md](./contracts/storefront-chat-stream.md)
  - [contracts/storefront-chat-ui-model.md](./contracts/storefront-chat-ui-model.md)
- Quickstart: [quickstart.md](./quickstart.md)

## Post-Design Constitution Check

- [x] No additional Shopify Admin GraphQL query is required in the chat turn path; request context stays cart-driven. Principle III: PASS.
- [x] Chat bootstrap and stream boundaries both enforce schema validation and scoped token verification. Principle II: PASS.
- [x] No webhook surface changed; existing HMAC coverage remains intact. Principles I & II: PASS.
- [x] Type-safe Zod contracts and discriminated unions define all new payload surfaces. Principle IV: PASS.
- [x] Route and storefront unit/integration tests cover new behavior slices. Principle V: PASS.
- [x] No new admin UI added. Principle I: PASS.

**Post-Design Gate Result**: PASS
