# Quickstart: Customer Profile & History

## Goal

Validate that CartMind can resolve lightweight shopper profiles for anonymous and returning users, persist those profiles correctly, and feed them into recommendation flows without adding latency-heavy upstream calls to the shopper path.

## Prerequisites

- The existing app auth flow and Prisma-backed session storage are working.
- The repo's `CustomerProfile` model is migrated to include the planned summary fields.
- Recommendation route tests can pass shopper identity and explicit profile inputs.
- Any purchase-history summary seeding path is available outside the shopper request path.

## Implementation Flow

1. Expand customer-profile persistence.
   - Add the required summary fields to `CustomerProfile` in Prisma.
   - Extend DB query helpers to read, upsert, and merge customer and session profile records.

2. Build the profile resolver.
   - Add `app/lib/cart-intelligence/customer-profile.ts` for signal normalization, precedence rules, confidence scoring, and anonymous-to-identified merge support.
   - Keep explicit inputs authoritative for the fields they set.

3. Wire personalization into cart recommendations.
   - Extend `api.ai.recommendations.tsx` to validate `shopifyCustomerId`, `sessionId`, and explicit profile inputs.
   - Pass the resolved profile context into recommendation builders and sizing helpers.

4. Add background-friendly purchase-summary refresh.
   - If needed, add field-minimal Shopify GraphQL helpers and non-shopper-path refresh triggers.
   - Persist only summary data needed for repeat-shopper personalization.

5. Validate confidence and noise reduction behavior.
   - Verify low-confidence scenarios degrade to generic guidance.
   - Verify stable repeat-customer profiles suppress redundant beginner messaging.

## Suggested Validation Commands

```powershell
npx vitest run tests/unit/cart-intelligence/customer-profile.test.ts
npx vitest run tests/unit/cart-intelligence/personalized-recommendations.test.ts
npx vitest run tests/integration/routes/customer-profile-recommendations.test.ts
```

## Manual Validation Scenarios

1. Create a returning identified shopper profile with stable discipline and size signals, then verify later recommendation requests use that context without restating it.
2. Run an anonymous session that accumulates a clear discipline preference, then verify recommendations within that same session become more targeted.
3. Submit explicit profile inputs that conflict with older inferred data, then verify the explicit values control the next recommendation cycle.
4. Merge an anonymous session into an identified shopper and verify the resulting profile carries forward relevant session insights without duplicating records.
5. Use a sparse or conflicting profile and verify recommendation behavior softens to generic or low-confidence guidance.

## Exit Criteria

- Recognized shoppers resolve to persistent profile summaries across sessions.
- Anonymous shoppers receive session-scoped personalization only.
- Explicit inputs override conflicting inferred signals for the affected attributes.
- Recommendation payloads can distinguish profile confidence and personalization mode.
- Unit and integration coverage exists for resolution, merge behavior, and low-confidence fallbacks.