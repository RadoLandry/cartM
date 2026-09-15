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
      "sourceVariantId": "gid://shopify/ProductVariant/11",
      "targetProductId": "gid://shopify/Product/9",
      "estimatedSavings": 35.0,
      "disciplineFitScore": 0.92,
      "safetyCriticalImpact": "none",
      "rationale": "Remove non-essential item to unlock the largest budget reduction first.",
      "availability": "available"
    }
  ],
  "fetchedAt": "2026-06-02T14:00:01.000Z"
}
```

Implementation note: `fetchBudgetOptimizationCandidates` (`app/lib/shopify/cart.ts`) currently derives `estimatedSavings`, `disciplineFitScore`, and `safetyCriticalImpact` heuristically from cart line title/variant keywords (safety-gear vs. non-essential-accessory keyword lists), not from live Shopify price/inventory lookups. `rationale` is always populated by the heuristic, matching the candidate consumed downstream by ranking and the guidance card.

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

- `INVALID_TARGET_BUDGET`: budget missing or non-positive (validated before candidate fetch, in `getBudgetOptimizationValidationError`).
- `EMPTY_CART`: optimization requested on empty cart (validated before candidate fetch).
- `NO_ELIGIBLE_CANDIDATES`: no candidates were fetched for a non-empty cart, or the ranked/filtered candidate set produced by `buildBudgetOptimizationProposal` came back `insufficient_candidates` (e.g. all remaining candidates were safety-critical `critical_removal` and were excluded).
- `UPSTREAM_RATE_LIMIT`: reserved for storefront API throttling; not yet triggered by any implemented code path.

Note: `constraint_blocked` is NOT a data-source failure. It is a `status` value on a successfully generated `BudgetOptimizationResult` meaning some candidates were applied but the target could not be fully reached without unsafe removals; the proposal is still returned to the shopper.

## Recovery Expectations

- For invalid budget: prompt shopper for a valid target amount.
- For empty cart: request at least one cart item.
- For no eligible candidates: return transparent reason and optional next steps.
- For a `constraint_blocked` result: the storefront card surfaces a blocked-state message and lets the shopper raise the budget or accept the partial savings shown.
