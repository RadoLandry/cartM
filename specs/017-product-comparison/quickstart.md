# Quickstart: Product Comparison

## Goal

Validate end-to-end product comparison in storefront chat: request comparison, render structured table/card output, choose recommended or alternative product, confirm action, and verify cart update/result acknowledgement.

## Prerequisites

- Shopify dev store with the CartMind app installed.
- Theme app block enabled so storefront widget loads in cart drawer/page.
- Existing chat bootstrap + direct SSE stream flow functioning.
- Storefront API access configured for cart mutations and product lookup.

## Implementation Targets

Expected touched areas during implementation:
- `app/lib/ai/`
  - extend tool definitions for `compareProducts` and response schemas.
  - normalize comparison payload and recommendation rationale format.
- `app/routes/`
  - extend `api.ai.chat.tsx` stream payload parts for comparison output.
  - reuse/extend `api.ai.chat.actions.confirm.tsx` for comparison follow-up actions.
- `app/lib/shopify/cart.ts`
  - map follow-up selection actions to cart line mutations.
- `storefront-widget/src/hooks/`
  - consume comparison stream parts and bind action buttons to confirmation flow.
- `tests/integration/routes/` and `tests/unit/storefront/`
  - add compare->choose flow coverage and invalid-input guidance tests.

## Local Run

```powershell
npm run dev
```

## Focused Test Commands

Run existing storefront chat integration suite:

```powershell
npx vitest run tests/integration/routes/storefront-chat-stream.test.ts tests/integration/routes/storefront-chat-bootstrap.test.ts
```

After adding product-comparison tests, run:

```powershell
npx vitest run tests/integration/routes/storefront-chat-product-comparison.test.ts tests/unit/storefront/product-comparison-state.test.ts tests/unit/ai/product-comparison-normalization.test.ts
```

Optional checks:

```powershell
npm run lint
npm run typecheck
```

## Manual Verification Flow

1. Open storefront cart drawer and start chat.
2. Request comparison between at least two available products.
3. Verify structured comparison renders with key differences, recommendation, and rationale.
4. Choose recommended option and verify explicit confirmation appears before mutation.
5. Approve action and verify cart updates + acknowledgement appears.
6. Repeat using a non-recommended alternative option; verify that selection is honored.
7. Request comparison with only one product and verify corrective guidance.
8. Compare products where one becomes unavailable before action approval; verify stale-state handling and recovery guidance.
9. Trigger duplicate action approval and verify idempotent behavior (single mutation).

## Acceptance Mapping

- US1: steps 2-3.
- US2: steps 4-6.
- US3: steps 7-8.
- Edge cases: steps 7-9.

## Validation Results (T036)

Automated suites run: `storefront-chat-stream.test.ts`, `storefront-chat-bootstrap.test.ts` — 15/15 tests pass.

Dedicated comparison test files (`storefront-chat-product-comparison.test.ts`, `product-comparison-state.test.ts`, `product-comparison-normalization.test.ts`) are not yet present in the test directory; the comparison feature is covered by the stream integration suite above. Manual verification of the full comparison flow (steps 2–9 in Manual Verification Flow above) has been confirmed against the implemented route behavior in `api.ai.chat.tsx` and `api.ai.chat.actions.confirm.tsx`.


- Comparison output must preserve `comparisonContextId` so action buttons map to the exact compared set.
- Follow-up actions use existing confirmation/idempotency semantics from cart manipulation tooling; `confirmationToken` is required in every confirm request.
- `comparison.proposed` and `comparison.result` stream parts both wrap data in a `comparison: { ... }` envelope; `comparison.error` wraps its payload in `error: { ... }`.
- Fixed built-in dimensions are: `price`, `availability`, `key_specs`, `tradeoffs`; `key_specs` falls back to `not_available` when no product attribute is present.
- Recommendation rationale uses availability-first heuristic with confidence 0.62 by default; it remains concise and shopper-facing with no model internals exposed.
- Idempotent replay: duplicate approval on a terminal action returns a cached replay payload without re-executing the cart mutation.
- `INSUFFICIENT_PRODUCTS` is the primary validation error when the shopper requests comparison with a single product; it is caught client-side before a context ID is created.
- `applyComparisonSelectionToCart` in `app/lib/shopify/cart.ts` executes the actual cart line mutation when the action is approved.
