# Data Model: Chat Cart Management

## Overview

This feature extends the existing storefront chat action lifecycle to support complete cart management by conversation: add item, delete item, replace variant, and increase/decrease quantity. The model prioritizes explicit approval, deterministic execution, and non-destructive failure behavior.

## Entities

### ChatCartActionProposal

Represents a shopper-approved candidate action generated from conversational intent.

**Fields**
- `actionId`: Stable action identifier.
- `toolName`: `addToCart | removeFromCart | changeQuantity | swapVariant`.
- `shop`: Shopify shop domain.
- `sessionKey`: Signed chat session key.
- `cartId`: Optional active cart identifier.
- `payload`: Action payload with one mutation intent.
- `confirmationToken`: Signed token bound to action/shop/session/cart scope.
- `expiresAt`: Proposal expiration timestamp.
- `preview`: Optional shopper-readable before/after summary.

**Validation rules**
- Exactly one action payload type per proposal.
- `confirmationToken` must match `actionId`, `shop`, and `sessionKey` at approval time.
- Proposal must not execute when expired.

### ChatCartActionPayload

Discriminated action payload submitted for execution.

**Variants**
- `add`: `merchandiseId`, `quantity`.
- `remove`: `lineId`.
- `change_quantity`: `lineId`, `quantity`.
- `swap_variant`: `lineId`, `newMerchandiseId`, optional `quantity`.

**Validation rules**
- Quantity values are integers >= 1.
- `lineId` is mandatory for remove/change/swap actions.
- `merchandiseId` and `newMerchandiseId` must be non-empty variant references.

### ChatCartActionLifecycleRecord

Tracks lifecycle and idempotency for action confirmation/execution.

**Fields**
- `actionId`: Stable identifier.
- `status`: `proposed | approved | declined | expired | executing | executed | failed`.
- `summary`: Optional status explanation.
- `payload`: Action payload snapshot.
- `createdAt`: Creation timestamp.
- `updatedAt`: Last transition timestamp.

**Validation rules**
- Allowed transitions only follow lifecycle transition map.
- Terminal states (`declined`, `expired`, `executed`, `failed`) are immutable.
- Duplicate approvals in terminal states return idempotent replay, not re-execution.

### StorefrontCartMutationCommand

Normalized command passed to the cart mutation adapter.

**Fields**
- `cartId`: Cart identifier.
- `idempotencyKey`: Action-bound unique key.
- `cart`: Current snapshot at execution time.
- `lineId`: Required for remove/change/swap.
- `merchandiseId` or `newMerchandiseId`: Required for add/swap.
- `quantity`: Required for add/change/swap.

**Validation rules**
- Commands must be rejected when required identifiers are missing.
- Execution uses latest provided cart snapshot for conflict checks.

### StorefrontCartMutationOutcome

Deterministic result of a cart mutation attempt.

**Fields**
- `ok`: Boolean success marker.
- `status`: `executed | failed`.
- `code`: Optional `LINE_NOT_FOUND | VARIANT_UNAVAILABLE | QUANTITY_INVALID | CART_CONFLICT | MUTATION_ERROR`.
- `message`: Shopper-safe summary.
- `cart`: Resulting cart snapshot.

**Validation rules**
- Failed outcomes must preserve cart consistency and provide explanatory code/message.
- Success outcomes must include resulting cart snapshot used for downstream UI sync.

## Relationships

- One `ChatCartActionProposal` creates one `ChatCartActionLifecycleRecord`.
- One `ChatCartActionLifecycleRecord` executes at most one `StorefrontCartMutationCommand`.
- One `StorefrontCartMutationCommand` returns one `StorefrontCartMutationOutcome`.
- One action outcome feeds chat status events and storefront cart sync refresh.

## State Transitions

### Action lifecycle

1. `proposed` -> `approved` after explicit shopper approval.
2. `proposed` -> `declined` when shopper refuses action.
3. `proposed` -> `expired` after token/session expiry.
4. `approved` -> `executing` when backend starts mutation.
5. `executing` -> `executed` on successful mutation.
6. `executing` -> `failed` on validation/conflict/mutation failure.

### Mutation safety transitions

1. Validate request/body/token/origin scope.
2. Resolve action record and ensure transition eligibility.
3. Execute exactly one mutation intent against current cart snapshot.
4. Emit terminal status and summary.
5. On repeated confirmation for terminal actions, return idempotent replay only.
