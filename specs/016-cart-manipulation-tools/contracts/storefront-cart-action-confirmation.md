# Contract: Storefront Cart Action Confirmation

## Purpose

Defines explicit shopper approval/decline endpoint for pending cart tool actions.

## Endpoint

- Route: `POST /api/ai/chat/actions/confirm`
- Caller: storefront widget confirmation UI
- Authentication:
  - short-lived `confirmationToken` in body
  - storefront origin check
  - session + shop scope match
- Response: JSON action resolution and updated cart summary when applicable

## Request Body

```json
{
  "shop": "merchant.myshopify.com",
  "sessionKey": "chat_browser-session-123",
  "actionId": "01JY1AJYQ7Y7W1V9M3K11PABR2",
  "confirmationToken": "signed-action-token",
  "decision": "approve",
  "cart": {
    "cartId": "gid://shopify/Cart/123",
    "currencyCode": "USD",
    "items": [
      {
        "lineId": "gid://shopify/CartLine/1",
        "productId": "gid://shopify/Product/1",
        "variantId": "gid://shopify/ProductVariant/11",
        "quantity": 1
      }
    ],
    "subtotal": "129.00"
  }
}
```

Validation rules:
- `decision` is `approve` or `decline`.
- `actionId` and token must refer to same pending action.
- Action must belong to same `shop` and `sessionKey`.

## Success Response

### Approved and executed

```json
{
  "ok": true,
  "result": {
    "actionId": "01JY1AJYQ7Y7W1V9M3K11PABR2",
    "status": "executed",
    "summary": "Updated quantity from 1 to 2.",
    "cart": {
      "cartId": "gid://shopify/Cart/123",
      "currencyCode": "USD",
      "items": [
        {
          "lineId": "gid://shopify/CartLine/1",
          "variantId": "gid://shopify/ProductVariant/11",
          "quantity": 2
        }
      ],
      "subtotal": "258.00"
    }
  }
}
```

### Declined

```json
{
  "ok": true,
  "result": {
    "actionId": "01JY1AJYQ7Y7W1V9M3K11PABR2",
    "status": "declined",
    "summary": "No cart changes were made."
  }
}
```

### Duplicate approval replay

```json
{
  "ok": true,
  "result": {
    "actionId": "01JY1AJYQ7Y7W1V9M3K11PABR2",
    "status": "executed",
    "idempotentReplay": true,
    "summary": "Action already executed earlier."
  }
}
```

## Error Response

```json
{
  "ok": false,
  "error": {
    "code": "ACTION_EXPIRED",
    "message": "This action expired. Please ask again to create a new proposal.",
    "recoveryOptions": [
      "Ask the assistant to propose the action again",
      "Refresh your cart and retry"
    ]
  }
}
```

HTTP status:
- `400` invalid body.
- `401` expired/invalid token.
- `403` scope mismatch or invalid origin.
- `409` stale cart conflict or invalid state transition.
- `422` mutation rejected (stock/merchant rule constraints).

Additional error codes used in the flow:

- `INVALID_ACTION_STATE`
- `UNSUPPORTED_ACTION`
- `MUTATION_ERROR`

## Behavioral Guarantees

- No mutation occurs for `decision=decline`.
- Approval path revalidates cart line and requested variant/quantity at decision time.
- Each `actionId` mutates cart at most once, regardless of duplicate confirmation requests.
- Response includes shopper-readable summary for both success and failure outcomes.
