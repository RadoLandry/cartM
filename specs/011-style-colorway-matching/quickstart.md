# Quickstart: Style & Colorway Matching

## Goal

Validate the shopper-facing style-matching slice end to end using the existing visual-profile admin data and cart-intelligence libraries.

## Prerequisites

- Catalog sync and colorway backfill have populated `ProductVisualProfile` rows.
- Merchant overrides and compatibility rules are reviewable in the knowledge-graph colorways tab.
- Test fixtures exist for coordinated, mixed, and clashing carts.

## Implementation Flow

1. Confirm the effective visual data path.
   - Verify the knowledge-graph route exposes effective colorway keys, effective collections, and merchant compatibility rules.
   - Confirm cart-facing queries can hydrate `CartVisualItem` records from local persistence without live Admin API reads.

2. Tighten the scorer.
   - Extend `app/lib/cart-intelligence/style-coherence.ts` to honor variant-specific colorways, ambiguity suppression, and same-role swap constraints.
   - Ensure cohesive or low-confidence carts suppress shopper-facing suggestions.

3. Shape shopper payloads.
   - Extend `app/lib/cart-intelligence/recommendations.ts` so style output includes summary state, ranked opportunities, and shopper-readable reasoning.
   - Cap shopper-facing opportunities at three and remove unavailable or duplicate items.

4. Expose the payload to a shopper surface.
   - Wire style recommendations into the cart recommendation route or add the missing route if none exists.
   - Keep route validation explicit and deterministic.

5. Validate merchant control continuity.
   - Confirm changes in the knowledge-graph colorways tab affect later shopper-facing style recommendations.

## Suggested Validation Commands

```powershell
npm test -- tests/unit/cart-intelligence/style-coherence.test.ts
npm test -- tests/unit/cart-intelligence/style-recommendations.test.ts
npm test -- tests/integration/routes/style-recommendations.test.ts
```

## Manual Validation Scenarios

1. Build a cart with two items from the same collection and verify a matching add recommendation appears.
2. Build a cart with one visually clashing item and verify a same-role swap recommendation appears.
3. Build a cart that is already cohesive and verify no corrective shopper-facing suggestion is returned.
4. Add a merchant `AVOID` rule for a colorway pairing and verify that the shopper-facing result suppresses or reranks recommendations accordingly.
5. Use a cart with ambiguous or low-confidence visual evidence and verify the feature returns no forced suggestion.

## Exit Criteria

- Shopper payloads reflect merchant overrides and compatibility rules.
- Style recommendations are suppressed for cohesive or ambiguous carts.
- Add and swap suggestions remain in-stock, non-duplicate, and role-preserving.
- Unit and integration coverage exists for suppression, ranking, variant handling, and merchant override precedence.