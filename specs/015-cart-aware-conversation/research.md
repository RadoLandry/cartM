# Research: Cart-Aware Conversation

## Decision 1: Use App Proxy only for bootstrap and direct backend SSE for chat streaming

Decision: Keep a two-step flow where the storefront calls a proxied bootstrap endpoint first, then posts chat turns directly to the streaming endpoint using a short-lived signed token.

Rationale: App Proxy is suitable for authenticated storefront bootstrap but adds buffering/latency risk for streaming responses. A direct stream endpoint preserves low-latency turn delivery while keeping a scoped auth model.

Alternatives considered:
- Stream through App Proxy end to end: rejected due to unreliable streaming behavior and added latency.
- Public unauthenticated stream endpoint: rejected due to security boundary expansion.

## Decision 2: Enforce cart-awareness on every turn with explicit cart snapshots

Decision: Include the current cart snapshot in each chat turn request and scope token validation to shop/session/cart.

Rationale: The feature's core requirement is turn-level cart awareness. Passing cart state each turn avoids stale assumptions and aligns with changing cart behavior.

Alternatives considered:
- Cache cart context only at session start: rejected because updates during conversation would drift from reality.
- Infer cart context from message history only: rejected because it is less reliable and harder to validate.

## Decision 3: Keep conversation continuity session-local in v1

Decision: Preserve thread continuity in widget state within the shopper session, without introducing persistent transcript storage in this scope.

Rationale: The spec requires same-session continuity, not cross-session history. Session-local state minimizes privacy and retention complexity.

Alternatives considered:
- Persist full transcripts in database: rejected as unnecessary scope expansion for this feature.
- No continuity at all: rejected because follow-up interactions are a core scenario.

## Decision 4: Return typed guidance blocks, never arbitrary storefront markup

Decision: Stream typed guidance blocks (recommendation list, comparison table, size summary, fallback notice) alongside assistant text deltas.

Rationale: Typed contracts support safe rendering, deterministic tests, and robust fallback behavior for unknown or partial content.

Alternatives considered:
- Return HTML snippets from server/model: rejected because validation and security are weaker.
- Return text only: rejected because it cannot express the structured actionable guidance required by the feature.

## Decision 5: Keep strict boundary checks for security and storefront control

Decision: Validate request shapes with Zod, verify signed tokens with TTL and scope checks, and enforce allowed storefront origins on stream requests.

Rationale: This preserves principle-aligned security controls while allowing direct browser-to-backend streaming.

Alternatives considered:
- Token-only check without origin guard: rejected due to broader misuse surface.
- Origin-only check without token scope: rejected due to weak session/cart binding.

## Decision 6: Validate with focused route and widget tests plus manual storefront QA

Decision: Use existing Vitest integration/unit suites for bootstrap route, stream route, and session reducer behavior, then run manual cart drawer/cart page checks.

Rationale: This repository already has the appropriate route/widget testing setup and does not require introducing a new e2e framework for this slice.

Alternatives considered:
- Manual validation only: rejected because constitution requires automated test coverage for new logic.
- Introduce a new browser test framework here: rejected due to setup overhead outside this planning scope.
