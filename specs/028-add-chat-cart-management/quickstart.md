# Quickstart: Chat Cart Management

## Goal

Validate end-to-end conversational cart management in storefront chat for add/remove/update/swap/quantity operations with explicit approval, safe failure handling, and idempotent execution.

## Prerequisites

- Development store configured and app installed.
- Theme extension for cart drawer block enabled.
- Storefront widget build pipeline available.
- Environment variables and app proxy auth configured.

## Build and baseline checks

```powershell
npm run build:storefront-widget
```

```powershell
npm run typecheck
```

```powershell
npm run lint
```

## Focused automated checks

```powershell
npx vitest run tests/unit/ai/cart-tool-proposal.test.ts tests/unit/shopify/storefront-cart-mutation-adapter.test.ts
```

```powershell
npx vitest run tests/integration/routes/storefront-chat-action-confirm.test.ts
```

```powershell
npx vitest run tests/unit/storefront/useStorefrontChat-action-confirmation.test.ts
```

## Manual scenario flow

1. Open storefront cart drawer with at least one line item.
2. Ask chat to add an item by conversational request and approve the proposed action.
3. Confirm added line appears in cart and action history marks executed.
4. Ask chat to remove a specific existing line and approve.
5. Confirm target line is removed and cart remains otherwise intact.
6. Ask chat to replace variant for an existing line and approve.
7. Confirm old variant is replaced with requested variant and quantity preserved unless explicitly changed.
8. Ask chat to increase quantity for a line and approve.
9. Ask chat to decrease quantity for the same line and approve.
10. Confirm quantity changes are reflected in cart totals and summary.

## Edge and failure validation

1. Request remove/swap/change on a non-existing line and confirm safe failure response.
2. Request swap to unavailable variant and confirm no destructive cart mutation is applied.
3. Request quantity below minimum and confirm validation rejection.
4. Send duplicate approval for a completed action and confirm idempotent replay response.
5. Expire or invalidate confirmation token and confirm request is rejected with recovery guidance.

## Non-regression checks

- Cart drawer open/close behavior remains unchanged.
- Existing cart controls (subtotal, checkout CTA, quantity controls) remain usable.
- Chat failure states do not block normal cart interactions.
- Action history remains visible and understandable for shopper follow-up.

## Completion criteria

- All four core mutation intents are executable through chat with explicit confirmation.
- Failed mutation scenarios return safe, clear, non-destructive outcomes.
- Duplicate confirmations do not re-apply cart mutations.
- Focused unit/integration tests pass for proposal, execution, and edge conditions.

## Validation run notes

Execution timestamp: 2026-06-12

Commands executed:

```powershell
npm run build:storefront-widget
npm run typecheck
npm run lint
```

Outcome summary:

- `npm run build:storefront-widget`: PASS
- `npm run typecheck`: FAIL due to pre-existing unrelated errors outside this feature scope (not introduced by chat cart management changes), including:
	- `extensions/checkout-ui/src/Checkout.test.tsx` argument mismatch errors around `extension()` invocation
	- `extensions/checkout-ui/src/Checkout.tsx` implicit `any` typing issues
	- legacy typing failures in `app/lib/db/queries.ts`
- `npm run lint`: FAIL due to large pre-existing theme asset lint debt in `Shopify-Fr/assets/*` and related global symbol usage (`$`, `jQuery`, etc.) unrelated to this feature scope.

Feature-specific validation status:

- Focused chat cart suites pass:
	- `tests/unit/ai/cart-tool-proposal.test.ts`
	- `tests/unit/shopify/storefront-cart-mutation-adapter.test.ts`
	- `tests/integration/routes/storefront-chat-action-confirm.test.ts`
	- `tests/integration/routes/storefront-chat-stream.test.ts`
	- `tests/unit/storefront/useStorefrontChat-action-confirmation.test.ts`
