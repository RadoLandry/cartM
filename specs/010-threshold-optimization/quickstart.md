# Quickstart: Threshold Optimization

## Goal

Implement and validate deterministic threshold suggestions that surface only credible, contextually relevant add-on products for near-threshold carts.

## Implementation Steps

1. Extend `prisma/schema.prisma` with threshold rule model(s) and enums, then generate the migration.
2. Add threshold-rule CRUD and preview helpers in `app/lib/db/queries.ts`, following the bundle manager persistence pattern.
3. Create `app/lib/knowledge-graph/thresholds.ts` for shared rule contracts, seed templates, and scoring helper types.
4. Create `app/lib/cart-intelligence/threshold.ts` to:
   - select the nearest relevant active threshold
   - calculate the remaining gap
   - collect candidate products from existing catalog data
   - rank candidates by relevance, gap fit, availability, and duplicate policy
   - suppress output when no candidate clears the relevance floor
5. Extend `app/lib/cart-intelligence/recommendations.ts` with `buildThresholdRecommendations(...)` so shopper surfaces receive a normalized payload.
6. Replace the placeholder additional page with `app/routes/app.thresholds.tsx` and update `app/routes/app.tsx` navigation.
7. Add unit tests for gap calculation, selection, suppression, and ranking plus integration tests for threshold manager loader/action flows.

## Validation Flow

1. Run the focused unit tests for threshold evaluation and recommendation shaping.
2. Run the threshold manager integration tests covering save, archive, and preview actions.
3. Validate that eligible carts return one to three contextual suggestions and that already-qualified or low-relevance carts return hidden payloads.
4. Confirm the admin route uses Polaris components and Zod-validated actions only.

## Out of Scope for This Slice

- Auto-importing threshold definitions from Shopify shipping or discount settings.
- Automatic cart mutation from threshold prompts.
- Checkout-extension rendering or Shopify Function changes tied to threshold logic.