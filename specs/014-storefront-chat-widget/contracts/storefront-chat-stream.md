# Contract: Storefront Chat Stream

## Purpose

Defines the direct backend contract used by the widget to submit shopper messages and receive streamed assistant responses plus structured guidance.

## Endpoint Shape

- **Route**: `POST /api/ai/chat`
- **Caller**: Storefront widget after successful bootstrap
- **Authentication**: Short-lived signed `streamToken` scoped to shop and shopper session
- **Transport**: Server-Sent Events with JSON `data:` frames

## Request

### Body

```json
{
  "shop": "merchant.myshopify.com",
  "sessionKey": "chat_sess_01J...",
  "streamToken": "signed-token",
  "cart": {
    "cartId": "gid://shopify/Cart/123",
    "currencyCode": "USD",
    "items": [
      {
        "productId": "gid://shopify/Product/1",
        "variantId": "gid://shopify/ProductVariant/11",
        "quantity": 1
      }
    ]
  },
  "messages": [
    {
      "role": "user",
      "content": "Do I need wraps with these gloves?"
    }
  ]
}
```

### Validation Rules

- `streamToken` must validate against `shop`, `sessionKey`, and expiration.
- `messages` must include at least the new shopper turn and enough recent history for follow-up context.
- `cart.items[].quantity` must be a positive integer.
- Unknown message roles or malformed cart identifiers are rejected before AI orchestration begins.

## Streamed Assistant Payload Model

The route emits streamed assistant content as ordered parts that the widget reconciles into one assistant message.

### Example SSE frame

```text
data: {"type":"text-delta","text":"Here is a relevant suggestion based on the current cart."}

```

### Supported part types

- `text-delta`: incremental assistant text
- `message-complete`: assistant message finished successfully
- `guidance-block`: typed structured guidance object matching the UI model contract
- `error`: recoverable assistant failure with shopper-safe message

## Example guidance block payload

```json
{
  "type": "guidance-block",
  "block": {
    "blockId": "block-1",
    "type": "recommendation_list",
    "title": "Useful add-ons",
    "summary": "These complement the gloves already in your cart.",
    "priority": 1,
    "items": [
      {
        "productId": "gid://shopify/Product/2",
        "variantId": "gid://shopify/ProductVariant/21",
        "title": "Hand Wraps",
        "reason": "Protects your wrists and knuckles during training."
      }
    ]
  }
}
```

## Error Response

Non-stream startup failures return JSON:

```json
{
  "ok": false,
  "error": {
    "code": "TOKEN_EXPIRED",
    "message": "Your chat session expired. Please reopen chat and try again."
  }
}
```

Expired tokens return HTTP `401`. Malformed or scope-mismatched tokens return HTTP `403`.

## Behavioral Guarantees

- The route never returns arbitrary HTML for storefront rendering.
- Token validation happens before any LLM request is created.
- When rich guidance cannot be produced, the route emits text or a typed fallback block instead of an empty response.
- Duplicate concurrent submissions for the same `sessionKey` are rejected or serialized consistently.