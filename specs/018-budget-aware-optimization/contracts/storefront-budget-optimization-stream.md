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

### 3) `budget-optimization.error`

Emitted for recoverable optimization failures.

Payload:

```json
{
  "type": "budget-optimization.error",
  "optimizationContextId": "bo_01HX...",
  "code": "CONSTRAINT_BLOCKED",
  "message": "Target budget cannot be reached without removing safety-critical items.",
  "retryable": true,
  "suggestedNextStep": "Raise budget or choose reduced kit completeness explicitly."
}
```

Validation:
- `code` in known optimization error enum.
- Shopper-safe message only.

## Ordering Guarantees

- `budget-optimization.proposed` MUST precede `budget-optimization.result` or `budget-optimization.error`.
- `budget-optimization.result` and `budget-optimization.error` are terminal for one context.
- Multiple contexts may interleave but each context preserves order.

## Compatibility Rules

- Optional fields may be added without version bump.
- Removing or renaming required fields requires contract version increment.
