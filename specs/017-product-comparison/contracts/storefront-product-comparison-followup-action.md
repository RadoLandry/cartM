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
  "shop": "example.myshopify.com",
  "sessionKey": "sess_01HX...",
  "actionId": "act_01HX...",
  "confirmationToken": "<signed-jwt-from-proposal>",
  "decision": "approve",
  "actionType": "comparison_select",
  "comparisonContextId": "cmp_01HX...",
  "selectedProductId": "gid://shopify/Product/1",
  "selectedVariantId": "gid://shopify/ProductVariant/11",
  "cart": {
    "cartId": "gid://shopify/Cart/abc123",
    "currencyCode": "USD",
    "items": [
      {
        "lineId": "gid://shopify/CartLine/1",
        "productId": "gid://shopify/Product/99",
        "variantId": "gid://shopify/ProductVariant/99",
        "quantity": 1
      }
    ]
  }
}
```

Rules:
- `decision` enum: `approve` | `decline`.
- `actionType` must be `comparison_select` for this flow; defaults to `cart_tool` when omitted.
- `confirmationToken` is required and is validated for expiry, shop scope, and sessionKey match.
- `comparisonContextId` required for `actionType=comparison_select`.
- `selectedProductId` must belong to the comparison context.
- `selectedVariantId` required when action applies a variant-level mutation.
- `cart` is optional; when present its `items` array is used to apply the line mutation.

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

`401 ACTION_EXPIRED`
- `confirmationToken` has expired (tokens are short-lived by design).

`403 INVALID_TOKEN_SCOPE`
- Token shop, sessionKey, or actionId does not match the request body.

`403 ORIGIN_NOT_ALLOWED`
- Request origin is not an allowed storefront origin for the given shop.

`404 ACTION_NOT_FOUND`
- `actionId` not found in the server-side action store.

`409 INVALID_ACTION_STATE`
- Action is not in `proposed` state (e.g. already `executing` or `executed`).

`404 CONTEXT_NOT_FOUND`
- `comparisonContextId` not found in session scope.

`409 CONTEXT_SCOPE_MISMATCH`
- Comparison context does not match this session's shop or sessionKey.

`500 ACTION_EXECUTION_ERROR`
- Unexpected backend failure while applying follow-up action.

## Idempotency and Safety

- `actionId` is idempotency key for this confirmation path.
- Duplicate `approve` requests MUST NOT execute cart mutation more than once.
- Decision processing must enforce same shop + session scope as originating comparison context.
