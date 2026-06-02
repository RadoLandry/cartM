# Contract: Product Comparison Follow-up Action

## Purpose

Define request and response schema for applying shopper selections from a rendered comparison context through confirmation-gated action flow.

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
  "actionType": "comparison_select",
  "comparisonContextId": "cmp_01HX...",
  "selectedProductId": "gid://shopify/Product/1",
  "selectedVariantId": "gid://shopify/ProductVariant/11"
}
```

Rules:
- `decision` enum: `approve` | `decline`.
- `comparisonContextId` required for `actionType=comparison_select`.
- `selectedProductId` must belong to the comparison context.
- `selectedVariantId` required when action applies a variant-level mutation.

## Success Response

```json
{
  "actionId": "act_01HX...",
  "status": "executed",
  "comparisonContextId": "cmp_01HX...",
  "selectedProductId": "gid://shopify/Product/1",
  "cartSummary": {
    "lineCount": 3,
    "subtotal": "214.97",
    "currencyCode": "USD"
  },
  "message": "Added the selected option to your cart."
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
- `comparisonContextId` not found in session scope.

`409 STALE_COMPARISON_STATE`
- Product/variant no longer available or price/availability changed beyond allowed tolerance.

`409 ALREADY_RESOLVED`
- Duplicate approval on terminal action returns idempotent replay payload.

`500 ACTION_EXECUTION_ERROR`
- Unexpected backend failure while applying follow-up action.

## Idempotency and Safety

- `actionId` is idempotency key for this confirmation path.
- Duplicate `approve` requests MUST NOT execute cart mutation more than once.
- Decision processing must enforce same shop + session scope as originating comparison context.
