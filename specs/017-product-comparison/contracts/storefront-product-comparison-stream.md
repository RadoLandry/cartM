# Contract: Storefront Product Comparison Stream

## Purpose

Define stream payload parts for product comparison generation inside the existing `/api/ai/chat` SSE flow.

## Producer and Consumer

- Producer: `app/routes/api.ai.chat.tsx` via AI tool orchestration.
- Consumer: `storefront-widget/src/hooks/useStorefrontChat.ts` and comparison UI renderer.

## Event Types

### 1) `comparison.proposed`

Emitted when the assistant resolves a compare intent and starts comparison generation.

Payload:

```json
{
  "type": "comparison.proposed",
  "comparison": {
    "comparisonContextId": "cmp_01HX...",
    "request": {
      "requestId": "req_01HX...",
      "shop": "example.myshopify.com",
      "sessionKey": "sess_01HX...",
      "productRefs": ["gid://shopify/Product/1", "gid://shopify/Product/2"],
      "dimensions": [],
      "requestedAt": "2026-06-02T12:00:00.000Z"
    }
  }
}
```

Validation:
- `comparison.request.productRefs` must contain at least two unique product refs.
- Session scope is stored server-side under `comparisonContextId`.

### 2) `comparison.result`

Emitted with normalized side-by-side comparison data for rendering.

Payload:

```json
{
  "type": "comparison.result",
  "comparison": {
    "comparisonContextId": "cmp_01HX...",
    "requestId": "req_01HX...",
    "generatedAt": "2026-06-02T12:00:01.200Z",
    "freshness": {
      "priceCheckedAt": "2026-06-02T12:00:01.000Z",
      "availabilityCheckedAt": "2026-06-02T12:00:01.000Z"
    },
    "products": [
      {
        "productId": "gid://shopify/Product/1",
        "variantId": "gid://shopify/ProductVariant/11",
        "title": "Product A",
        "imageUrl": "https://cdn.example/a.jpg",
        "price": "79.99",
        "currencyCode": "USD",
        "availability": "available",
        "attributes": {
          "material": "Leather",
          "intendedUse": "Training"
        }
      }
    ],
    "dimensions": [
      {
        "key": "price",
        "label": "Price",
        "values": {
          "gid://shopify/Product/1": "79.99",
          "gid://shopify/Product/2": "59.99"
        }
      },
      {
        "key": "availability",
        "label": "Availability",
        "values": {
          "gid://shopify/Product/1": "available",
          "gid://shopify/Product/2": "unavailable"
        }
      },
      {
        "key": "key_specs",
        "label": "Key specs",
        "values": {
          "gid://shopify/Product/1": "Leather",
          "gid://shopify/Product/2": "not_available"
        }
      },
      {
        "key": "tradeoffs",
        "label": "Trade-offs",
        "values": {
          "gid://shopify/Product/1": "Ready to buy",
          "gid://shopify/Product/2": "Availability check recommended"
        }
      }
    ],
    "recommendation": {
      "recommendedProductId": "gid://shopify/Product/1",
      "rationale": "Recommended Product A based on current availability and cart context.",
      "confidence": 0.62
    }
  }
}
```

Validation:
- `comparison.products` must have at least two items.
- `comparison.dimensions` must contain at least one populated row with values keyed by `productId`.
- `comparison.recommendation.recommendedProductId` must exist in `comparison.products` when present.
- `comparison.recommendation.confidence` is in range `[0, 1]`.

### 3) `comparison.error`

Emitted for recoverable comparison failures.

Payload:

```json
{
  "type": "comparison.error",
  "error": {
    "comparisonContextId": "cmp_01HX...",
    "code": "INSUFFICIENT_PRODUCTS",
    "message": "Please select at least two products to compare.",
    "retryable": true,
    "suggestedNextStep": "Add one more product and ask to compare again."
  }
}
```

Error `code` enum (from `ProductComparisonErrorSchema`):
- `INSUFFICIENT_PRODUCTS` — fewer than two distinct products provided
- `DUPLICATE_PRODUCTS` — same product ref submitted twice
- `UNRESOLVED_PRODUCT_REF` — one or more refs could not be resolved
- `UNAVAILABLE_VARIANT` — a requested variant is not purchasable
- `PARTIAL_DATA` — minimum comparison viability not met
- `UPSTREAM_RATE_LIMIT` — Storefront API throttling
- `UNKNOWN` — unexpected failure

Validation:
- `error.code` must be one of the enum values above.
- `error.message` must be shopper-safe text with no internal model details.

## Ordering Guarantees

- `comparison.proposed` MUST precede `comparison.result` or `comparison.error`.
- `comparison.result` and `comparison.error` are terminal for a context.
- Multiple contexts may interleave but each context preserves order.

## Compatibility Rules

- New optional fields may be added without version bump.
- Removing or renaming required fields is a breaking change and requires contract version increment.
