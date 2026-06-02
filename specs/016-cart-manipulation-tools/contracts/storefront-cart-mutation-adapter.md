# Contract: Storefront Cart Mutation Adapter

## Purpose

Defines internal service boundary between chat tool orchestration and Shopify Storefront API cart mutations.

## Interface

TypeScript service contract:

```ts
interface CartMutationAdapter {
  addLine(input: {
    cartId: string;
    merchandiseId: string;
    quantity: number;
    idempotencyKey: string;
  }): Promise<CartMutationOutcome>;

  removeLine(input: {
    cartId: string;
    lineId: string;
    idempotencyKey: string;
  }): Promise<CartMutationOutcome>;

  updateLineQuantity(input: {
    cartId: string;
    lineId: string;
    quantity: number;
    idempotencyKey: string;
  }): Promise<CartMutationOutcome>;

  swapLineVariant(input: {
    cartId: string;
    lineId: string;
    newMerchandiseId: string;
    quantity: number;
    idempotencyKey: string;
  }): Promise<CartMutationOutcome>;
}
```

## `CartMutationOutcome`

```ts
type CartMutationOutcome = {
  ok: boolean;
  status: "executed" | "failed";
  code?:
    | "LINE_NOT_FOUND"
    | "VARIANT_UNAVAILABLE"
    | "QUANTITY_INVALID"
    | "CART_CONFLICT"
    | "MUTATION_ERROR";
  message: string;
  cart: {
    cartId: string;
    currencyCode: string;
    items: Array<{
      lineId: string;
      productId: string;
      variantId: string;
      quantity: number;
    }>;
    subtotal: string;
  };
};
```

## Mapping Rules

- `addLine` -> Storefront `cartLinesAdd`.
- `removeLine` -> Storefront `cartLinesRemove`.
- `updateLineQuantity` -> Storefront `cartLinesUpdate`.
- `swapLineVariant` -> `cartLinesRemove` then `cartLinesAdd` under one adapter transaction boundary (best-effort rollback message if second step fails).

## Validation and Safety Requirements

- All inputs validated before API call.
- GraphQL selection must be field-minimal (Constitution Principle III).
- Adapter must normalize Shopify `userErrors` into stable `code/message` values.
- Adapter must include idempotency key propagation in request context/logging.

## Failure Handling

- Return `ok=false` with normalized code for user-facing recovery.
- Never throw raw Shopify errors across boundary; wrap and classify.
- On partial swap failure, return `failed` with explicit guidance to refresh cart state.
