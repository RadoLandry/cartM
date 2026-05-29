# Contract: Storefront Chat Bootstrap

## Purpose

Defines the authenticated bootstrap handshake used by the storefront widget before opening the direct chat stream.

## Endpoint

- Route: POST /api/app-proxy/chat-bootstrap
- Caller: storefront widget in cart drawer or cart page
- Authentication: Shopify App Proxy verification via server middleware
- Response: JSON bootstrap payload with scoped stream credentials

## Request Body

```json
{
  "shop": "merchant.myshopify.com",
  "cartId": "gid://shopify/Cart/123",
  "surface": "cart_drawer",
  "sessionId": "browser-session-123",
  "currencyCode": "USD"
}
```

Validation rules:
- shop is required and non-empty.
- surface is one of cart_drawer or cart_page.
- sessionId is required and non-empty.
- currencyCode defaults to USD when omitted.

## Success Response

```json
{
  "ok": true,
  "bootstrap": {
    "shop": "merchant.myshopify.com",
    "cartId": "gid://shopify/Cart/123",
    "sessionKey": "chat_browser-session-123",
    "streamToken": "signed.payload",
    "expiresAt": "2026-05-29T10:00:00.000Z",
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
    "fieldErrors": {
      "surface": ["Required"]
    }
  }
}
```

HTTP status:
- 400 for invalid body.
- 401/403 delegated from proxy auth verification middleware when request is not trusted.

## Behavioral Guarantees

- Stream token is short-lived and signed server-side.
- sessionKey and token are scoped to the requesting shop/session/cart context.
- chatUrl points to the direct stream endpoint used for turn submission.
- Widget clients should rebootstrap when cart identity changes between turns so token scope remains valid.
