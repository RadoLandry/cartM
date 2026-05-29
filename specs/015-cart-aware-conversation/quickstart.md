# Quickstart: Cart-Aware Conversation

## Goal

Validate the cart-aware conversation flow end to end: bootstrap, stream response, structured guidance rendering, and continuity after cart/session changes.

## Prerequisites

- App runs in a Shopify development store.
- Theme app extension for the cart block is enabled in the target theme.
- Environment variables for Shopify auth and chat signing secret are configured.

## Validation Flow

1. Build storefront widget assets:

```powershell
npm run build:storefront-widget
```

2. Start local app development:

```powershell
npm run dev
```

3. In the store theme editor, ensure the CartMind chat block is active on cart drawer/cart page.
4. Open cart drawer and submit a cart-aware question.
5. Confirm streamed response includes text and guidance blocks when applicable.
6. Modify cart items and ask a follow-up question.
7. Confirm the next response reflects the updated cart.
8. Collapse and reopen chat in the same session and confirm continuity.

## Focused Automated Checks

```powershell
npx vitest run tests/integration/routes/storefront-chat-bootstrap.test.ts tests/integration/routes/storefront-chat-stream.test.ts tests/unit/storefront/chat-session-state.test.ts tests/unit/storefront/chat-guidance-model.test.ts
```

## Optional Repo-Wide Checks

```powershell
npm run lint
npm run typecheck
```

## Latest Validation Snapshot (2026-05-29)

- Focused tests: PASS (18/18)
	- `tests/integration/routes/storefront-chat-bootstrap.test.ts`
	- `tests/integration/routes/storefront-chat-stream.test.ts`
	- `tests/unit/storefront/chat-session-state.test.ts`
	- `tests/unit/storefront/chat-guidance-model.test.ts`
- `npm run typecheck`: FAIL due to known unrelated pre-existing blockers outside this feature slice:
	- `app/lib/cart-intelligence/customer-profile.ts`
	- `app/lib/cart-intelligence/recommendations.ts`
	- `app/lib/cart-intelligence/size-conflicts.ts`
	- `app/lib/db/queries.ts`
	- `tests/unit/cart-intelligence/threshold.test.ts`
- `npm run lint`: FAIL due to broad existing repo lint baseline and generated/bundled artifacts not scoped to this feature work.

Note: repository memory highlighted `app/lib/cart-intelligence/size-conflicts.ts` as a known unrelated blocker, and current typecheck confirms additional unrelated baseline issues listed above.

## Manual Acceptance Checklist

- Cart-aware responses mention current cart items in normal flows.
- Empty cart requests return clear fallback guidance.
- Invalid/expired stream token returns recoverable error behavior.
- Cart updates during session produce updated guidance on the next turn.
- Shopper can always continue checkout while chat is open.
