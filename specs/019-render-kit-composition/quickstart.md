# Quickstart: Kit Composition Renderer

## Goal
Validate end-to-end behavior for composed kit previews, including discipline layout selection, cache reuse, and degraded handling for invalid cart items.

## Prerequisites
- App is running locally with storefront widget flow available.
- Dev store cart can be populated with at least 3 render-eligible items.
- At least one cart fixture includes a missing or invalid image URL.

## Scenario 1: Generate first composed preview
1. Populate cart with 3-5 eligible items from one discipline.
2. Open cart preview surface and request kit preview.
3. Confirm response returns a composed asset URL and metadata.
4. Verify output reflects current cart contents and discipline layout.

Expected result:
- Preview renders successfully on first request.
- No fallback banner is shown.

## Scenario 2: Verify cache reuse for unchanged cart
1. Without modifying cart, request preview again.
2. Capture response metadata for generation/reuse indication.

Expected result:
- Existing asset is returned from reuse path.
- Response time is materially faster than first generation path.

## Scenario 3: Invalidate cache on cart change
1. Change quantity or swap one variant in the cart.
2. Request preview again.

Expected result:
- New composed asset is produced for the updated snapshot.
- Output visibly reflects the changed item set.

## Scenario 4: Mixed discipline fallback layout
1. Build a cart that includes products from multiple disciplines.
2. Request preview.

Expected result:
- Fallback mixed-discipline layout is used.
- Response indicates mixed context handling.

## Scenario 5: Partial composition with omissions
1. Include one item with missing or invalid image URL.
2. Request preview.

Expected result:
- Preview still returns using valid eligible items.
- Omission metadata includes excluded item and reason code.

## Scenario 6: Empty cart handling
1. Request preview with empty cart.

Expected result:
- System returns deterministic fallback response (no server error).
- Shopper-facing messaging clearly explains that preview is unavailable for empty cart.

## Verification Checklist
- Deterministic output for repeated unchanged requests.
- Regeneration occurs on snapshot change.
- Omission reasons are structured and user-displayable.
- Mobile and desktop surfaces render preview asset correctly.

## Validation Log
- 2026-06-02: Phase 1-5 baseline validated with Vitest route and visual unit tests.
- Passing targets: `tests/integration/routes/kit-preview-route.test.ts`, `tests/unit/visual/compositor.test.ts`, `tests/unit/visual/templates.test.ts`.
