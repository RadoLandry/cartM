# Quickstart: Shopify Storefront Integration

## Goal

Validate that CartMind appears reliably on Shopify cart surfaces, stays synchronized with cart changes, shows checkout guidance only when useful, applies/presents bundle outcomes correctly, and preserves the merchant's original cart and checkout behavior.

## Prerequisites

- Shopify app development environment is configured and the app installs on a dev store.
- A development theme is available with a cart drawer and a standard cart page.
- Theme App Extension preview/deploy tooling is available.
- Existing cart-intelligence fixtures cover recommendations, kit completeness, size conflicts, and bundle rules.
- Environment variables for app URL and Shopify auth are configured outside source control.

## Build and Static Validation

```powershell
npm run build:storefront-widget
```

```powershell
shopify app config validate --json
```

```powershell
npm run typecheck
```

```powershell
npm run lint
```

Note: repository memory has previously recorded Windows and pre-existing typecheck caveats. If an unrelated existing failure appears, document it separately and continue with focused checks for this feature.

## Focused Automated Checks

```powershell
npx vitest run tests/unit/storefront/cart-surface-lifecycle.test.ts tests/unit/storefront/cart-state-sync.test.ts tests/unit/storefront/integration-health-events.test.ts
```

```powershell
npx vitest run tests/integration/routes/storefront-integration-bootstrap.test.ts tests/integration/routes/checkout-guidance-contract.test.ts
```

```powershell
npx vitest run tests/unit/cart-intelligence/bundle-storefront-outcomes.test.ts tests/unit/cart-intelligence/bundle-detection.test.ts tests/unit/cart-intelligence/bundle-activation-guards.test.ts
```

## Manual Storefront Compatibility Flow

1. Start the app with the normal Shopify development workflow.
2. Enable the CartMind app embed or cart-page fallback placement in the development theme.
3. Open the cart drawer with an empty cart and confirm the drawer opens/closes exactly as before.
4. Add a product from a product page where the theme shows only a cart notification.
5. Open the cart drawer and confirm CartMind guidance reflects the added product.
6. Change quantity inside the drawer and confirm CartMind refreshes without duplicate instances.
7. Remove an item inside the drawer and confirm subtotal, checkout CTA, and quantity controls remain usable.
8. Confirm third-party drawer sections remain visible and are not wrapped or restyled by CartMind.
9. Open the standard cart page and confirm the fallback placement renders without changing page layout.
10. Simulate CartMind asset or guidance failure and confirm the original cart flow remains usable.

## Checkout Guidance Flow

1. Build a cart with a high-confidence size conflict.
2. Proceed to checkout and confirm a concise warning appears.
3. Build a cart with a bundle completion opportunity and confirm a concise offer appears.
4. Build a no-guidance cart and confirm CartMind renders nothing at checkout.
5. Build a cart with both a size warning and a bundle opportunity and confirm warning priority comes first.
6. Repeat on the available checkout placement for the current store plan.

## Bundle Outcome Flow

1. Create or load active bundle rules covering full, partial, overlapping, and expired scenarios.
2. Add a full qualifying bundle to the cart and confirm discount and presentation match the active rule.
3. Add a partial bundle and confirm no unearned discount applies.
4. Add overlapping bundle items and confirm the selected outcome follows deterministic priority rules.
5. Confirm malformed or unsupported projections apply no discount and do not block checkout.

## Performance and Non-Regression Checks

- Confirm initial storefront widget payload remains under 50 KB gzipped.
- Confirm total lazy widget footprint remains under 100 KB gzipped.
- Confirm shopper-facing widget p95 cart load time remains at or below 300 ms.
- Confirm CartMind appears or is intentionally deferred within 1 second on supported cart openings.
- Confirm cart changes while the drawer is open refresh guidance within 2 seconds.
- Confirm product-page add-to-cart flows refresh next-open guidance within 5 seconds.
- Confirm no layout shift or breakpoint change is introduced by CartMind on mobile or desktop.

## Completion Criteria

- Cart drawer, cart page, checkout, and bundle outcome scenarios all pass.
- No duplicate widget instances appear after repeated drawer open/close/update cycles.
- Existing cart controls, third-party sections, scroll behavior, and checkout completion remain intact.
- Integration health events are emitted for render, sync, guidance, fallback, and bundle outcome paths.
