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

Budget optimization coverage (US1-US3, all phases implemented):

```powershell
npx vitest run tests/integration/routes/storefront-chat-budget-optimization.test.ts tests/unit/ai/budget-optimization-ranking.test.ts tests/unit/ai/budget-optimization-stream-outcome.test.ts tests/unit/storefront/budget-optimization-state.test.ts tests/integration/routes/storefront-chat-action-confirm.test.ts
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
4. Verify safety-critical items are not removed in default proposal (candidates with `critical_removal` impact are excluded from ranking; `reduced_protection` items are ranked after `none`-impact items).
5. Approve one candidate change via `/api/ai/chat/actions/confirm` and verify cart mutation succeeds with updated subtotal.
6. Approve only a subset of the originally proposed candidates (decline the rest) and verify the confirm response recomputes `selectedCandidateIds`, `projectedSubtotal`, and `projectedGapAmount` for the accepted subset only, not the original full-proposal numbers.
7. Trigger an unrealistically low budget where only unsafe removals would close the gap, and verify a `constraint_blocked` result status (partial savings, non-zero `projectedGapAmount`) instead of an unsafe candidate being auto-selected.
8. Simulate a stale/evicted optimization context before confirmation (e.g. re-run confirm against an unknown `optimizationContextId`) and verify a `409 OPTIMIZATION_STALE` failure with retry guidance.
9. Re-submit the same approval action and verify idempotent replay (`idempotentReplay: true`, no duplicate mutation).

## Acceptance Mapping

- US1: steps 2-3.
- US2: steps 4 and 7.
- US3: steps 5-6.
- Edge cases: steps 7-9.

## Implementation Validation Notes

- Optimization proposals must preserve a unique `optimizationContextId` for all follow-up actions.
- Candidate ranking must enforce safety constraints before savings maximization (`rankBudgetOptimizationCandidates` filters `critical_removal` and unavailable candidates, then sorts by safety impact, savings, discipline fit).
- Confirmation route must revalidate candidate availability/safety and projected totals before mutation; `recomputeBudgetOptimizationSelection` recalculates totals for the actually-accepted candidate subset rather than reusing the original full-proposal numbers.
- Confirmation route additionally rejects any accepted candidate with `critical_removal` safety impact at execution time (`422 CONSTRAINT_BLOCKED`), independent of the upstream ranking filter, as defense in depth.
- `insufficient_candidates` proposal results are never forwarded to the client as a `budget-optimization.result`; the chat route remaps them to a `budget-optimization.error` with code `NO_ELIGIBLE_CANDIDATES` (`resolveBudgetOptimizationStreamOutcome`).

## Validation Run Record

- Date: 2026-09-15.
- Command: `npx vitest run tests/integration/routes/storefront-chat-budget-optimization.test.ts tests/unit/ai/budget-optimization-ranking.test.ts tests/unit/ai/budget-optimization-stream-outcome.test.ts tests/unit/storefront/budget-optimization-state.test.ts tests/integration/routes/storefront-chat-action-confirm.test.ts`
- Result: 5 test files passed, 24 tests passed, 0 failed.
- Repo-wide `npx vitest run`: 634/634 tests passing (no regressions from budget optimization US1-US3 work).
- `npm run lint`: clean on all budget-optimization-related files (repo-wide lint has pre-existing unrelated failures documented outside this feature's scope).
- `npm run typecheck`: clean on all budget-optimization-related files; one pre-existing unrelated error remains in `storefront-widget/src/hooks/useChatSessionState.ts` (`toolName ?? "cartTool"` fallback string) predating this feature's implementation.
