# Contract: Product Comparison Data Source

## Purpose

Define normalized product data fields required from Storefront GraphQL to build comparison output.

## Data Source

- Provider: Shopify Storefront GraphQL API
- Access path: existing storefront API helper layer
- Scope: only products explicitly requested for comparison

## Required Input

```json
{
  "shop": "example-shop.myshopify.com",
  "productRefs": [
    "gid://shopify/Product/1",
    "gid://shopify/Product/2"
  ],
  "preferredVariantIds": [
    "gid://shopify/ProductVariant/11",
    "gid://shopify/ProductVariant/22"
  ]
}
```

## Normalized Output Shape

```json
{
  "items": [
    {
      "productId": "gid://shopify/Product/1",
      "variantId": "gid://shopify/ProductVariant/11",
      "title": "Product A",
      "imageUrl": "https://cdn.example/a.jpg",
      "price": "79.99",
      "currencyCode": "USD",
      "availableForSale": true,
      "attributes": {
        "material": "Leather",
        "intendedUse": "Training",
        "weight": "16oz"
      }
    }
  ],
  "fetchedAt": "2026-06-02T12:00:01.000Z"
}
```

## Field-Minimal Query Policy

The fetch contract should include only fields needed for comparison:
- product id/title
- primary image URL
- selected variant id/price/currency/availability
- comparison attributes used by UI rows

Disallowed:
- full description HTML when not rendered
- unused variant collections
- unrelated metafields

## Failure Modes

- `UNRESOLVED_PRODUCT_REF`: one or more refs do not exist.
- `UNAVAILABLE_VARIANT`: requested variant not purchasable.
- `PARTIAL_DATA`: one product fetched with missing required comparison attributes.
- `UPSTREAM_RATE_LIMIT`: Storefront API throttling.

## Recovery Expectations

- For unresolved refs: return alternatives guidance to comparison flow.
- For unavailable variant: downgrade to closest available variant when policy allows, otherwise return actionable error.
- For partial data: omit non-critical dimensions and continue when minimum comparison viability is preserved.
