# Contract: Budget Optimization Data Source

## Purpose

Define normalized inputs required to generate budget optimization proposals from current cart state and candidate alternatives.

## Data Sources

- Storefront cart snapshot (current shopper cart lines, selected variants, subtotal context).
- Existing cart-intelligence and threshold candidate helpers for relevance and ranking.
- Storefront product availability/price checks for candidate alternatives.

## Required Input

```json
{
  "shop": "example-shop.myshopify.com",
  "sessionKey": "sess_01HX...",
  "cart": {
    "cartId": "gid://shopify/Cart/123",
    "currencyCode": "USD",
    "items": [
      {
        "lineId": "line_1",
        "productId": "gid://shopify/Product/1",
        "variantId": "gid://shopify/ProductVariant/11",
        "quantity": 1
      }
    ],
    "subtotal": "249.90"
  },
  "targetBudgetAmount": 180.0
}
```

## Normalized Output Shape

```json
{
  "cartSubtotal": 249.9,
  "targetBudgetAmount": 180.0,
  "currencyCode": "USD",
  "candidates": [
    {
      "candidateId": "cand_1",
      "changeType": "swap",
      "sourceLineId": "line_1",
      "sourceProductId": "gid://shopify/Product/1",
      "targetProductId": "gid://shopify/Product/9",
      "estimatedSavings": 35.0,
      "disciplineFitScore": 0.92,
      "safetyCriticalImpact": "none",
      "availability": "available"
    }
  ],
  "fetchedAt": "2026-06-02T14:00:01.000Z"
}
```

## Field-Minimal Query Policy

Include only fields required for proposal ranking and confirmation:
- cart line identity + product/variant refs + quantity
- current and candidate price/currency
- availability state
- discipline/safety relevance attributes needed for constraint checks

Disallowed:
- full product descriptions not used by optimization logic
- unrelated variant lists and media collections
- non-essential metafield payloads

## Failure Modes

- `INVALID_TARGET_BUDGET`: budget missing or non-positive.
- `EMPTY_CART`: optimization requested on empty cart.
- `NO_ELIGIBLE_CANDIDATES`: no valid changes found under safety constraints.
- `CONSTRAINT_BLOCKED`: target reachable only by violating safety constraints.
- `UPSTREAM_RATE_LIMIT`: storefront API throttling.

## Recovery Expectations

- For invalid budget: prompt shopper for a valid target amount.
- For empty cart: request at least one cart item.
- For no eligible candidates: return transparent reason and optional next steps.
- For constraint blocked: ask shopper to raise budget or explicitly allow reduced completeness.
