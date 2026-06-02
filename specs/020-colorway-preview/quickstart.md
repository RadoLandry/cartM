# Quickstart: Colorway Preview

## Goal
Validate end-to-end colorway preview behavior for side-by-side comparison, invalid request handling, partial output resilience, and reuse performance.

## Request/Response Fields to Verify
- Request: `selectedLineId`, `proposedVariantId`, `availableVariantIds`, `surface`, `forceRegenerate`
- Response: `status`, `comparison.reused`, `omissions[]`, `diagnostics.reused`, `diagnostics.generationMs`, `diagnostics.telemetry`

## Prerequisites
- App and storefront widget are running locally.
- Test cart has at least one item with alternate color variants.
- At least one fixture includes missing/invalid media for partial coverage.

## Scenario 1: Generate first comparison preview
1. Add 3-5 render-eligible items to cart.
2. Select one line and request a different color variant preview.
3. Observe returned comparison payload in UI.

Expected result:
- Current and proposed kit visuals are both available.
- Changed item is clearly identified.

## Scenario 2: Validate no-op swap rejection
1. Request preview using the same variant already selected.
2. Capture response state.

Expected result:
- Request is rejected as invalid with actionable guidance.
- Cart remains unchanged.

## Scenario 3: Validate unavailable target variant handling
1. Request preview with a variant not available for the selected line.
2. Inspect response.

Expected result:
- Response status is invalid.
- Reason is clear and shopper-safe.

## Scenario 4: Verify partial comparison behavior
1. Include an item with broken/missing image URL.
2. Request a valid swap preview.

Expected result:
- Comparison still returns with partial status.
- Omission metadata includes line and reason.

## Scenario 5: Verify deterministic reuse
1. Repeat exact same valid preview request.
2. Compare metadata and response times.

Expected result:
- Reused path is indicated in both `comparison.reused` and `diagnostics.reused`.
- Response is faster than first-generation path.

## Scenario 6: Confirm regeneration on meaningful change
1. Change selected line, proposed variant, or cart contents.
2. Request preview again.

Expected result:
- Reuse is bypassed for new signature.
- New comparison output reflects updated state.

## Scenario 7: Confirm force regeneration bypass
1. Submit an identical request twice.
2. On the second request, set `forceRegenerate` to `true`.

Expected result:
- Reuse is bypassed even when signature would otherwise match.
- `comparison.reused` and `diagnostics.reused` are `false`.

## Verification Checklist
- Preview flow remains read-only and does not mutate cart.
- Invalid requests are explicit and actionable.
- Partial states include structured omissions.
- Reuse behavior is deterministic and measurable.

## Validation Log
- 2026-06-02: Planning artifacts generated for Phase 0/1.
- 2026-06-02: Type safety verification completed with `npm run -s typecheck` (pass).
- 2026-06-02: Route telemetry verified to include only sanitized outcome fields (status/reused/omission count/generation time/surface/force regenerate), with no raw cart payloads.
