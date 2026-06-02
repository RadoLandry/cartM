# Quickstart: Cart Manipulation via Tools

## Goal

Validate confirmation-gated cart manipulation end to end in storefront chat: proposal, approve/decline, revalidation, mutation execution, and action history transparency.

## Prerequisites

- Shopify dev store with app installed.
- Cart drawer app block enabled for storefront widget.
- Existing chat bootstrap + stream endpoints working locally.
- Environment configured for storefront chat signing and Storefront API cart mutation calls.

## Implementation Targets

Expected touched areas during implementation:
- `app/lib/ai/`:
  - add tool definitions and approval orchestration.
  - extend stream schemas for action proposal/status parts.
- `app/routes/`:
  - extend `api.ai.chat.tsx` for proposal emission.
  - add confirmation endpoint for approve/decline processing.
- `app/lib/shopify/`:
  - add Storefront cart mutation adapter and revalidation helpers.
- `storefront-widget/src/hooks/`:
  - consume proposal/status stream parts.
  - submit explicit approve/decline confirmations.
- `tests/integration/routes/` and `tests/unit/storefront/`:
  - add action-flow coverage.

## Local Run

```powershell
npm run dev
```

## Focused Test Commands

Run route and storefront tests for this feature slice:

```powershell
npx vitest run tests/integration/routes/storefront-chat-stream.test.ts tests/integration/routes/storefront-chat-bootstrap.test.ts
```

After adding 016 tests, run:

```powershell
npx vitest run tests/integration/routes/storefront-chat-tool-actions.test.ts tests/unit/storefront/chat-tool-actions.test.ts tests/unit/storefront/chat-session-state.test.ts
```

Optional validation commands:

```powershell
npm run lint
npm run typecheck
```

## Manual Verification Flow

1. Open storefront cart drawer and start chat.
2. Ask to add an item (e.g., "Add the medium variant").
3. Verify a confirmation card appears and no mutation occurs yet.
4. Click decline and verify cart remains unchanged.
5. Ask again, approve, and verify cart updates plus assistant acknowledgement.
6. Trigger quantity change and remove actions; verify exact changes.
7. Trigger a swap request where target variant becomes unavailable before approve; verify failure reason and recovery suggestion.
8. Send duplicate approve events (or double-click) and verify action executes once.
9. Let a proposal expire and verify it cannot be applied afterward.
10. Confirm action history shows proposed/approved/declined/failed/expired statuses clearly.

## Action Lifecycle Semantics

- `proposed`: Action has been suggested and is awaiting shopper confirmation.
- `approved`: Shopper approved the action, not yet executing.
- `declined`: Shopper declined the action; no cart mutation.
- `expired`: Token expired before decision.
- `executing`: Server is currently applying the approved mutation.
- `executed`: Mutation succeeded and cart summary reflects the change.
- `failed`: Mutation rejected or could not be safely applied.

Idempotency rule:

- Duplicate confirmations for terminal actions return idempotent replay results and do not re-run cart mutations.

## Acceptance Mapping

- US1: steps 2-5.
- US2: steps 6 and 8.
- US3: step 7.
- Edge cases: steps 8-9 and multi-action prompts in integration tests.

## Implementation Validation Notes

- 2026-06-02: Confirmation-gated add/remove/change/swap orchestration implemented with action tokens and lifecycle transitions.
- 2026-06-02: Session-visible action history integrated in widget state and panel rendering.
- 2026-06-02: Type diagnostics passed for changed backend + widget modules.
