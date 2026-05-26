# Tasks: Smart Bundle Detection

**Feature**: `009-smart-bundle-detection`  
**Branch**: `009-smart-bundle-detection`  
**Input**: Design documents from `specs/009-smart-bundle-detection/`  
**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/)

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no incomplete dependencies)
- **[Story]**: Which user story this task belongs to (US1-US3)
- Exact file paths included in every task

---

## Phase 1: Setup

**Purpose**: Establish the new bundle persistence and shared feature scaffolding before core implementation begins.

- [X] T001 Add `BundleRule`, `BundleRuleComponent`, and supporting enums to `prisma/schema.prisma`
- [X] T002 [P] Generate the initial bundle-rule Prisma migration from `prisma/schema.prisma` into `prisma/migrations/`
- [X] T003 [P] Create shared bundle contracts, record shapers, and seed/template helpers in `app/lib/knowledge-graph/bundles.ts`
- [X] T004 [P] Add reusable bundle cart, rule, and overlap fixture builders in `tests/helpers/bundles.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared query, matcher, payload, and admin-route scaffolding that MUST exist before any user story can be implemented independently.

**⚠️ CRITICAL**: No user story work can begin until Phase 1 and Phase 2 are complete.

- [X] T005 [P] Extend `app/lib/db/queries.ts` with bundle rule CRUD, active-rule reads, preview reads, and compact projection helpers matching `specs/009-smart-bundle-detection/data-model.md`
- [X] T006 [P] Scaffold deterministic component-coverage, quantity-satisfaction, and overlap helper primitives in `app/lib/cart-intelligence/bundles.ts`
- [X] T007 [P] Add bundle recommendation payload scaffolding in `app/lib/cart-intelligence/recommendations.ts` aligned with `specs/009-smart-bundle-detection/contracts/bundle-recommendations.md`
- [X] T008 [P] Create the Polaris route shell and action-intent scaffolding for bundle management in `app/routes/app.bundles.tsx`

**Checkpoint**: Prisma models, shared contracts, query helpers, matcher scaffolding, payload scaffolding, and route skeleton are ready; user stories can now proceed.

---

## Phase 3: User Story 1 - Recognize Bundle Opportunities In The Cart (Priority: P1) 🎯 MVP

**Goal**: The cart deterministically detects full and near-complete bundle matches from active rules and returns stable match data with savings context.

**Independent Test**: Run `npx vitest run tests/unit/cart-intelligence/bundle-detection.test.ts` to verify qualified bundles, near-complete bundles, non-matching carts, and summary counts without relying on admin UI work.

### Tests for User Story 1

- [X] T009 [P] [US1] Add contract-driven detection coverage in `tests/unit/cart-intelligence/bundle-detection.test.ts` for qualified, nearly-complete, partial, and non-applicable results from `app/lib/cart-intelligence/bundles.ts`

### Implementation for User Story 1

- [X] T010 [US1] Implement required-component matching, quantity fulfillment, and match status classification in `app/lib/cart-intelligence/bundles.ts`
- [X] T011 [US1] Add stable bundle/component key shaping, savings metadata, and reason construction in `app/lib/knowledge-graph/bundles.ts` and `app/lib/cart-intelligence/bundles.ts`
- [X] T012 [US1] Wire active bundle rule reads from `app/lib/db/queries.ts` into the matcher input contract in `app/lib/knowledge-graph/bundles.ts` and `app/lib/cart-intelligence/bundles.ts`

**Checkpoint**: The app can detect and summarize full and near-complete bundle opportunities from persisted active rules.

---

## Phase 4: User Story 2 - Encourage High-Intent Bundle Completion (Priority: P2)

**Goal**: Bundle results become shopper-ready opportunities with clear savings messaging, overlap awareness, and availability-safe completion actions.

**Independent Test**: Run `npx vitest run tests/unit/cart-intelligence/bundle-detection.test.ts` and `npx vitest run tests/unit/cart-intelligence/bundle-recommendations.test.ts` to verify overlap handling, missing-component guidance, and shopper payload formatting.

### Tests for User Story 2

- [X] T013 [P] [US2] Extend `tests/unit/cart-intelligence/bundle-detection.test.ts` with overlapping-bundle, unavailable-candidate, and competition-group assertions for `app/lib/cart-intelligence/bundles.ts`
- [X] T014 [P] [US2] Add shopper payload and completion-action coverage in `tests/unit/cart-intelligence/bundle-recommendations.test.ts` for `app/lib/cart-intelligence/recommendations.ts`

### Implementation for User Story 2

- [X] T015 [US2] Extend `app/lib/cart-intelligence/bundles.ts` to compute missing components, competition groups, and completion candidate selection from active rule coverage
- [X] T016 [US2] Add availability-aware candidate lookup and ranking helpers in `app/lib/db/queries.ts` and `app/lib/knowledge-graph/bundles.ts`
- [X] T017 [US2] Implement shopper-facing bundle opportunity payload builders in `app/lib/cart-intelligence/recommendations.ts` matching `specs/009-smart-bundle-detection/contracts/bundle-recommendations.md`

**Checkpoint**: Qualified and near-complete bundle opportunities can be rendered directly in cart surfaces without extra interpretation logic.

---

## Phase 5: User Story 3 - Honor Merchant Bundle Rules And Priorities (Priority: P3)

**Goal**: Merchants can create, edit, preview, prioritize, and archive bundle rules through a dedicated Polaris admin workflow.

**Independent Test**: Run `npx vitest run tests/integration/routes/bundle-rule-manager.test.ts` to verify loader output plus `save-bundle-rule`, `save-bundle-component`, `delete-bundle-component`, `archive-bundle-rule`, and `preview-bundle-rule` flows.

### Tests for User Story 3

- [X] T018 [P] [US3] Add loader and action integration coverage in `tests/integration/routes/bundle-rule-manager.test.ts` for `app/routes/app.bundles.tsx`
- [ ] T019 [P] [US3] Add shared template, activation-guard, and projection coverage in `tests/unit/knowledge-graph/bundles.test.ts` for `app/lib/knowledge-graph/bundles.ts`

### Implementation for User Story 3

- [X] T020 [US3] Implement the bundle manager loader and Zod-validated `save-bundle-rule`, `save-bundle-component`, `delete-bundle-component`, `archive-bundle-rule`, and `preview-bundle-rule` actions in `app/routes/app.bundles.tsx`
- [ ] T021 [US3] Build the Polaris bundle rule manager UI, preview workflow, and priority/status controls in `app/routes/app.bundles.tsx`
- [ ] T022 [US3] Enforce activation safeguards, duplicate-key handling, preview support, and active-rule projection persistence helpers in `app/lib/db/queries.ts`
- [X] T023 [US3] Update embedded admin navigation in `app/routes/app.tsx` to expose the new `/app/bundles` workflow

**Checkpoint**: Merchant-authored bundle rules are independently manageable and previewable in admin, and they remain the source of truth for later cart analysis.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final validation, quickstart alignment, and implementation quality gates across all user stories.

- [ ] T024 [P] Update `specs/009-smart-bundle-detection/quickstart.md` with the final Prisma, admin preview, and focused validation commands
- [ ] T025 Run `npx tsc --noEmit` and the focused Vitest suites for `tests/unit/cart-intelligence/bundle-detection.test.ts`, `tests/unit/cart-intelligence/bundle-recommendations.test.ts`, `tests/unit/knowledge-graph/bundles.test.ts`, and `tests/integration/routes/bundle-rule-manager.test.ts`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies; starts immediately.
- **Foundational (Phase 2)**: Depends on Setup completion and blocks all user stories.
- **User Story 1 (Phase 3)**: Starts after Foundational and delivers the MVP detection slice.
- **User Story 2 (Phase 4)**: Starts after Foundational and builds on the raw match records created in US1.
- **User Story 3 (Phase 5)**: Starts after Foundational and depends on the shared persistence/query work, but is independently testable through the admin route.
- **Polish (Phase 6)**: Depends on all desired user stories being complete.

### User Story Dependencies

- **US1 (P1)**: No dependency on other user stories; this is the MVP slice.
- **US2 (P2)**: Depends on US1 because completion guidance and shopper payloads extend the match records created there.
- **US3 (P3)**: Depends on foundational query/persistence work, but not on shopper payload work.

### Within Each User Story

- Tests are listed first and should fail before implementation is considered done.
- Prisma and shared contract work precede matcher and route logic.
- Raw bundle matching comes before shopper payload shaping.
- Admin preview support comes before final Polaris workflow interactions that invoke it.

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
T018, T019, T020, T021, T022, T023 (US3)
  ↓
T024, T025
```

## Parallel Opportunities

- T002, T003, and T004 can run in parallel after T001 because they touch separate migration, shared-contract, and test-helper surfaces.
- T005, T006, T007, and T008 can run in parallel once Phase 1 completes.
- T013 and T014 can run in parallel because detector assertions and payload assertions live in different files.
- T018 and T019 can run in parallel because route integration coverage and shared helper coverage are isolated.
- T021 and T023 can run in parallel because the Polaris page implementation and app navigation update touch different files.

## Parallel Example: User Story 2

```text
Developer A: T013 in tests/unit/cart-intelligence/bundle-detection.test.ts
Developer B: T014 in tests/unit/cart-intelligence/bundle-recommendations.test.ts
Developer C: T017 in app/lib/cart-intelligence/recommendations.ts
```

## Parallel Example: User Story 3

```text
Developer A: T018 in tests/integration/routes/bundle-rule-manager.test.ts
Developer B: T020 in app/routes/app.bundles.tsx
Developer C: T022 in app/lib/db/queries.ts
```

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 and Phase 2.
2. Complete Phase 3 (US1).
3. Validate the matcher independently with the focused unit test suite.
4. Stop and demo deterministic bundle qualification before adding shopper completion guidance or merchant admin workflows.

### Incremental Delivery

1. Deliver US1 to establish reliable bundle qualification and near-complete detection.
2. Add US2 so shoppers get actionable, availability-safe completion guidance and savings messaging.
3. Add US3 so merchants can manage and preview the rules driving detection.
4. Finish with Phase 6 validation and quickstart alignment.

### Suggested MVP Scope

Phases 1-3 (T001-T012) are the MVP. They deliver the highest-priority shopper value by persisting bundle rules, matching active carts against them deterministically, and returning stable bundle qualification data that later stories can enrich with completion guidance and admin controls.