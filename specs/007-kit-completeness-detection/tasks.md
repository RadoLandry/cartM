# Tasks: Kit Completeness Detection

**Feature**: `007-kit-completeness-detection`  
**Branch**: `007-detect-kit-completeness`  
**Input**: Design documents from `specs/007-kit-completeness-detection/`  
**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/)

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no incomplete dependencies)
- **[Story]**: Which user story this task belongs to (US1-US3)
- Exact file paths included in every task

---

## Phase 1: Setup

**Purpose**: Add the database structures required for merchant-managed kit definitions before cart intelligence work begins.

- [X] T001 Add `KitDefinition`, `KitRequirement`, `KitDefinitionSource`, `KitDefinitionStatus`, and `RequirementMatchMode` to `prisma/schema.prisma` per `specs/007-kit-completeness-detection/data-model.md`
- [X] T002 Generate Prisma migration `add_kit_completeness_detection` in `prisma/migrations/` and verify client regeneration from `prisma/schema.prisma`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared kit-template, query, and recommendation infrastructure required by all user stories.

**⚠️ CRITICAL**: No user story work can begin until Phase 1 and Phase 2 are complete.

- [X] T003 [P] Create shared kit template, requirement-fulfillment, and reasoning utilities in `app/lib/knowledge-graph/kits.ts` per `specs/007-kit-completeness-detection/contracts/kit-assessment.md`
- [X] T004 [P] Extend `app/lib/db/queries.ts` with kit definition CRUD, requirement CRUD, active-kit lookup, and available product/category query helpers for `app/routes/app.knowledge-graph.tsx`
- [X] T005 [P] Extend `app/lib/cart-intelligence/recommendations.ts` with kit recommendation payload scaffolding matching `specs/007-kit-completeness-detection/contracts/kit-recommendations.md`

**Checkpoint**: Schema, shared helpers, queries, and recommendation types are ready; user stories can now proceed.

---

## Phase 3: User Story 1 - Identify The Kit In Progress (Priority: P1) 🎯 MVP

**Goal**: The cart deterministically identifies one or more kits in progress and returns explainable completeness assessments.

**Independent Test**: Run `npx vitest run tests/unit/knowledge-graph/kits.test.ts` and `npx vitest run tests/unit/cart-intelligence/kit-detection.test.ts` to verify default kit derivation, single-discipline inference, multi-discipline separation, weak-evidence fallback, and empty-cart behavior.

### Tests for User Story 1

- [X] T006 [P] [US1] Add default-template and requirement-fulfillment tests in `tests/unit/knowledge-graph/kits.test.ts` for `app/lib/knowledge-graph/kits.ts`
- [X] T007 [P] [US1] Add single-discipline, multi-discipline, weak-evidence, and empty-cart inference tests in `tests/unit/cart-intelligence/kit-detection.test.ts` for `app/lib/cart-intelligence/kit-detection.ts`

### Implementation for User Story 1

- [X] T008 [US1] Implement default kit template derivation, discipline evidence grouping, and structured assessment reasons in `app/lib/knowledge-graph/kits.ts`
- [X] T009 [P] [US1] Create the starter kit seeding command in `scripts/backfill-kit-definitions.ts` using `app/lib/knowledge-graph/kits.ts` and `app/lib/db/queries.ts`
- [X] T010 [US1] Implement deterministic kit inference and assessment generation in `app/lib/cart-intelligence/kit-detection.ts`
- [X] T011 [US1] Integrate inferred kit assessments into `app/lib/cart-intelligence/recommendations.ts` for cart surfaces that need kit summaries and completeness status

**Checkpoint**: The app can identify kits in progress, including mixed-discipline carts, and return explainable completeness assessments without missing-item ranking yet.

---

## Phase 4: User Story 2 - Highlight Missing Essentials (Priority: P2)

**Goal**: The cart returns prioritized missing items, suppresses noise for complete kits, and treats substitutes as satisfying the right requirement.

**Independent Test**: Run `npx vitest run tests/unit/cart-intelligence/kit-detection.test.ts` to verify partial-kit ranking, complete-kit suppression, substitute coverage, and required-before-optional ordering.

### Tests for User Story 2

- [X] T012 [P] [US2] Extend `tests/unit/cart-intelligence/kit-detection.test.ts` with partial-kit, complete-kit, substitute-match, and missing-item priority assertions for `app/lib/cart-intelligence/kit-detection.ts`

### Implementation for User Story 2

- [X] T013 [US2] Extend requirement fulfillment in `app/lib/knowledge-graph/kits.ts` to honor category, product, and alternative-product matching modes from `specs/007-kit-completeness-detection/data-model.md`
- [X] T014 [US2] Extend `app/lib/cart-intelligence/kit-detection.ts` to calculate normalized completeness scores, suppress complete-kit prompts, and rank missing required items ahead of optional items
- [X] T015 [US2] Extend `app/lib/cart-intelligence/recommendations.ts` to emit shopper-facing missing-item payloads matching `specs/007-kit-completeness-detection/contracts/kit-recommendations.md`

**Checkpoint**: Shopper-facing kit completeness recommendations are independently testable and correctly prioritize essentials while suppressing complete-kit noise.

---

## Phase 5: User Story 3 - Preserve Merchant Control Over Kit Definitions (Priority: P3)

**Goal**: Merchants can manage kit definitions, priorities, and substitutes from the knowledge-graph admin surface, and those edits drive later cart analysis.

**Independent Test**: Run `npx vitest run tests/integration/routes/knowledge-graph-kits.test.ts` to verify `Kits` tab loading plus `save-kit-definition`, `save-kit-requirement`, `delete-kit-requirement`, and `archive-kit-definition` flows.

### Tests for User Story 3

- [ ] T016 [P] [US3] Add loader and action integration coverage in `tests/integration/routes/knowledge-graph-kits.test.ts` for the `Kits` tab in `app/routes/app.knowledge-graph.tsx`

### Implementation for User Story 3

- [ ] T017 [US3] Extend the loader in `app/routes/app.knowledge-graph.tsx` to return kit definitions, available category tags, and product options for merchant editing
- [ ] T018 [US3] Implement Zod-validated `save-kit-definition`, `save-kit-requirement`, `delete-kit-requirement`, and `archive-kit-definition` action intents in `app/routes/app.knowledge-graph.tsx`
- [ ] T019 [US3] Build the Polaris `Kits` tab UI in `app/routes/app.knowledge-graph.tsx` for editing kit metadata, required vs optional slots, priorities, and substitute coverage
- [ ] T020 [US3] Preserve merchant-authored kit definitions during reseed flows in `scripts/backfill-kit-definitions.ts` and `app/lib/db/queries.ts`

**Checkpoint**: Merchants can create and refine kit definitions in admin, and those edits persist as the source of truth for future cart analysis.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final validation, quickstart alignment, and quality-gate coverage across all stories.

- [ ] T021 [P] Update operator steps and validation commands in `specs/007-kit-completeness-detection/quickstart.md` to match the final migration, reseed flow, and focused test suite
- [ ] T022 Run `npx tsc --noEmit` and the focused Vitest suites for `tests/unit/knowledge-graph/kits.test.ts`, `tests/unit/cart-intelligence/kit-detection.test.ts`, and `tests/integration/routes/knowledge-graph-kits.test.ts`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies; starts immediately.
- **Foundational (Phase 2)**: Depends on Setup completion and blocks all user stories.
- **User Story 1 (Phase 3)**: Starts after Foundational and delivers the MVP inference slice.
- **User Story 2 (Phase 4)**: Starts after Foundational and builds on US1 assessment output.
- **User Story 3 (Phase 5)**: Starts after Foundational and depends on the shared kit schema/helpers plus final cart behavior from US1-US2.
- **Polish (Phase 6)**: Depends on all desired user stories being complete.

### User Story Dependencies

- **US1 (P1)**: No dependency on other user stories; this is the MVP slice.
- **US2 (P2)**: Depends on US1 because missing-item ranking builds on inferred kit assessments.
- **US3 (P3)**: Depends on foundational kit persistence and should validate against the finished scorer behavior from US1-US2.

### Within Each User Story

- Tests are listed first and should fail before implementation is considered done.
- Shared template and fulfillment helpers come before route/UI wiring.
- Query and action support come before the final Polaris admin interactions that invoke them.
- Recommendation payload shaping comes after assessment behavior is stable.

## Dependency Graph

```text
T001 → T002 → T003, T004, T005
             ↓
       T003, T004, T005 complete
             ↓
       T006, T007, T008, T009, T010, T011 (US1)
             ↓
                  US1 complete
             ↓
                T012, T013, T014, T015 (US2)
             ↓
                  US2 complete
             ↓
                T016, T017, T018, T019, T020 (US3)
             ↓
                    T021, T022 (Polish)
```

## Parallel Opportunities

- T003, T004, and T005 can run in parallel once the Prisma migration is in place.
- T006 and T007 can run in parallel with T009 because they touch separate files.
- T012 can run in parallel with T013 because test expansion and fulfillment-helper updates are in different files.
- T016 can run in parallel with preparatory loader work in T017 before actions and final UI wiring land.

## Parallel Example: User Story 1

```text
Developer A: T006 in tests/unit/knowledge-graph/kits.test.ts
Developer B: T007 in tests/unit/cart-intelligence/kit-detection.test.ts
Developer C: T009 in scripts/backfill-kit-definitions.ts
```

## Parallel Example: User Story 3

```text
Developer A: T016 in tests/integration/routes/knowledge-graph-kits.test.ts
Developer B: T017 in app/routes/app.knowledge-graph.tsx
```

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 and Phase 2.
2. Complete Phase 3 (US1).
3. Validate inferred kit identification independently.
4. Stop and demo the inference slice before moving to missing-item ranking.

### Incremental Delivery

1. Deliver US1 to establish deterministic kit inference.
2. Add US2 to surface prioritized missing essentials.
3. Add US3 to give merchants control over the kit definitions powering those recommendations.
4. Finish with Phase 6 validation and quickstart alignment.

### Suggested MVP Scope

Phases 1-3 (T001-T011) are the MVP. They deliver the highest-priority shopper value by identifying kits in progress and returning explainable completeness status that later stories can enrich with prioritized missing items and merchant control.