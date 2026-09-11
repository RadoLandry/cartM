# Quickstart: Bundle Rule Manager

## Goal
Implement and validate Bundle Rule Manager planning outcomes from `specs/022-bundle-rule-manager/plan.md`.

## Prerequisites

- Install dependencies:
  - `npm install`
- Ensure Prisma and environment are configured for local development.
- Ensure a development shop session is available for admin route testing.

## Implementation sequence

1. Add/extend persistence model
- Update Prisma schema with bundle rule entities and lifecycle enums.
- Add migrations and query helpers for CRUD, duplication, and status transitions.

2. Implement deterministic evaluator
- Extend `app/lib/cart-intelligence/bundles.ts` with shared evaluation logic.
- Add overlap resolution policy and explainable decision traces.

3. Implement admin route behavior
- Extend `app/routes/app.bundles.tsx` for create/edit/preview/archive flows.
- Validate all action payloads at route boundaries.

4. Add projection contract generation
- Add compact active-rule projection helper for downstream consumers.
- Keep projected output field-minimal and deterministic.

5. Add tests
- Unit tests: evaluator qualification, overlap tie-breaks, lifecycle guards.
- Integration tests: route actions for create, activate, pause, archive, duplicate, preview.

## Validation commands

- Typecheck:
  - `npm run typecheck`
- Unit/integration tests (focused):
  - `npx vitest run tests/unit/cart-intelligence`
  - `npx vitest run tests/integration/routes`

## Expected outcomes

- Merchant can create, preview, and activate valid rules.
- Invalid rules fail activation with actionable errors.
- Overlapping matches resolve consistently using a deterministic policy.
- Lifecycle actions preserve auditability and do not mutate unrelated rules.

## Sprint 7 verification notes (US2/US3 closure)

- Preview: `preview-bundle-rule` intent in `app/routes/app.bundles.tsx` normalizes cart fixtures via
  `listBundlePreviewCartItems` and runs the shared `detectBundles` evaluator; `BundleRulePreviewPanel`
  renders qualification status, missing requirements, decision-trace reasons, and competing-offer keys.
- Lifecycle: `pause-bundle-rule`, `resume-bundle-rule`, `archive-bundle-rule`, and `duplicate-bundle-rule`
  intents are guarded by `validateBundleRuleLifecycleTransition` in `app/lib/cart-intelligence/bundles.ts`
  and each records a `BundleRuleAuditRecord` via `logBundleRuleAuditEvent`.
- Duplication resets the copy to `DRAFT` status with a derived unique key (`duplicateBundleRule` in
  `app/lib/db/queries.ts`) and copies all components.
- Filtering: the admin loader accepts `includeArchived` and `q` query params
  (`listBundleRulesForShop(shop, { includeArchived, search })`) so archived rules are hidden by default.
- Projection: `buildActiveBundleRuleProjectionFeed` in `app/lib/cart-intelligence/recommendations.ts`
  wraps `toBundleProjection`/`listActiveBundleRuleProjections` output with `projectionVersion` and falls
  back to the last known-good feed (marked `degraded: true`) when rule generation input is unavailable.
- Validated with `npx vitest run tests/integration/routes/bundle-rule-manager.test.ts tests/unit/cart-intelligence tests/unit/knowledge-graph/bundles.test.ts` (82 tests passing).
