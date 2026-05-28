# Implementation Plan: Chat Interface (Storefront Widget)

**Branch**: `014-add-chat-widget` | **Date**: 2026-05-28 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/014-storefront-chat-widget/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Add a storefront chat experience that opens directly from the cart drawer or cart page, streams shopper-safe assistant responses with inline structured shopping guidance, and ships through a dedicated storefront widget bundle plus theme app extension delivery. Secure shopper bootstrap will go through an authenticated app-proxy handshake, while the streamed chat endpoint will use a short-lived signed session token because Cloudflare-backed app proxies are not suitable for streaming.

## Technical Context

**Language/Version**: TypeScript 5.9, React 18.3, React Router 7.12  
**Primary Dependencies**: `@shopify/shopify-app-react-router`, `@shopify/app-bridge-react`, Prisma, Zod, `ai` 6.x, `@ai-sdk/openai`, new `@ai-sdk/react` for client streaming, Vite 6.x, Shopify Theme App Extension tooling  
**Storage**: PostgreSQL via Prisma for existing shop/session data; no long-term transcript persistence in v1, with session transcript state held in the widget and short-lived signed bootstrap tokens issued server-side  
**Testing**: Vitest integration tests for new routes, Vitest unit tests for chat state/response modeling, targeted storefront UI tests for reducer/render helpers, manual Shopify theme validation for drawer and full-cart flows  
**Target Platform**: Shopify embedded app backend on Node/Vercel plus storefront Theme App Extension assets rendered in shopper browsers  
**Project Type**: Embedded Shopify web app with a dedicated storefront widget bundle  
**Performance Goals**: Chat entry point visible within cart render budget; first streamed token under 1 second in local/staging validation; widget open/close interactions under 100 ms perceived latency; no blocking cart render on AI completion  
**Constraints**: Storefront UI must stay isolated from merchant themes via Shadow DOM; app proxy is acceptable for bootstrap/auth but not for streaming; all request bodies and signed shopper tokens must be validated at the route boundary; current repo has no existing storefront widget package or chat endpoint; repo-wide `npm run typecheck` is currently affected by a known unrelated `size-conflicts.ts` issue  
**Scale/Scope**: Session-scoped chat for cart drawer and cart page, one active conversation per shopper session, structured response blocks for recommendations/comparisons/size guidance, and no long-term transcript history in this slice

### Planning Assumptions

- The existing shopper recommendation route and cart-intelligence payload builders are the nearest reusable backend surfaces for cart-aware guidance, but this feature requires a dedicated streaming chat route rather than extending the JSON recommendation route.
- Because the repository currently has no `api.ai.chat.tsx`, no app-proxy route, and no storefront widget bundle, this feature must establish the minimal storefront delivery stack rather than only adding UI chrome.
- The first implementation keeps chat transcripts session-local in the widget so the feature can launch without adding persistent conversation tables or moderation dashboards.
- Structured guidance blocks can be derived from server-produced typed UI models and rendered by the widget without relying on admin-only Polaris components.
- The theme app extension remains the delivery mechanism for the cart entry point; Checkout UI extensions and cart-manipulation approvals stay out of scope for this feature.

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
- No new Shopify Admin GraphQL reads are required on the shopper message path; cart-aware context is built from the existing local recommendation/profile surfaces plus request payloads.
- The chat bootstrap and streaming routes will both validate inputs with Zod before any token issuance or AI call, preserving Principle II at the network boundary.
- No new webhook handlers or admin pages are required in this slice, so the webhook and Polaris gates remain satisfied by staying out of scope.
- New chat state reducers, route serializers, and response-block mappers will be covered by focused Vitest unit/integration tests to satisfy Principle V.

## Project Structure

### Documentation (this feature)

```text
specs/014-storefront-chat-widget/
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
│   ├── ai/
│   │   ├── prompts.ts                      -- extend with cart-chat system prompt builders
│   │   ├── providers.ts                    -- reuse provider selection for streaming chat
│   │   ├── schemas.ts                      -- typed structured-guidance schemas for chat responses
│   │   └── storefront-chat.ts              -- new server-side chat orchestration and token validation
│   ├── cart-intelligence/
│   │   └── recommendations.ts              -- reuse shopper-facing recommendation payload builders for rich chat blocks
│   └── shopify/
│       └── app-proxy.ts                    -- new app-proxy signature and shopper bootstrap helpers
├── routes/
│   ├── api.ai.chat.tsx                     -- new direct streaming endpoint for storefront chat
│   └── api.app-proxy.chat-bootstrap.tsx    -- new authenticated bootstrap endpoint for widget session/token issuance
storefront-widget/
├── package.json                            -- new widget package/build entry for shopper-facing React bundle
├── vite.config.ts                          -- widget-specific library build for theme extension assets
└── src/
    ├── CartMindChat.tsx                    -- chat root mounted inside the cart surface shadow root
    ├── components/
    │   ├── ChatPanel.tsx                   -- open/collapse/close shell
    │   ├── ChatMessageList.tsx             -- chronological thread UI
    │   ├── ChatComposer.tsx                -- shopper input and submit states
    │   └── guidance/                       -- structured guidance renderers (comparison, recommendation, size summary)
    ├── hooks/
    │   ├── useStorefrontChat.ts            -- session bootstrap + transport wiring
    │   └── useChatSessionState.ts          -- reducer/local persistence for same-session reopen behavior
    └── styles/
        └── chat.css                        -- isolated widget styles scoped to the shadow root
extensions/
└── cart-drawer-block/
    ├── blocks/
    │   └── ai-cart.liquid                  -- theme block mounting the widget entry point in cart drawer/page contexts
    └── assets/
        └── cartmind-chat.js                -- built widget asset loaded by Shopify CDN
tests/
├── integration/
│   └── routes/
│       ├── storefront-chat-bootstrap.test.ts
│       └── storefront-chat-stream.test.ts
└── unit/
    └── storefront/
        ├── chat-session-state.test.ts
        └── chat-guidance-model.test.ts
```

**Structure Decision**: Use the existing app for secure server routes and AI orchestration, and introduce a dedicated `storefront-widget/` bundle plus `extensions/cart-drawer-block/` delivery path because the current React Router app build does not produce shopper-safe Shopify theme assets on its own.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| None | N/A | N/A |

## Phase 0: Research Output

Research decisions are captured in [research.md](./research.md) and resolve the main planning questions:

1. **Streaming transport**: Use a direct chat endpoint with short-lived signed bootstrap tokens instead of attempting to stream through Shopify App Proxy.
2. **Storefront delivery**: Introduce a dedicated widget bundle mounted by a theme app extension so the chat can render inside cart drawer/page surfaces with Shadow DOM isolation.
3. **Session model**: Keep conversation history session-local in the widget for v1, avoiding premature transcript persistence and moderation/admin scope.
4. **Structured response model**: Return typed guidance blocks from the server and render them with a discriminated client model rather than generating arbitrary HTML.
5. **Backend reuse**: Reuse existing recommendation/profile builders to assemble cart-aware context and suggestion cards instead of duplicating product-logic rules inside the chat route.
6. **Validation strategy**: Cover route contracts and local session state with Vitest automation, then validate theme behavior manually in Shopify cart drawer and cart page contexts.

## Phase 1: Design Output

- Data model: [data-model.md](./data-model.md)
- Contracts:
  - [contracts/storefront-chat-bootstrap.md](./contracts/storefront-chat-bootstrap.md) — authenticated bootstrap contract for the widget session and streaming token
  - [contracts/storefront-chat-stream.md](./contracts/storefront-chat-stream.md) — storefront chat request/response contract for streamed assistant output and structured guidance blocks
  - [contracts/storefront-chat-ui-model.md](./contracts/storefront-chat-ui-model.md) — client-side discriminated model for rendering thread items and guidance blocks
- Quickstart: [quickstart.md](./quickstart.md)

## Post-Design Constitution Check

- [x] Shopper chat uses local cart/profile inputs and a signed bootstrap token, so no new over-fetched Admin GraphQL dependency is introduced on the message path. Principle III: PASS.
- [x] Bootstrap requests, streaming chat bodies, and signed token verification are all explicitly validated at the route boundary with Zod and server-side signature checks. Principle II: PASS.
- [x] No new webhooks are required for this feature, preserving existing authenticated webhook boundaries without expanding that risk surface. Principles I & II: PASS.
- [x] The design introduces typed server schemas and client discriminated unions rather than free-form HTML payloads or `any`-based widget rendering. Principle IV: PASS.
- [x] Focused Vitest route and unit coverage is part of scope for the new chat transport and session-state logic. Principle V: PASS.
- [x] No new admin UI is introduced; storefront UI is isolated to the theme widget and does not weaken the embedded Polaris/App Bridge requirements for admin surfaces. Principle I: PASS.

**Post-Design Gate Result**: PASS
