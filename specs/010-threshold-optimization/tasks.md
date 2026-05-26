# Tasks: Threshold Optimization

**Feature**: `010-threshold-optimization`  
**Branch**: `010-optimize-threshold`  
**Input**: Design documents from `specs/010-threshold-optimization/`  
**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/)

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no incomplete dependencies)
- **[Story]**: Which user story this task belongs to (US1-US4)
- Exact file paths included in every task

---

## Phase 1: Setup

**Purpose**: Establish threshold-rule persistence and shared feature scaffolding before core implementation begins.

- [X] T001 Add `ThresholdRule` model(s) and supporting enums to `prisma/schema.prisma`
- [X] T002 [P] Generate the initial threshold-rule Prisma migration from `prisma/schema.prisma` into `prisma/migrations/`
- [X] T003 [P] Create shared threshold contracts, seed helpers, and scoring primitives in `app/lib/knowledge-graph/thresholds.ts`
- [X] T004 [P] Add reusable threshold cart, rule, and candidate fixture builders in `tests/helpers/thresholds.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared query, evaluator, payload, and admin-route scaffolding that MUST exist before any user story can be implemented independently.

**⚠️ CRITICAL**: No user story work can begin until Phase 1 and Phase 2 are complete.

- [X] T005 [P] Extend `app/lib/db/queries.ts` with threshold rule CRUD, active-rule reads, catalog lookup helpers, and preview reads matching `specs/010-threshold-optimization/data-model.md`
- [X] T006 [P] Scaffold threshold selection, gap calculation, suppression, and candidate-ranking primitives in `app/lib/cart-intelligence/threshold.ts`
- [X] T007 [P] Add threshold recommendation payload scaffolding in `app/lib/cart-intelligence/recommendations.ts` aligned with `specs/010-threshold-optimization/contracts/threshold-recommendations.md`
- [X] T008 [P] Create the Polaris route shell and action-intent scaffolding for threshold management in `app/routes/app.thresholds.tsx`

**Checkpoint**: Prisma models, shared contracts, query helpers, evaluator scaffolding, payload scaffolding, and route skeleton are ready; user stories can now proceed.

---

## Phase 3: User Story 1 - Shopper Gets Relevant Threshold Suggestions (Priority: P1) 🎯 MVP

**Goal**: Near-threshold carts surface up to three contextually relevant add-on suggestions that can credibly help the shopper reach the chosen threshold.

**Independent Test**: Run `npx vitest run tests/unit/cart-intelligence/threshold.test.ts` to verify threshold selection, candidate ranking, and candidate count behavior for eligible carts without relying on admin UI work.

### Tests for User Story 1

- [X] T009 [P] [US1] Add contract-driven threshold evaluation coverage in `tests/unit/cart-intelligence/threshold.test.ts` for threshold selection, gap calculation, and top-three candidate ranking from `app/lib/cart-intelligence/threshold.ts`

### Implementation for User Story 1

- [X] T010 [US1] Implement nearest-threshold selection, actionable-window checks, and gap calculation in `app/lib/cart-intelligence/threshold.ts`
- [X] T011 [US1] Add contextual candidate filtering and ranking helpers using category, discipline, price, and duplicate-policy signals in `app/lib/knowledge-graph/thresholds.ts` and `app/lib/cart-intelligence/threshold.ts`
- [X] T012 [US1] Wire active threshold-rule reads and catalog candidate lookups from `app/lib/db/queries.ts` into the evaluator contract in `app/lib/knowledge-graph/thresholds.ts` and `app/lib/cart-intelligence/threshold.ts`

**Checkpoint**: Eligible carts can deterministically produce ranked threshold-closing candidates from persisted active rules.

---

## Phase 4: User Story 2 - Shopper Receives Clear Value Reasoning (Priority: P1)

**Goal**: Threshold results become shopper-ready payloads with clear benefit messaging and distinct contextual reasoning for each surfaced suggestion.

**Independent Test**: Run `npx vitest run tests/unit/cart-intelligence/threshold.test.ts` and `npx vitest run tests/unit/cart-intelligence/threshold-recommendations.test.ts` to verify explanation fields, summary states, and one-to-three ordered suggestion payloads.

### Tests for User Story 2

- [ ] T013 [P] [US2] Extend `tests/unit/cart-intelligence/threshold.test.ts` with reasoning and unlock-message assertions for eligible threshold outcomes in `app/lib/cart-intelligence/threshold.ts`
- [ ] T014 [P] [US2] Add shopper payload coverage in `tests/unit/cart-intelligence/threshold-recommendations.test.ts` for `app/lib/cart-intelligence/recommendations.ts`

### Implementation for User Story 2

- [ ] T015 [US2] Extend `app/lib/cart-intelligence/threshold.ts` to attach selection reasons, candidate reasoning fragments, and overshoot metadata to evaluation results
- [ ] T016 [US2] Implement shopper-facing threshold summary and suggestion payload builders in `app/lib/cart-intelligence/recommendations.ts` matching `specs/010-threshold-optimization/contracts/threshold-recommendations.md`
- [ ] T017 [US2] Add benefit-label, price-label, and unlock-message shaping helpers in `app/lib/knowledge-graph/thresholds.ts` for downstream cart surfaces

**Checkpoint**: Threshold opportunities can be rendered directly in cart surfaces with concise, shopper-readable explanations.

---

## Phase 5: User Story 3 - Low-Relevance Carts Stay Quiet (Priority: P2)

**Goal**: The evaluator suppresses threshold prompts for already-qualified carts, wide gaps, unavailable candidates, or low-relevance add-ons instead of surfacing filler suggestions.

**Independent Test**: Run `npx vitest run tests/unit/cart-intelligence/threshold.test.ts` to verify hidden or suppressed results for already-qualified carts, out-of-window carts, low-relevance carts, and unavailable-candidate scenarios.

### Tests for User Story 3

- [ ] T018 [P] [US3] Extend `tests/unit/cart-intelligence/threshold.test.ts` with suppression-path coverage for qualified, outside-window, no-in-stock-candidate, and below-relevance-floor scenarios in `app/lib/cart-intelligence/threshold.ts`
- [ ] T019 [P] [US3] Extend `tests/unit/cart-intelligence/threshold-recommendations.test.ts` with hidden and qualified summary-state assertions in `app/lib/cart-intelligence/recommendations.ts`

### Implementation for User Story 3

- [ ] T020 [US3] Implement suppression policies, relevance floors, and availability filtering in `app/lib/cart-intelligence/threshold.ts`
- [ ] T021 [US3] Add duplicate-suggestion safeguards and mixed-discipline prioritization helpers in `app/lib/knowledge-graph/thresholds.ts` and `app/lib/cart-intelligence/threshold.ts`
- [ ] T022 [US3] Update `app/lib/cart-intelligence/recommendations.ts` to hide threshold prompts for suppressed outcomes and render passive qualified summaries only

**Checkpoint**: Low-confidence or already-satisfied carts stay quiet without weakening the core eligible-cart recommendation behavior.

---

## Phase 6: User Story 4 - Merchant Threshold Rules Are Respected (Priority: P2)

**Goal**: Merchants can create, edit, preview, prioritize, and archive threshold rules through a dedicated Polaris workflow, and those rules drive future threshold evaluations.

**Independent Test**: Run `npx vitest run tests/integration/routes/threshold-manager.test.ts` to verify loader output plus `save-threshold-rule`, `preview-threshold-rule`, and `archive-threshold-rule` flows without depending on shopper UI work.

### Tests for User Story 4

- [ ] T023 [P] [US4] Add loader and action integration coverage in `tests/integration/routes/threshold-manager.test.ts` for `app/routes/app.thresholds.tsx`
- [ ] T024 [P] [US4] Add threshold template, duplicate-key, and rule-shaping coverage in `tests/unit/knowledge-graph/thresholds.test.ts` for `app/lib/knowledge-graph/thresholds.ts`

### Implementation for User Story 4

- [ ] T025 [US4] Implement the threshold manager loader and Zod-validated `save-threshold-rule`, `preview-threshold-rule`, and `archive-threshold-rule` actions in `app/routes/app.thresholds.tsx`
- [ ] T026 [US4] Build the Polaris threshold manager UI, preview workflow, and priority/status controls in `app/routes/app.thresholds.tsx`
- [ ] T027 [US4] Enforce duplicate-key handling, activation safeguards, and preview data shaping in `app/lib/db/queries.ts` and `app/lib/knowledge-graph/thresholds.ts`
- [ ] T028 [US4] Update embedded admin navigation in `app/routes/app.tsx` and retire the placeholder workflow in `app/routes/app.additional.tsx`

**Checkpoint**: Merchant-authored threshold rules are independently manageable and previewable in admin, and they remain the source of truth for shopper threshold analysis.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Final validation, quickstart alignment, and implementation quality gates across all user stories.

- [ ] T029 [P] Update `specs/010-threshold-optimization/quickstart.md` with the final Prisma, route-preview, and focused validation commands
- [ ] T030 Run `npx tsc --noEmit` and the focused Vitest suites for `tests/unit/cart-intelligence/threshold.test.ts`, `tests/unit/cart-intelligence/threshold-recommendations.test.ts`, `tests/unit/knowledge-graph/thresholds.test.ts`, and `tests/integration/routes/threshold-manager.test.ts`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies; starts immediately.
- **Foundational (Phase 2)**: Depends on Setup completion and blocks all user stories.
- **User Story 1 (Phase 3)**: Starts after Foundational and delivers the MVP threshold evaluator.
- **User Story 2 (Phase 4)**: Starts after US1 because shopper reasoning and payload shaping depend on evaluator outputs.
- **User Story 3 (Phase 5)**: Starts after US1 and can proceed alongside US2 because suppression logic extends evaluator behavior, not admin CRUD.
- **User Story 4 (Phase 6)**: Starts after Foundational and depends on shared persistence and preview helpers, but not on shopper payload work.
- **Polish (Phase 7)**: Depends on all desired user stories being complete.

### User Story Dependencies

- **US1 (P1)**: No dependency on other user stories; this is the MVP slice.
- **US2 (P1)**: Depends on US1 because reasoning payloads build on evaluated threshold candidates.
- **US3 (P2)**: Depends on US1 because suppression behavior extends the evaluator selection logic.
- **US4 (P2)**: Depends only on foundational persistence and route scaffolding; it is independently testable through the admin workflow.

### Within Each User Story

- Tests are listed first and should fail before implementation is considered done.
- Prisma and shared contract work precede evaluator and route logic.
- Raw threshold evaluation comes before shopper payload shaping.
- Preview support comes before final admin workflow interactions that invoke it.

## Dependency Graph

```text
T001, T002, T003, T004
  ↓
T005, T006, T007, T008
  ↓
T009, T010, T011, T012 (US1)
  ↓
T013, T014, T015, T016, T017 (US2)
  ↓
T018, T019, T020, T021, T022 (US3)
  ↓
T023, T024, T025, T026, T027, T028 (US4)
  ↓
T029, T030
```

## Parallel Opportunities

- T002, T003, and T004 can run in parallel after T001 because they touch separate migration, shared-contract, and test-helper surfaces.
- T005, T006, T007, and T008 can run in parallel once Phase 1 completes.
- T013 and T014 can run in parallel because evaluator assertions and payload assertions live in different files.
- T018 and T019 can run in parallel because evaluator suppression coverage and payload-summary coverage are isolated.
- T023 and T024 can run in parallel because route integration coverage and shared threshold helper coverage touch separate files.
- T026 and T028 can run in parallel because the Polaris page implementation and app navigation update touch different route files.

## Parallel Example: User Story 2

```text
Developer A: T013 in tests/unit/cart-intelligence/threshold.test.ts
Developer B: T014 in tests/unit/cart-intelligence/threshold-recommendations.test.ts
Developer C: T016 in app/lib/cart-intelligence/recommendations.ts
```

## Parallel Example: User Story 4

```text
Developer A: T023 in tests/integration/routes/threshold-manager.test.ts
Developer B: T025 in app/routes/app.thresholds.tsx
Developer C: T027 in app/lib/db/queries.ts and app/lib/knowledge-graph/thresholds.ts
```

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 and Phase 2.
2. Complete Phase 3 (US1).
3. Validate the evaluator independently with the focused unit test suite.
4. Stop and demo deterministic threshold selection plus ranked near-threshold candidates before adding shopper messaging or merchant CRUD.

### Incremental Delivery

1. Deliver US1 to establish reliable threshold selection and candidate ranking.
2. Add US2 so eligible carts get clear threshold-benefit and contextual reasoning.
3. Add US3 so low-relevance and already-qualified carts suppress noisy prompts.
4. Add US4 so merchants can manage and preview the rules that drive threshold behavior.
5. Finish with Phase 7 validation and quickstart alignment.

### Suggested MVP Scope

Phases 1-3 (T001-T012) are the MVP. They deliver the highest-priority shopper value by persisting threshold rules, evaluating near-threshold carts deterministically, and returning ranked candidate products that later stories can enrich with shopper messaging, suppression refinement, and merchant admin controls.