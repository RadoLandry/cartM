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
