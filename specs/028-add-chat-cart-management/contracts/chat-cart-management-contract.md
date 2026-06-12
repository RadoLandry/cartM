# Contract: Chat Cart Management

## Scope

Defines request/response and lifecycle contracts for conversational cart mutations in storefront chat, including add, remove, replace variant, and quantity changes.

## Proposal contract

Entity: `CartToolAction`

- `actionId`: string required.
- `toolName`: `addToCart | removeFromCart | changeQuantity | swapVariant`.
- `shop`: string required.
- `sessionKey`: string required.
- `cartId`: string optional.
- `payload`: one `CartToolActionPayload` variant (below).
- `confirmationToken`: string required.
- `expiresAt`: datetime required.
- `preview`: optional shopper-facing before/after summary.

### Payload variants

- `add`
  - `actionType`: `add`
  - `merchandiseId`: string required
  - `quantity`: integer >= 1
- `remove`
  - `actionType`: `remove`
  - `lineId`: string required
- `change_quantity`
  - `actionType`: `change_quantity`
  - `lineId`: string required
  - `quantity`: integer >= 1
- `swap_variant`
  - `actionType`: `swap_variant`
  - `lineId`: string required
  - `newMerchandiseId`: string required
  - `quantity`: integer >= 1 optional (defaults to current line quantity)

## Confirmation endpoint contract

Endpoint role: confirm/decline a proposed cart action and, on approval, execute exactly one mutation.

Route: `POST /api/ai/chat/actions/confirm`

Request body:
- `shop`: string required.
- `sessionKey`: string required.
- `actionId`: string required.
- `confirmationToken`: string required.
- `decision`: `approve | decline` required.
- `actionType`: defaults to `cart_tool` for cart mutation path.
- `cart`: optional current cart snapshot (`cartId`, `currencyCode`, `items`, `subtotal`).

Response body (success):
- `ok`: true.
- `result`:
  - `actionId`: string.
  - `status`: terminal or intermediate action status.
  - `summary`: shopper-readable result.
  - `cart`: optional updated cart snapshot.
  - `idempotentReplay`: optional boolean when duplicate terminal action confirmation occurs.

Response body (error):
- `ok`: false.
- `error.code`: one of:
  - `INVALID_TOKEN_SCOPE`
  - `ACTION_NOT_FOUND`
  - `INVALID_ACTION_STATE`
  - `LINE_NOT_FOUND`
  - `VARIANT_UNAVAILABLE`
  - `QUANTITY_INVALID`
  - `CART_CONFLICT`
  - `MUTATION_ERROR`
- `error.message`: shopper-safe explanation.
- `error.recoveryOptions`: optional array of next-step guidance.

## Execution semantics

- Action execution requires valid token scope (`actionId`, `shop`, `sessionKey`) and allowed storefront origin.
- Decline decisions must never mutate cart state.
- Approve decisions execute exactly one mutation intent.
- Terminal action statuses are idempotent; duplicate confirmations return replay summary only.
- Failed operations must not partially apply additional unintended cart mutations.

## Mutation adapter contract

Adapter operations:
- `addLine(cartId, merchandiseId, quantity, idempotencyKey, cart)`
- `removeLine(cartId, lineId, idempotencyKey, cart)`
- `updateLineQuantity(cartId, lineId, quantity, idempotencyKey, cart)`
- `swapLineVariant(cartId, lineId, newMerchandiseId, quantity, idempotencyKey, cart)`

Outcome:
- `ok`: boolean
- `status`: `executed | failed`
- `code`: optional standardized error code
- `message`: shopper-safe summary
- `cart`: resulting cart snapshot

## Compatibility and safety requirements

- Existing cart drawer/page controls remain functional regardless of chat mutation failures.
- Invalid/ambiguous requests produce clarification or explicit failure responses before mutation.
- Quantity decrease below allowed minimum is rejected.
- Variant replacement for unavailable variant is rejected with no destructive side effects.
- Action history remains visible in chat session for shopper transparency.
