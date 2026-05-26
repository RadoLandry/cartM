# Contract: Recommendation Personalization Request

## Purpose

Defines the shopper-facing request shape for passing identity and explicit profile input into the cart recommendation route.

## Request Shape

```ts
interface RecommendationRequest {
  shop: string;
  cartId?: string;
  currencyCode?: string;
  shopifyCustomerId?: string;
  sessionId?: string;
  profileInput?: {
    discipline?: string;
    experienceLevel?: string;
    weightClass?: string;
    knownSizes?: Record<string, string>;
    priceSensitivity?: "budget" | "mid" | "premium";
  };
  cart: Array<{
    productId: string;
    variantId?: string;
    quantity: number;
  }>;
}
```

## Validation Rules

- `shop` is required.
- `cart` must be present even if empty.
- `shopifyCustomerId` and `sessionId` are optional individually, but at least one should be present for persisted personalization.
- `profileInput` is optional and may contain only the fields the shopper has chosen to provide.
- Unknown profile-input fields must be rejected at the route boundary.

## Response Expectations

- The recommendation route may return shopper-facing recommendation payloads plus an internal or debug-visible personalization summary during development/test validation.
- The route must not expose raw purchase-history payloads or admin-only customer data.
- If no reliable profile exists, the response should reflect generic or low-confidence personalization rather than fail.

## Notes

- This contract is intentionally route-facing and narrower than the full persisted profile schema.
- Storefront callers are responsible for passing a stable anonymous `sessionId` when personalization within a visit is desired.