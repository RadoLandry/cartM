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

## Implementation Validation Notes

- Comparison output must preserve `comparisonContextId` so action buttons map to the exact compared set.
- Follow-up actions should use existing confirmation/idempotency semantics from cart manipulation tooling.
- Recommendation rationale should remain concise and shopper-facing, with no model internals exposed.
