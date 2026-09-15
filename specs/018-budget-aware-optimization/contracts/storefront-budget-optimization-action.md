# Contract: Budget Optimization Follow-up Action

## Purpose

Define request and response schema for applying shopper decisions from a budget optimization proposal through confirmation-gated action flow.

## Endpoint

- Route: `/api/ai/chat/actions/confirm`
- Method: `POST`
- Auth: existing storefront chat confirmation token (`confirmationToken`) + origin scope validation

## Request Schema

```json
{
  "shop": "example-shop.myshopify.com",
  "sessionKey": "sess_01HX...",
  "actionId": "act_01HX...",
  "confirmationToken": "opaque_signed_token",
  "decision": "approve",
  "actionType": "budget_optimization_select",
  "optimizationContextId": "bo_01HX...",
  "candidateIds": ["cand_1"],
  "cart": {
    "cartId": "gid://shopify/Cart/123",
    "currencyCode": "USD",
    "items": [
      { "lineId": "line_1", "productId": "gid://shopify/Product/1", "variantId": "gid://shopify/ProductVariant/11", "quantity": 1 }
    ]
  }
}
```

Rules:
- `decision` enum: `approve` | `decline`.
- `optimizationContextId` required for `budget_optimization_select`.
- `candidateIds` is optional; when a shopper accepts only a subset of the originally proposed candidates (declining others), only the accepted ids are sent. Omitting it falls back to the full proposed set stored on the action record.
- Candidate ids not present in the stored optimization context result are silently dropped before execution.
- Server revalidates candidate availability/safety impact before execution and recomputes totals for the actual accepted subset (see Success Response).

## Success Response

Wrapped in the shared confirm-route envelope `{ "ok": true, "result": { ... } }`.

```json
{
  "ok": true,
  "result": {
    "actionId": "act_01HX...",
    "status": "executed",
    "summary": "Applied budget optimization with 1 change.",
    "optimizationContextId": "bo_01HX...",
    "selectedCandidateIds": ["cand_1"],
    "optimizationStatus": "optimized",
    "projectedSubtotal": 179.9,
    "projectedGapAmount": 0.0,
    "cart": { "cartId": "gid://shopify/Cart/123", "currencyCode": "USD", "items": [], "subtotal": "179.90" }
  }
}
```

Notes:
- `selectedCandidateIds`, `optimizationStatus`, `projectedSubtotal`, and `projectedGapAmount` are recomputed by `recomputeBudgetOptimizationSelection` from the actually-accepted candidate subset — they are NOT copied from the original full-proposal `budget-optimization.result` payload when the shopper declined one or more candidates.
- `cart` is the post-mutation cart snapshot returned by `applyBudgetOptimizationSelectionToCart`.
- `status` enum on `result`: `approved` | `declined` | `executed` | `failed` (from `CartToolActionStatus`); `executed` is the terminal success state for an approved budget optimization action.

### Idempotent replay

Re-submitting a decision for an action already in a terminal status (`executed`, `declined`, `failed`, `expired`) returns the same success envelope with the previously computed result and `idempotentReplay: true` — it is not an error.

## Error Responses

All error responses use `{ "ok": false, "error": { "code": ..., "message": ..., "recoveryOptions"?: [...] } }`.

`400 INVALID_PAYLOAD`
- Schema mismatch, or `optimizationContextId` missing for `budget_optimization_select`.

`401`/`403 ACTION_EXPIRED` / `INVALID_CONFIRMATION_TOKEN` / `INVALID_TOKEN_SCOPE`
- Confirmation token missing, expired, or scoped to a different action/shop/session.

`403` (origin code from `assertAllowedStorefrontOrigin`)
- Request origin is not an allowed storefront origin for this shop.

`404 ACTION_NOT_FOUND`
- `actionId` has no matching in-memory cart tool action record.

`404 CONTEXT_NOT_FOUND` / `CONTEXT_SCOPE_MISMATCH`
- `optimizationContextId` not found, or does not match the request's shop/session scope.

`409 INVALID_ACTION_STATE`
- Action already left the `proposed` state through a prior non-terminal transition race.

`409 OPTIMIZATION_STALE`
- Budget optimization result is no longer available in the in-memory context store (e.g. server restart or TTL eviction); shopper must re-run optimization.

`422 INVALID_SELECTION`
- None of the submitted `candidateIds` matched the stored optimization result's candidates.

`422 CONSTRAINT_BLOCKED`
- The accepted candidate subset includes a `critical_removal` safety impact; execution is blocked even if the client attempted to approve it.

`422 MUTATION_ERROR` (or a more specific code from `applyBudgetOptimizationSelectionToCart`)
- Cart mutation failed after validation passed (e.g. stale price/availability at execution time).

## Idempotency and Safety

- `actionId` is the idempotency key; the in-memory action record transitions `proposed` -> `approved`/`declined` -> `executed`/`failed`, and terminal states always replay the same result.
- Execution enforces the same shop + session scope as the originating `budget-optimization.proposed` context.
- Safety-critical (`critical_removal`) candidates are rejected at execution time even if present in the request, independent of the upstream ranking filter.
