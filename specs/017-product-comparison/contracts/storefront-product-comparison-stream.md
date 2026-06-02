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
  "comparisonContextId": "cmp_01HX...",
  "requestId": "req_01HX...",
  "productRefs": ["gid://shopify/Product/1", "gid://shopify/Product/2"],
  "requestedAt": "2026-06-02T12:00:00.000Z"
}
```

Validation:
- At least two unique product refs.
- Session scope attached server-side.

### 2) `comparison.result`

Emitted with normalized side-by-side comparison data for rendering.

Payload:

```json
{
  "type": "comparison.result",
  "comparisonContextId": "cmp_01HX...",
  "generatedAt": "2026-06-02T12:00:01.200Z",
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
      "label": "Material",
      "values": {
        "gid://shopify/Product/1": "Leather",
        "gid://shopify/Product/2": "Synthetic"
      }
    }
  ],
  "recommendation": {
    "recommendedProductId": "gid://shopify/Product/1",
    "rationale": "Best value for your current cart use-case.",
    "confidence": 0.86
  },
  "freshness": {
    "priceCheckedAt": "2026-06-02T12:00:01.000Z",
    "availabilityCheckedAt": "2026-06-02T12:00:01.000Z"
  }
}
```

Validation:
- `recommendedProductId` must exist in `products` when present.
- `dimensions` must contain at least one populated row.

### 3) `comparison.error`

Emitted for recoverable comparison failures.

Payload:

```json
{
  "type": "comparison.error",
  "comparisonContextId": "cmp_01HX...",
  "code": "INSUFFICIENT_PRODUCTS",
  "message": "Please select at least two products to compare.",
  "retryable": true,
  "suggestedNextStep": "Add one more product and ask to compare again."
}
```

Validation:
- `code` in known comparison error enum.
- `message` must be shopper-safe text.

## Ordering Guarantees

- `comparison.proposed` MUST precede `comparison.result` or `comparison.error`.
- `comparison.result` and `comparison.error` are terminal for a context.
- Multiple contexts may interleave but each context preserves order.

## Compatibility Rules

- New optional fields may be added without version bump.
- Removing or renaming required fields is a breaking change and requires contract version increment.
