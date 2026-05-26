# Tasks: Style & Colorway Matching

**Input**: Design documents from `/specs/011-style-colorway-matching/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Include unit and integration tests because the plan explicitly requires coverage for scoring, payload shaping, route behavior, suppression, variant handling, and merchant override precedence.

**Organization**: Tasks are grouped by user story so each story can be implemented and validated independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g. `US1`, `US2`)
- Every task includes an exact file path

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create the shared scaffolding needed to finish the shopper-facing style recommendation slice.

- [x] T001 Create shared style-matching fixture builders in tests/helpers/style-fixtures.ts
- [x] T002 Create the shopper style recommendation route scaffold in app/routes/api.ai.recommendations.tsx

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core plumbing that every story depends on.

**⚠️ CRITICAL**: No user story work should begin until this phase is complete.

- [x] T003 Implement cart visual hydration queries for products, variants, and visual profiles in app/lib/db/queries.ts
- [x] T004 [P] Extend effective variant visual resolution helpers in app/lib/knowledge-graph/colorways.ts
- [x] T005 [P] Add shopper style recommendation request parsing and validation in app/routes/api.ai.recommendations.tsx

**Checkpoint**: Foundation ready. User stories can now proceed.

---

## Phase 3: User Story 1 - Suggest Coordinated Cart Additions (Priority: P1) 🎯 MVP

**Goal**: Return subtle collection-completion or matching additions when the cart already shows a clear coordinated theme.

**Independent Test**: Build carts with two or more visually related items and verify the system returns in-stock addition suggestions that match the current collection or colorway context.

### Tests for User Story 1

- [x] T006 [P] [US1] Add unit tests for collection-completion addition ranking in tests/unit/cart-intelligence/style-coherence.test.ts
- [x] T007 [P] [US1] Add payload-shaping tests for coordinated addition summaries in tests/unit/cart-intelligence/style-recommendations.test.ts

### Implementation for User Story 1

- [x] T008 [US1] Refine dominant-theme detection and add-candidate ranking in app/lib/cart-intelligence/style-coherence.ts
- [x] T009 [US1] Build collection-completion shopper payload mapping in app/lib/cart-intelligence/recommendations.ts
- [x] T010 [US1] Return coordinated addition recommendations from app/routes/api.ai.recommendations.tsx

**Checkpoint**: User Story 1 should now return independently testable coordinated-addition recommendations.

---

## Phase 4: User Story 2 - Recommend Better-Matching Swaps (Priority: P1)

**Goal**: Suggest same-role swaps that improve visual coherence without changing shopper intent.

**Independent Test**: Build carts with one visually mismatched item and verify the system suggests a same-purpose alternative or variant that improves coherence.

### Tests for User Story 2

- [x] T011 [P] [US2] Add unit tests for same-role swap ranking in tests/unit/cart-intelligence/style-coherence.test.ts
- [x] T012 [P] [US2] Add integration test for swap recommendation responses in tests/integration/routes/style-recommendations.test.ts

### Implementation for User Story 2

- [x] T013 [US2] Extend same-role swap candidate sourcing in app/lib/db/queries.ts
- [x] T014 [US2] Implement variant-aware swap scoring and projected-score ranking in app/lib/cart-intelligence/style-coherence.ts
- [x] T015 [US2] Shape shopper-facing swap opportunities in app/lib/cart-intelligence/recommendations.ts

**Checkpoint**: User Story 2 should now produce independently testable better-matching swap recommendations.

---

## Phase 5: User Story 3 - Keep Recommendations Subtle and Trustworthy (Priority: P2)

**Goal**: Suppress or soften style guidance when the cart is already cohesive, ambiguous, or unsupported by credible evidence.

**Independent Test**: Analyze cohesive, intentionally mixed, and low-confidence carts and verify the system returns hidden or low-pressure results instead of forced recommendations.

### Tests for User Story 3

- [x] T016 [P] [US3] Add unit tests for cohesive and ambiguous suppression in tests/unit/cart-intelligence/style-coherence.test.ts
- [x] T017 [P] [US3] Add integration test for hidden style payloads in tests/integration/routes/style-recommendations.test.ts

### Implementation for User Story 3

- [x] T018 [US3] Implement ambiguity, low-confidence, and duplicate suppression in app/lib/cart-intelligence/style-coherence.ts
- [x] T019 [US3] Implement hidden or cohesive summaries and top-three opportunity capping in app/lib/cart-intelligence/recommendations.ts

**Checkpoint**: User Story 3 should now keep the experience restrained and independently testable.

---

## Phase 6: User Story 4 - Respect Merchant Visual Merchandising Rules (Priority: P2)

**Goal**: Ensure shopper-facing style guidance follows merchant-approved visual profiles, compatibility rules, and overrides.

**Independent Test**: Change collection or colorway overrides in the merchant workflow and verify later shopper-facing recommendations honor the merchant-defined values.

### Tests for User Story 4

- [x] T020 [P] [US4] Add unit tests for merchant override precedence in tests/unit/knowledge-graph/colorways.test.ts
- [x] T021 [P] [US4] Add integration test for merchant rule propagation in tests/integration/routes/style-recommendations.test.ts

### Implementation for User Story 4

- [x] T022 [US4] Apply merchant override precedence in effective visual resolution helpers in app/lib/knowledge-graph/colorways.ts
- [x] T023 [US4] Apply compatibility-rule and avoid-rule precedence in app/lib/cart-intelligence/style-coherence.ts
- [x] T024 [US4] Hydrate merchant-approved visual profiles and compatibility rules in app/routes/api.ai.recommendations.tsx

**Checkpoint**: User Story 4 should now keep shopper-facing style recommendations aligned with merchant merchandising intent.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Final consistency, documentation, and regression validation across stories.

- [ ] T025 [P] Document final shopper style payload examples in specs/011-style-colorway-matching/contracts/shopper-style-recommendations.md
- [ ] T026 Tune query and scoring performance across app/lib/db/queries.ts and app/lib/cart-intelligence/style-coherence.ts
- [x] T027 [P] Run quickstart regression scenarios in tests/unit/cart-intelligence/style-coherence.test.ts and tests/integration/routes/style-recommendations.test.ts

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies.
- **Foundational (Phase 2)**: Depends on Setup completion and blocks all user stories.
- **User Stories (Phases 3-6)**: Depend on Foundational completion.
- **Polish (Phase 7)**: Depends on all desired user stories being complete.

### User Story Dependencies

- **User Story 1 (P1)**: Starts after Foundational and is the MVP slice.
- **User Story 2 (P1)**: Starts after Foundational and can be developed independently of US1, though both touch the shared scorer and payload files.
- **User Story 3 (P2)**: Starts after Foundational and hardens the same scorer and payload surfaces used by US1 and US2.
- **User Story 4 (P2)**: Starts after Foundational and depends on the existing merchant override flow remaining authoritative.

### Recommended Delivery Order

- **MVP**: Phase 1 → Phase 2 → Phase 3 (US1)
- **Next**: Phase 4 (US2)
- **Then**: Phase 5 (US3)
- **Finally**: Phase 6 (US4) → Phase 7 (Polish)

### Within Each User Story

- Tests should be written before or alongside implementation and must fail before the corresponding code change is considered complete.
- Query or hydration work should precede scoring changes when the story needs new inputs.
- Scoring changes should precede payload and route wiring.
- Route behavior should be validated after library-level logic is in place.

---

## Parallel Opportunities

- `T004` and `T005` can run in parallel after `T003` is understood.
- `T006` and `T007` can run in parallel for US1.
- `T011` and `T012` can run in parallel for US2.
- `T016` and `T017` can run in parallel for US3.
- `T020` and `T021` can run in parallel for US4.
- `T025` and `T027` can run in parallel during polish.

---

## Parallel Example: User Story 1

```bash
# Launch the US1 test tasks together:
Task: "Add unit tests for collection-completion addition ranking in tests/unit/cart-intelligence/style-coherence.test.ts"
Task: "Add payload-shaping tests for coordinated addition summaries in tests/unit/cart-intelligence/style-recommendations.test.ts"
```

## Parallel Example: User Story 2

```bash
# Launch the US2 test tasks together:
Task: "Add unit tests for same-role swap ranking in tests/unit/cart-intelligence/style-coherence.test.ts"
Task: "Add integration test for swap recommendation responses in tests/integration/routes/style-recommendations.test.ts"
```

## Parallel Example: User Story 4

```bash
# Launch the US4 verification tasks together:
Task: "Add unit tests for merchant override precedence in tests/unit/knowledge-graph/colorways.test.ts"
Task: "Add integration test for merchant rule propagation in tests/integration/routes/style-recommendations.test.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup.
2. Complete Phase 2: Foundational.
3. Complete Phase 3: User Story 1.
4. Validate the coordinated-addition slice independently before continuing.

### Incremental Delivery

1. Deliver US1 for collection-completion additions.
2. Add US2 for better-matching swaps.
3. Add US3 to suppress low-signal or manipulative outputs.
4. Add US4 to guarantee merchant override precedence end to end.
5. Finish with polish and quickstart regression validation.

### Parallel Team Strategy

1. One developer handles shared data hydration (`app/lib/db/queries.ts`) after Foundational.
2. One developer handles scorer refinements in `app/lib/cart-intelligence/style-coherence.ts`.
3. One developer handles payload and route wiring in `app/lib/cart-intelligence/recommendations.ts` and `app/routes/api.ai.recommendations.tsx`.
4. Merge by story checkpoint, not by file ownership alone.

---

## Notes

- All tasks use the required checklist format.
- Story labels appear only in user story phases.
- `[P]` is used only for tasks that can run in parallel without touching the same incomplete slice.
- Each user story has an independent validation target aligned with the spec.