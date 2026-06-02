# Research: Cart Manipulation via Tools

## Decision 1: Use AI SDK tool calls with explicit approval gating before execute

Decision: Model cart operations as four tool definitions (`addToCart`, `removeFromCart`, `changeQuantity`, `swapVariant`) that always produce a proposal first and execute only after an explicit shopper approval event.

Rationale: The feature's primary safety requirement is confirmation-before-mutation. A proposal/approval split guarantees no mutation on generation alone.

Alternatives considered:
- Execute tools immediately and allow undo: rejected because FR-003 requires explicit approval before execution.
- Natural-language confirmation parsing only: rejected because deterministic approve/decline events are required for at-most-once execution.

## Decision 2: Keep bootstrap + direct SSE architecture and add tool proposal events to stream

Decision: Preserve existing flow (`/api/app-proxy/chat-bootstrap` then direct `/api/ai/chat` SSE), extending stream part types for tool proposal and execution status.

Rationale: This architecture is already implemented and tested in the repo for low-latency storefront chat. Extending stream events avoids a parallel transport model.

Alternatives considered:
- Route all interaction through App Proxy: rejected due to streaming reliability and latency concerns.
- Polling endpoint for tool proposals: rejected due to worse UX and increased state drift risk.

## Decision 3: Execute approved cart actions through Shopify Storefront Cart mutations only

Decision: Map approved actions to Storefront API cart mutations (`cartLinesAdd`, `cartLinesUpdate`, `cartLinesRemove`) and a remove+add sequence for variant swap.

Rationale: Cart changes are shopper/storefront operations; Storefront API is the correct surface and aligns with PRD behavior.

Alternatives considered:
- Shopify Admin API mutations: rejected as wrong scope for shopper cart and introduces unnecessary app auth coupling.
- Client-side cart mutation without backend mediation: rejected because approval integrity and idempotency checks must run server-side.

## Decision 4: Enforce stale-state revalidation at approval time

Decision: Re-read cart state on approve, validate target line/variant/quantity/availability, and fail fast with recovery options if state changed.

Rationale: FR-007 and edge cases require safe handling when cart changes between proposal and approval.

Alternatives considered:
- Trust proposal-time cart snapshot: rejected because stale lines and stock changes can produce incorrect mutations.
- Lock cart at proposal time: rejected due to poor shopper experience and complexity.

## Decision 5: Guarantee at-most-once execution using action IDs and idempotency keys

Decision: Assign every proposal an `actionId` and store action lifecycle (`proposed`, `approved`, `declined`, `expired`, `executed`, `failed`). Execute mutations only when status transitions atomically from `approved` to `executing`.

Rationale: FR-009 requires duplicate approvals to be harmless. Lifecycle tracking gives deterministic dedupe and auditability.

Alternatives considered:
- Time-window dedupe by message text: rejected as non-deterministic.
- Client-only dedupe: rejected because duplicate events can still arrive server-side.

## Decision 6: Keep session-visible action history in widget state with server-backed canonical status

Decision: Persist canonical action status server-side and stream action status events; widget renders a session history timeline using those events.

Rationale: FR-010 requires transparent history and robust recovery after reconnect or token refresh.

Alternatives considered:
- Frontend-only history: rejected because stream interruptions and refreshes can lose state.
- Full transcript persistence including all chat content: rejected as scope expansion beyond required action transparency.

## Decision 7: Testing strategy uses existing Vitest route/unit patterns plus new action-flow integration tests

Decision: Add integration tests for proposal/approve/decline/expire/duplicate-approve and unit tests for action validation, idempotency, and mutation mapping.

Rationale: The repo already uses Vitest for routes and storefront state. This gives deterministic coverage mapped to acceptance criteria.

Alternatives considered:
- Manual QA only: rejected by constitution Principle V.
- Introduce a new e2e framework for this slice: rejected as unnecessary for immediate planning scope.
