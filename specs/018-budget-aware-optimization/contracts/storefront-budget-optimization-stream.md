# Contract: Storefront Budget Optimization Stream

## Purpose

Define stream payload parts for budget-aware optimization generation within existing `/api/ai/chat` SSE flow.

## Producer and Consumer

- Producer: `app/routes/api.ai.chat.tsx` via AI optimization orchestration.
- Consumer: `storefront-widget/src/hooks/useStorefrontChat.ts` and budget optimization UI renderer.

## Event Types

### 1) `budget-optimization.proposed`

Emitted when assistant captures a valid budget target and starts optimization.

Payload:

```json
{
  "type": "budget-optimization.proposed",
  "optimizationContextId": "bo_01HX...",
  "requestId": "req_01HX...",
  "targetBudgetAmount": 180.0,
  "currencyCode": "USD",
  "requestedAt": "2026-06-02T14:00:00.000Z"
}
```

Validation:
- Positive target budget required.
- Session/shop scope attached server-side.

### 2) `budget-optimization.result`

Emitted with normalized optimization proposal.

Payload:

```json
{
  "type": "budget-optimization.result",
  "optimizationContextId": "bo_01HX...",
  "generatedAt": "2026-06-02T14:00:01.100Z",
  "baselineSubtotal": 249.9,
  "targetBudgetAmount": 180.0,
  "projectedSubtotal": 179.9,
  "projectedGapAmount": 0.0,
  "status": "optimized",
  "candidates": [
    {
      "candidateId": "cand_1",
      "changeType": "swap",
      "sourceLineId": "line_123",
      "sourceProductId": "gid://shopify/Product/1",
      "targetProductId": "gid://shopify/Product/9",
      "estimatedSavings": 35.0,
      "safetyCriticalImpact": "none",
      "rationale": "Maintains discipline fit with lower cost.",
      "disciplineFitScore": 0.92,
      "availability": "available"
    }
  ],
  "constraints": [
    "Safety-critical products are protected from removal."
  ],
  "freshness": {
    "priceCheckedAt": "2026-06-02T14:00:01.000Z",
    "availabilityCheckedAt": "2026-06-02T14:00:01.000Z"
  }
}
```

Validation:
- `projectedSubtotal` must be <= `baselineSubtotal` for `optimized` status.
- Candidates sorted by safety-first, then savings.
- `status` enum: `within_budget` | `optimized` | `constraint_blocked` | `insufficient_candidates`. `constraint_blocked` means some candidates were applied but the target could not be fully reached without unsafe removals; it is still delivered as a `budget-optimization.result`, not an error.
- `candidates` never include a `critical_removal` safety impact; those are filtered out during ranking (see `rankBudgetOptimizationCandidates`).

### 3) `budget-optimization.error`

Emitted for recoverable optimization failures. This includes the case where `buildBudgetOptimizationProposal` produces an `insufficient_candidates` status: the stream never forwards that status as a `result` part, it is remapped to this error event via `resolveBudgetOptimizationStreamOutcome`.

Payload:

```json
{
  "type": "budget-optimization.error",
  "optimizationContextId": "bo_01HX...",
  "code": "NO_ELIGIBLE_CANDIDATES",
  "message": "No viable candidate changes were found to reduce this cart safely.",
  "retryable": true,
  "suggestedNextStep": "Try increasing your budget target or adding alternatives to your cart."
}
```

Validation:
- `code` in known optimization error enum: `INVALID_TARGET_BUDGET` | `EMPTY_CART` | `NO_ELIGIBLE_CANDIDATES` | `UPSTREAM_RATE_LIMIT` | `UNKNOWN`. `UPSTREAM_RATE_LIMIT` is reserved for future upstream throttling handling and is not yet emitted by any code path.
- Shopper-safe message only.

## Ordering Guarantees

- `budget-optimization.proposed` MUST precede `budget-optimization.result` or `budget-optimization.error`.
- `budget-optimization.result` and `budget-optimization.error` are terminal for one context.
- Multiple contexts may interleave but each context preserves order.

## Compatibility Rules

- Optional fields may be added without version bump.
- Removing or renaming required fields requires contract version increment.
