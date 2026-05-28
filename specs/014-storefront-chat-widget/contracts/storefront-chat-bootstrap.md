# Contract: Storefront Chat Bootstrap

## Purpose

Defines the authenticated bootstrap exchange that the storefront widget uses to start a chat session and obtain a short-lived streaming token.

## Endpoint Shape

- **Route**: `POST /api/app-proxy/chat-bootstrap`
- **Caller**: Theme App Extension storefront widget through Shopify App Proxy
- **Authentication**: Shopify App Proxy signature validation plus shop-bound request validation

## Request

### Body

```json
{
  "shop": "merchant.myshopify.com",
  "cartId": "gid://shopify/Cart/123",
  "surface": "cart_drawer",
  "sessionId": "browser-session-abc",
  "currencyCode": "USD"
}
```

### Validation Rules

- `shop` is required and must match the proxied shop.
- `surface` must be either `cart_drawer` or `cart_page`.
- `sessionId` is required and must be an opaque browser-generated identifier.
- `cartId` is optional.
- Unknown fields are ignored or rejected consistently via schema validation.

## Response

```json
{
  "ok": true,
  "bootstrap": {
    "shop": "merchant.myshopify.com",
    "cartId": "gid://shopify/Cart/123",
    "sessionKey": "chat_sess_01J...",
    "streamToken": "signed-token",
    "expiresAt": "2026-05-28T14:05:00.000Z",
    "chatUrl": "https://app.example.com/api/ai/chat",
    "conversationLimits": {
      "maxMessages": 20,
      "maxInputCharacters": 2000
    }
  }
}
```

## Error Response

```json
{
  "ok": false,
  "error": {
    "code": "INVALID_PROXY_SIGNATURE",
    "message": "Unable to initialize chat for this storefront request."
  }
}
```

## Behavioral Guarantees

- A successful bootstrap response never exposes app secrets or long-lived credentials.
- The token expires quickly and can be reissued by calling bootstrap again.
- The response includes the direct chat endpoint so the widget can stream from the app origin after the proxied bootstrap succeeds.
- Invalid proxy signatures always fail closed.
- The route is idempotent for the same active shopper session.