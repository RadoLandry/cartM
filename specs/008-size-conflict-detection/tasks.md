# Tasks: Size Conflict Detection

**Feature**: `008-size-conflict-detection`  
**Branch**: `008-size-conflict-detection`  
**Input**: Design documents from `specs/008-size-conflict-detection/`  
**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/)

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no incomplete dependencies)
- **[Story]**: Which user story this task belongs to (US1-US4)
- Exact file paths included in every task

---

## Phase 1: Setup

**Purpose**: Align shared contracts and reusable fixtures with the expanded size conflict feature scope before core implementation begins.

- [X] T001 Extend shared size conflict interfaces in `app/lib/knowledge-graph/sizing.ts` to match `specs/008-size-conflict-detection/contracts/size-conflict-detection.md` and `specs/008-size-conflict-detection/contracts/size-conflict-recommendations.md`
- [X] T002 [P] Add reusable cart, mapping, and variant fixture builders in `tests/helpers/size-conflicts.ts` for mapped mismatches, child/adult errors, ambiguous carts, and inventory-aware corrections

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared detector, query, and payload infrastructure required before any user story can be completed independently.

**⚠️ CRITICAL**: No user story work can begin until Phase 1 and Phase 2 are complete.

- [X] T003 [P] Extend `app/lib/db/queries.ts` with variant availability lookup, preview-read helpers, and size-rule retrieval needed by the detector and admin preview flow
- [X] T004 [P] Add size conflict recommendation payload scaffolding in `app/lib/cart-intelligence/recommendations.ts` matching `specs/008-size-conflict-detection/contracts/size-conflict-recommendations.md`
- [X] T005 [P] Refactor shared conflict key, suggestion-ranking, and low-noise helper primitives in `app/lib/cart-intelligence/size-conflicts.ts` for reuse across all stories

**Checkpoint**: Shared contracts, fixtures, queries, and payload scaffolding are ready; user stories can now proceed.

---

## Phase 3: User Story 1 - Shopper Is Warned About Incompatible Sizes (Priority: P1) 🎯 MVP

**Goal**: The cart deterministically detects cross-item size mismatches, identifies affected items, and classifies each conflict at the correct severity.

**Independent Test**: Run `npx vitest run tests/unit/knowledge-graph/size-conflicts.test.ts` to verify mapped mismatches, child/adult errors, valid carts, and multi-conflict carts all return the expected severities and summaries.

### Tests for User Story 1

- [X] T006 [P] [US1] Expand `tests/unit/knowledge-graph/size-conflicts.test.ts` with stable conflict key, severity summary, valid-cart, and multi-conflict assertions for `app/lib/cart-intelligence/size-conflicts.ts`

### Implementation for User Story 1

- [X] T007 [US1] Extend `app/lib/cart-intelligence/size-conflicts.ts` to emit `conflictKey`, `reasonType`, and summary counts while preserving deterministic pairwise conflict detection
- [X] T008 [US1] Align `app/lib/knowledge-graph/sizing.ts` exports and shared types with the richer conflict result contract consumed by downstream cart-intelligence modules
- [ ] T009 [US1] Add supported normalized size-rule evaluation in `app/lib/cart-intelligence/size-conflicts.ts` and `app/lib/db/queries.ts` for category pairs backed by existing `SizeChart` data

**Checkpoint**: The app can detect and classify shopper-facing size conflicts with stable identifiers and explainable result summaries.

---

## Phase 4: User Story 2 - Shopper Receives Actionable Correction Guidance (Priority: P1)

**Goal**: Each detected conflict includes a clear explanation plus structured correction candidates that only prefer available sizes.

**Independent Test**: Run `npx vitest run tests/unit/knowledge-graph/size-conflicts.test.ts` and `npx vitest run tests/unit/cart-intelligence/size-conflict-recommendations.test.ts` to verify explanation text, in-stock correction preference, unresolved mismatch handling, and shopper-facing payload formatting.

### Tests for User Story 2

- [ ] T010 [P] [US2] Extend `tests/unit/knowledge-graph/size-conflicts.test.ts` with expected-size, in-stock, out-of-stock, and rerun-after-resolution assertions for `app/lib/cart-intelligence/size-conflicts.ts`
- [ ] T011 [P] [US2] Add payload-building and primary-suggestion selection coverage in `tests/unit/cart-intelligence/size-conflict-recommendations.test.ts` for `app/lib/cart-intelligence/recommendations.ts`

### Implementation for User Story 2

- [ ] T012 [US2] Extend `app/lib/cart-intelligence/size-conflicts.ts` to build structured `suggestions` from mapping expectations and variant availability lookups in `app/lib/db/queries.ts`
- [ ] T013 [US2] Add shopper-facing size conflict payload builders in `app/lib/cart-intelligence/recommendations.ts` matching `specs/008-size-conflict-detection/contracts/size-conflict-recommendations.md`
- [ ] T014 [US2] Update shared sizing result types and explanation helpers in `app/lib/knowledge-graph/sizing.ts` and `app/lib/cart-intelligence/size-conflicts.ts` so conflicts can return actionable guidance without guessing unavailable variants

**Checkpoint**: Conflict results now include structured explanations and safe correction guidance that cart and checkout consumers can render directly.

---

## Phase 5: User Story 3 - Merchant Controls Compatibility Rules (Priority: P2)

**Goal**: Merchants can manage, preview, and preserve compatibility rules through the existing Knowledge Graph admin workflow.

**Independent Test**: Run `npx vitest run tests/integration/routes/knowledge-graph-size-conflicts.test.ts` to verify loader output plus `create-cross-size-mapping`, `delete-cross-size-mapping`, `save-size-chart-override`, `reset-size-chart-override`, and `preview-cross-size-conflict` flows.

### Tests for User Story 3

- [ ] T015 [P] [US3] Add loader and action integration coverage in `tests/integration/routes/knowledge-graph-size-conflicts.test.ts` for the size compatibility tooling in `app/routes/app.knowledge-graph.tsx`

### Implementation for User Story 3

- [ ] T016 [US3] Extend the size compatibility loader in `app/routes/app.knowledge-graph.tsx` to return preview state and richer mapping data defined in `specs/008-size-conflict-detection/contracts/merchant-size-compatibility-admin.md`
- [ ] T017 [US3] Implement Zod-validated `preview-cross-size-conflict` support in `app/routes/app.knowledge-graph.tsx` using new read helpers from `app/lib/db/queries.ts`
- [ ] T018 [US3] Build the Polaris preview and richer compatibility management UI in `app/routes/app.knowledge-graph.tsx` for mapping validation and merchant rule review
- [ ] T019 [US3] Preserve merchant-defined compatibility behavior across override reset and reseed flows in `app/lib/db/queries.ts` and `scripts/seed-size-charts.ts`

**Checkpoint**: Merchant-managed compatibility rules are independently testable in admin and remain the source of truth for later cart analysis.

---

## Phase 6: User Story 4 - Ambiguous Carts Stay Low-Noise (Priority: P3)

**Goal**: The detector stays quiet when evidence is incomplete and cleanly separates multiple unrelated conflicts when they do exist.

**Independent Test**: Run `npx vitest run tests/unit/knowledge-graph/size-conflicts.test.ts` with single-item carts, missing-size carts, unmapped pairs, unsupported labels, and mixed sized/non-sized carts to verify that only reliable conflicts are returned.

### Tests for User Story 4

- [ ] T020 [P] [US4] Extend `tests/unit/knowledge-graph/size-conflicts.test.ts` with single-item, missing-size, unmapped-pair, unsupported-label, and mixed sized/non-sized cart cases for low-noise behavior

### Implementation for User Story 4

- [ ] T021 [US4] Tighten skip, dedupe, and unsupported-label handling in `app/lib/cart-intelligence/size-conflicts.ts` so ambiguous carts do not produce fabricated conflicts
- [ ] T022 [US4] Filter incomplete and non-sized cart inputs before pair evaluation in `app/lib/knowledge-graph/sizing.ts` and `app/lib/cart-intelligence/size-conflicts.ts`
- [ ] T023 [US4] Refine fallback shopper payload behavior in `app/lib/cart-intelligence/recommendations.ts` so unavailable or low-confidence suggestions never become the primary action

**Checkpoint**: The cart remains quiet for incomplete evidence while still surfacing distinct real conflicts clearly.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Final validation, quickstart alignment, and implementation quality gates across all user stories.

- [ ] T024 [P] Update `specs/008-size-conflict-detection/quickstart.md` with the final focused test commands, admin preview flow, and manual verification steps
- [ ] T025 Run `npx tsc --noEmit` and the focused Vitest suites for `tests/unit/knowledge-graph/size-conflicts.test.ts`, `tests/unit/cart-intelligence/size-conflict-recommendations.test.ts`, and `tests/integration/routes/knowledge-graph-size-conflicts.test.ts`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies; starts immediately.
- **Foundational (Phase 2)**: Depends on Setup completion and blocks all user stories.
- **User Story 1 (Phase 3)**: Starts after Foundational and delivers the MVP detection slice.
- **User Story 2 (Phase 4)**: Starts after Foundational and builds on US1 conflict output.
- **User Story 3 (Phase 5)**: Starts after Foundational and depends on shared query/helper work, but is independently testable through the admin route.
- **User Story 4 (Phase 6)**: Starts after Foundational and tightens behavior across the completed detector.
- **Polish (Phase 7)**: Depends on all desired user stories being complete.

### User Story Dependencies

- **US1 (P1)**: No dependency on other user stories; this is the MVP slice.
- **US2 (P1)**: Depends on US1 because correction guidance extends the conflict records created there.
- **US3 (P2)**: Depends on foundational query/helper work, but not on shopper payload work.
- **US4 (P3)**: Depends on US1 because low-noise refinement adjusts the detector behavior delivered in the MVP.

### Within Each User Story

- Tests are listed first and should fail before implementation is considered done.
- Shared interfaces and query helpers come before final detector and UI wiring.
- Payload shaping comes after raw conflict behavior is stable.
- Admin preview support comes before final Polaris UI interactions that invoke it.

## Dependency Graph

```text
T001, T002
  ↓
T003, T004, T005
  ↓
T006, T007, T008, T009 (US1)
  ↓
T010, T011, T012, T013, T014 (US2)
  ↓
T015, T016, T017, T018, T019 (US3)
  ↓
T020, T021, T022, T023 (US4)
  ↓
T024, T025
```

## Parallel Opportunities

- T001 and T002 can run in parallel because they touch separate shared contract and test-helper files.
- T003, T004, and T005 can run in parallel once Phase 1 completes.
- T010 and T011 can run in parallel because detector assertions and payload assertions live in different files.
- T015 can run in parallel with the initial loader work in T016.
- T020 can run in parallel with T023 because the test expansion and payload fallback adjustments touch different files.

## Parallel Example: User Story 2

```text
Developer A: T010 in tests/unit/knowledge-graph/size-conflicts.test.ts
Developer B: T011 in tests/unit/cart-intelligence/size-conflict-recommendations.test.ts
Developer C: T013 in app/lib/cart-intelligence/recommendations.ts
```

## Parallel Example: User Story 3

```text
Developer A: T015 in tests/integration/routes/knowledge-graph-size-conflicts.test.ts
Developer B: T016 in app/routes/app.knowledge-graph.tsx
Developer C: T019 in app/lib/db/queries.ts and scripts/seed-size-charts.ts
```

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 and Phase 2.
2. Complete Phase 3 (US1).
3. Validate the detector independently with focused unit tests.
4. Stop and demo the core size conflict slice before adding correction guidance or admin preview tooling.

### Incremental Delivery

1. Deliver US1 to establish reliable conflict detection and severity classification.
2. Add US2 so shoppers get actionable, inventory-aware correction guidance.
3. Add US3 to give merchants previewable control over the compatibility rules driving detection.
4. Add US4 to reduce false positives and finish low-noise behavior.
5. Finish with Phase 7 validation and quickstart alignment.

### Suggested MVP Scope

Phases 1-3 (T001-T009) are the MVP. They deliver the highest-priority shopper value by detecting and classifying size conflicts in the cart with stable, explainable results that later stories can enrich with correction guidance and admin preview controls.