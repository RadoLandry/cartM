# Contract: Budget Optimization Follow-up Action

## Purpose

Define request and response schema for applying shopper decisions from a budget optimization proposal through confirmation-gated action flow.

## Endpoint

- Route: `/api/ai/chat/actions/confirm`
- Method: `POST`
- Auth: existing storefront chat session token + origin scope validation

## Request Schema

```json
{
  "actionId": "act_01HX...",
  "sessionKey": "sess_01HX...",
  "decision": "approve",
  "actionType": "budget_optimization_select",
  "optimizationContextId": "bo_01HX...",
  "candidateIds": ["cand_1", "cand_2"],
  "cart": {
    "cartId": "gid://shopify/Cart/123"
  }
}
```

Rules:
- `decision` enum: `approve` | `decline`.
- `optimizationContextId` required for `budget_optimization_select`.
- `candidateIds` must belong to optimization context when approving.
- Server revalidates price/availability before execution.

## Success Response

```json
{
  "actionId": "act_01HX...",
  "status": "executed",
  "optimizationContextId": "bo_01HX...",
  "appliedCandidateIds": ["cand_1"],
  "cartSummary": {
    "lineCount": 4,
    "subtotal": "179.90",
    "currencyCode": "USD"
  },
  "message": "Applied accepted budget optimization changes."
}
```

Status enum:
- `declined`
- `expired`
- `executed`
- `failed`

## Error Responses

`400 INVALID_PAYLOAD`
- Schema mismatch or missing required fields.

`404 CONTEXT_NOT_FOUND`
- `optimizationContextId` not found in session scope.

`409 STALE_OPTIMIZATION_STATE`
- Candidate price/availability changed beyond tolerance.

`409 CONSTRAINT_BLOCKED`
- Candidate set violates safety/minimum-kit constraints at execution.

`409 ALREADY_RESOLVED`
- Duplicate approval returns idempotent replay payload.

`500 ACTION_EXECUTION_ERROR`
- Unexpected backend failure while applying accepted candidates.

## Idempotency and Safety

- `actionId` is idempotency key.
- Duplicate `approve` requests MUST NOT execute mutations more than once.
- Execution must enforce same shop + session scope as originating optimization context.
