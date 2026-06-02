# Contract: Storefront Cart Tool Stream

## Purpose

Defines SSE stream parts for confirmation-gated cart tool proposals and lifecycle updates over the existing `POST /api/ai/chat` endpoint.

## Endpoint

- Route: `POST /api/ai/chat`
- Caller: storefront widget after bootstrap
- Authentication: signed `streamToken`, scope check, allowed origin validation
- Transport: `text/event-stream`

## Request Body (unchanged base + tool context)

```json
{
  "shop": "merchant.myshopify.com",
  "sessionKey": "chat_browser-session-123",
  "streamToken": "signed.payload",
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
    ]
  },
  "messages": [
    {
      "role": "user",
      "content": "Swap these gloves to black medium."
    }
  ]
}
```

Validation rules:
- At least one message required.
- Cart line quantities must be >= 1.
- Token must be valid and scope-matched.

## Stream Part Types

### `text-delta`

Assistant incremental text.

```json
{ "type": "text-delta", "text": "I can do that. Please confirm this swap." }
```

### `tool-action-proposed`

Emitted when assistant proposes a cart mutation requiring confirmation.

```json
{
  "type": "tool-action-proposed",
  "action": {
    "actionId": "01JY1AJYQ7Y7W1V9M3K11PABR2",
    "toolName": "swapVariant",
    "shop": "merchant.myshopify.com",
    "sessionKey": "chat_browser-session-123",
    "cartId": "gid://shopify/Cart/123",
    "payload": {
      "lineId": "gid://shopify/CartLine/1",
      "newMerchandiseId": "gid://shopify/ProductVariant/99",
      "quantity": 1
    },
    "preview": {
      "before": "Fairtex BGV1 Red / M",
      "after": "Fairtex BGV1 Black / M",
      "deltaPrice": "$0.00"
    },
    "confirmationToken": "signed-action-token",
    "expiresAt": "2026-06-02T13:30:00.000Z"
  }
}
```

### `tool-action-status`

Emitted when an action transitions state.

```json
{
  "type": "tool-action-status",
  "actionId": "01JY1AJYQ7Y7W1V9M3K11PABR2",
  "status": "executed",
  "summary": "Swapped Fairtex BGV1 Red / M to Black / M.",
  "cart": {
    "cartId": "gid://shopify/Cart/123",
    "currencyCode": "USD",
    "items": [
      {
        "lineId": "gid://shopify/CartLine/1",
        "productId": "gid://shopify/Product/1",
        "variantId": "gid://shopify/ProductVariant/99",
        "quantity": 1
      }
    ],
    "subtotal": "129.00"
  }
}
```

Supported statuses:
- `proposed`
- `approved`
- `declined`
- `expired`
- `executing`
- `executed`
- `failed`

### Existing parts
- `guidance-block`
- `message-complete`
- `error`

## Behavioral Guarantees

- Proposed tool actions are never executed in-stream without explicit confirmation API call.
- Every proposal includes unique `actionId`, expiry, and scoped `confirmationToken`.
- Duplicate terminal status emissions for same `actionId` must be idempotent replays, not duplicate executions.
- Stream continues to deliver regular assistant guidance around action events.
