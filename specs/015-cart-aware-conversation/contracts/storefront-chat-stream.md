# Contract: Storefront Chat Stream

## Purpose

Defines the direct chat stream contract for cart-aware conversation turns and structured guidance outputs.

## Endpoint

- Route: POST /api/ai/chat
- Caller: storefront widget after successful bootstrap
- Authentication: signed streamToken + scope checks + allowed origin validation
- Transport: text/event-stream (SSE)

## Request Body

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
        "productId": "gid://shopify/Product/1",
        "variantId": "gid://shopify/ProductVariant/11",
        "quantity": 1
      }
    ]
  },
  "messages": [
    {
      "role": "user",
      "content": "Are these items compatible for Muay Thai training?"
    }
  ]
}
```

Validation rules:
- messages must contain at least one message.
- quantity must be >= 1.
- token must be valid, unexpired, and scope-matched to shop/session/cart.
- request origin must be allowed for the shop.

## Stream Parts

Each SSE frame contains JSON payload as data: <json>.

Supported part types:
- text-delta
- guidance-block
- message-complete
- error

Example sequence:

```text
data: {"type":"text-delta","text":"Here is a relevant suggestion based on your cart."}

data: {"type":"guidance-block","block":{"blockId":"recommendation-1","type":"recommendation_list","title":"Recommended cart actions","summary":"Safety and compatibility actions are listed first.","priority":1,"items":[{"title":"Hand Wraps","action":"add","priorityLabel":"high","reason":"Add wraps to improve hand protection.","shopperOutcome":"Improves safety and confidence.","safetyCritical":true,"availability":"available"}]}}

data: {"type":"message-complete","messageId":"chat_browser-session-123-assistant-3"}

```

## Non-Stream Error Response

```json
{
  "ok": false,
  "error": {
    "code": "TOKEN_EXPIRED",
    "message": "Your chat session expired. Please reopen chat and try again."
  }
}
```

HTTP status:
- 400 invalid request body.
- 401 token expired.
- 403 invalid token, invalid scope, or invalid origin.

## Behavioral Guarantees

- Token and origin checks occur before any stream response starts.
- Responses include shopper-safe text and typed guidance, never arbitrary HTML.
- Empty cart input still returns valid assistant output with fallback guidance.
- Recommendation items include explicit action categories (`keep`, `add`, `remove`, `swap`, `size_adjust`) and shopper-readable reasoning for high-priority suggestions.
- Safety and compatibility recommendations are emitted before optional suggestions when both are available.
