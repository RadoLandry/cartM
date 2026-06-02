# Quickstart: Budget-Aware Optimization

## Goal

Validate end-to-end budget-aware optimization in storefront chat: submit budget target, review ranked optimization proposals, accept/reject candidate changes, and verify cart totals/constraints are respected.

## Prerequisites

- Shopify dev store with CartMind app installed.
- Theme app block enabled so storefront widget loads in cart drawer/page.
- Existing chat bootstrap + SSE stream flow functioning.
- Existing cart action confirmation route functioning.
- Storefront product/cart lookup helpers configured.

## Implementation Targets

Expected touched areas during implementation:
- `app/lib/ai/`
  - extend tool schemas and proposal normalization for budget optimization parts.
  - add optimization context tracking and lifecycle status transitions.
- `app/lib/cart-intelligence/`
  - add candidate ranking/orchestration using cart + knowledge graph signals.
- `app/routes/`
  - extend `api.ai.chat.tsx` stream payloads with optimization proposal events.
  - extend `api.ai.chat.actions.confirm.tsx` with optimization decision handling.
- `storefront-widget/src/hooks/`
  - render optimization proposal rows and bind per-candidate decision actions.
- `tests/integration/routes/` and `tests/unit/`
  - add proposal generation, stale-state, partial-accept, and idempotent replay coverage.

## Local Run

```powershell
npm run dev
```

## Focused Test Commands

```powershell
npx vitest run tests/integration/routes/storefront-chat-stream.test.ts tests/integration/routes/storefront-chat-bootstrap.test.ts
```

After adding budget optimization tests:

```powershell
npx vitest run tests/integration/routes/storefront-chat-budget-optimization.test.ts tests/unit/ai/budget-optimization-ranking.test.ts tests/unit/storefront/budget-optimization-state.test.ts
```

Optional checks:

```powershell
npm run lint
npm run typecheck
```

## Manual Verification Flow

1. Open storefront cart chat with an over-budget cart.
2. Ask for optimization to a target budget.
3. Verify proposal includes baseline subtotal, target, projected subtotal, and ranked candidate changes.
4. Verify safety-critical items are not removed in default proposal.
5. Approve one candidate change and verify cart mutation succeeds with updated subtotal.
6. Reject one candidate and verify recomputed proposal with updated remaining gap.
7. Trigger an unrealistically low budget and verify explicit `constraint_blocked` response.
8. Simulate stale availability/price before confirmation and verify graceful failure + retry guidance.
9. Re-submit the same approval action and verify idempotent replay (no duplicate mutation).

## Acceptance Mapping

- US1: steps 2-3.
- US2: steps 4 and 7.
- US3: steps 5-6.
- Edge cases: steps 7-9.

## Implementation Validation Notes

- Optimization proposals must preserve a unique `optimizationContextId` for all follow-up actions.
- Candidate ranking must enforce safety constraints before savings maximization.
- Confirmation route must revalidate candidate availability and projected totals before mutation.
