# Tasks: Replenishment Prediction

**Input**: Design documents from `/specs/013-replenishment-prediction/`  
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Include unit and integration tests because the plan explicitly requires coverage for lifecycle evaluation, shopper-facing route payloads, grouped refresh-cart actions, and webhook ingestion.

**Organization**: Tasks are grouped by user story so each story can be implemented and validated independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this belongs to (e.g. `US1`, `US2`)
- Every task includes an exact file path

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create the shared scaffolding needed to implement and validate replenishment prediction.

- [X] T001 Create replenishment fixture builders for purchase snapshots, lifecycle rules, and recommendation payloads in tests/helpers/replenishment-fixtures.ts
- [X] T002 Create the route and webhook test scaffolds in tests/integration/routes/replenishment-recommendations.test.ts and tests/integration/routes/webhooks-orders-create-replenishment.test.ts

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core persistence, loading, and payload plumbing that every replenishment story depends on.

**⚠️ CRITICAL**: No user story work should begin until this phase is complete.

- [X] T003 Extend replenishment persistence models and enums in prisma/schema.prisma
- [X] T004 Update lifecycle-rule, purchase-snapshot, and shopper-summary query helpers in app/lib/db/queries.ts
- [X] T005 [P] Add field-minimal historical order backfill helpers in app/lib/shopify/graphql.ts
- [X] T006 [P] Create base replenishment evaluation types and ranking utilities in app/lib/cart-intelligence/replenishment.ts
- [X] T007 Extend shopper-facing recommendation payload types for replenishment in app/lib/cart-intelligence/recommendations.ts
- [X] T008 Wire recognized-shopper replenishment loading into app/routes/api.ai.recommendations.tsx

**Checkpoint**: Foundation ready. User stories can now proceed independently.

---

## Phase 3: User Story 1 - Surface Timely Replacement Reminders (Priority: P1) 🎯 MVP

**Goal**: Identify due or approaching replacement items for returning shoppers using local lifecycle-backed purchase history.

**Independent Test**: Seed a recognized shopper with eligible purchase snapshots and verify that only due or approaching items surface in the recommendation response, ranked by urgency.

### Tests for User Story 1

- [ ] T009 [P] [US1] Add unit tests for due-window evaluation, urgency ranking, and no-history fallback in tests/unit/cart-intelligence/replenishment.test.ts
- [ ] T010 [P] [US1] Add integration tests for returning-shopper replenishment reminders in tests/integration/routes/replenishment-recommendations.test.ts

### Implementation for User Story 1

- [ ] T011 [US1] Implement lifecycle-rule lookup and due-candidate query helpers in app/lib/db/queries.ts
- [ ] T012 [US1] Implement due-window evaluation and reminder ranking in app/lib/cart-intelligence/replenishment.ts
- [ ] T013 [US1] Format shopper-facing reminder summaries and opportunities in app/lib/cart-intelligence/recommendations.ts
- [ ] T014 [US1] Return replenishment reminders for recognized shoppers in app/routes/api.ai.recommendations.tsx

**Checkpoint**: User Story 1 should now provide independently testable timely replenishment reminders.

---

## Phase 4: User Story 2 - Refresh a Prior Gear Set Quickly (Priority: P1)

**Goal**: Turn due reminders into executable reorder, upgrade, and grouped refresh-cart actions.

**Independent Test**: Present due replenishment candidates for a recognized shopper and verify the response includes executable reorder or upgrade targets plus a grouped refresh-cart action when multiple items are due.

### Tests for User Story 2

- [ ] T015 [P] [US2] Add unit tests for reorder-target selection, upgrade fallback, and grouped refresh-cart assembly in tests/unit/cart-intelligence/replenishment-recommendations.test.ts
- [ ] T016 [P] [US2] Add integration tests for refresh-cart and upgrade-ready replenishment responses in tests/integration/routes/replenishment-recommendations.test.ts

### Implementation for User Story 2

- [ ] T017 [US2] Implement reorder target hydration and upgrade candidate lookup in app/lib/db/queries.ts
- [ ] T018 [US2] Implement action selection and grouped refresh-cart assembly in app/lib/cart-intelligence/replenishment.ts
- [ ] T019 [US2] Extend replenishment response shaping with action targets and refresh-cart payloads in app/lib/cart-intelligence/recommendations.ts
- [ ] T020 [US2] Return executable replenishment actions from app/routes/api.ai.recommendations.tsx

**Checkpoint**: User Story 2 should now provide independently testable reorder, upgrade, and grouped refresh-cart actions.

---

## Phase 5: User Story 3 - Avoid Premature or Irrelevant Reminders (Priority: P2)

**Goal**: Suppress reminders that are too early, too ambiguous, or already satisfied by a recent qualifying purchase.

**Independent Test**: Use recent purchases, sparse histories, and a fresh qualifying order ingestion to verify the system hides or softens replenishment prompts instead of surfacing premature reminders.

### Tests for User Story 3

- [ ] T021 [P] [US3] Add unit tests for low-confidence suppression, quantity-aware timing, and recent-purchase cooldown logic in tests/unit/cart-intelligence/replenishment.test.ts
- [ ] T022 [P] [US3] Add integration tests for reminder suppression after recent purchases in tests/integration/routes/replenishment-recommendations.test.ts
- [ ] T023 [P] [US3] Add webhook ingestion tests for replenishment snapshot updates and reminder reset behavior in tests/integration/routes/webhooks-orders-create-replenishment.test.ts

### Implementation for User Story 3

- [ ] T024 [US3] Implement quantity-aware timing, sparse-history suppression, and confidence thresholds in app/lib/cart-intelligence/replenishment.ts
- [ ] T025 [US3] Implement replenishment purchase snapshot upserts and shopper-summary refresh logic in app/lib/db/queries.ts
- [ ] T026 [US3] Extend Shopify order webhook ingestion for replenishment snapshots in app/routes/webhooks.orders.create.tsx
- [ ] T027 [US3] Reflect suppressed and hidden replenishment states in app/lib/cart-intelligence/recommendations.ts

**Checkpoint**: User Story 3 should now provide independently testable suppression of premature or irrelevant reminders.

---

## Phase 6: User Story 4 - Respect Shopper Replacement Habits (Priority: P2)

**Goal**: Adapt replenishment timing and action preference to repeat shopper cadence and reorder-versus-upgrade behavior.

**Independent Test**: Use shoppers with repeated category purchases and distinct reorder or upgrade tendencies, then verify future replenishment timing and action preference follow those observed patterns.

### Tests for User Story 4

- [ ] T028 [P] [US4] Add unit tests for shopper-specific cadence inference and action preference learning in tests/unit/cart-intelligence/replenishment.test.ts
- [ ] T029 [P] [US4] Add integration tests for shopper-specific cadence and reorder-versus-upgrade behavior in tests/integration/routes/replenishment-recommendations.test.ts

### Implementation for User Story 4

- [ ] T030 [US4] Implement cadence inference and preferred-action persistence in app/lib/db/queries.ts
- [ ] T031 [US4] Implement shopper-specific cadence adjustment and action-preference weighting in app/lib/cart-intelligence/replenishment.ts
- [ ] T032 [US4] Extend replenishment shopper messaging with cadence-aware reasoning in app/lib/cart-intelligence/recommendations.ts

**Checkpoint**: User Story 4 should now provide independently testable shopper-specific replenishment timing and action selection.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Final validation, backfill support, and cross-story hardening.

- [ ] T033 [P] Add historical order backfill script for replenishment seeding in scripts/backfill-customer-purchases.ts
- [ ] T034 [P] Document final replenishment payload and ingestion examples in specs/013-replenishment-prediction/contracts/replenishment-recommendation-response.md and specs/013-replenishment-prediction/contracts/replenishment-purchase-ingestion.md
- [ ] T035 Tune replenishment query and ranking performance in app/lib/db/queries.ts and app/lib/cart-intelligence/replenishment.ts
- [ ] T036 Run quickstart regression scenarios in tests/integration/routes/replenishment-recommendations.test.ts and tests/integration/routes/webhooks-orders-create-replenishment.test.ts

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies.
- **Foundational (Phase 2)**: Depends on Setup completion and blocks all user stories.
- **User Stories (Phases 3-6)**: All depend on Foundational completion.
- **Polish (Phase 7)**: Depends on all desired user stories being complete.

### User Story Dependencies

- **User Story 1 (P1)**: Starts after Foundational and is the MVP slice for due reminder evaluation.
- **User Story 2 (P1)**: Starts after Foundational and builds executable actions on top of the same replenishment candidate pipeline while remaining independently testable.
- **User Story 3 (P2)**: Starts after Foundational and adds suppression plus webhook-driven freshness handling.
- **User Story 4 (P2)**: Starts after Foundational and layers shopper-specific cadence and action-preference behavior onto the replenishment engine.

### Recommended Delivery Order

- **MVP**: Phase 1 → Phase 2 → Phase 3 (US1)
- **Next**: Phase 4 (US2)
- **Then**: Phase 5 (US3)
- **Finally**: Phase 6 (US4) → Phase 7 (Polish)

### Within Each User Story

- Tests should be written before or alongside implementation and must fail before the corresponding story is considered complete.
- Query and persistence work should land before route or payload wiring when the story introduces new data dependencies.
- Replenishment engine changes should precede final payload shaping for the same story.
- Each story should be validated independently before moving to the next priority.

---

## Parallel Opportunities

- `T005` and `T006` can run in parallel after `T004` starts stabilizing the persistence shape.
- `T009` and `T010` can run in parallel for US1.
- `T015` and `T016` can run in parallel for US2.
- `T021`, `T022`, and `T023` can run in parallel for US3.
- `T028` and `T029` can run in parallel for US4.
- `T033` and `T034` can run in parallel during polish.

---

## Parallel Example: User Story 1

```bash
# Launch the US1 test tasks together:
Task: "Add unit tests for due-window evaluation, urgency ranking, and no-history fallback in tests/unit/cart-intelligence/replenishment.test.ts"
Task: "Add integration tests for returning-shopper replenishment reminders in tests/integration/routes/replenishment-recommendations.test.ts"
```

## Parallel Example: User Story 3

```bash
# Launch the US3 test tasks together:
Task: "Add unit tests for low-confidence suppression, quantity-aware timing, and recent-purchase cooldown logic in tests/unit/cart-intelligence/replenishment.test.ts"
Task: "Add integration tests for reminder suppression after recent purchases in tests/integration/routes/replenishment-recommendations.test.ts"
Task: "Add webhook ingestion tests for replenishment snapshot updates and reminder reset behavior in tests/integration/routes/webhooks-orders-create-replenishment.test.ts"
```

## Parallel Example: User Story 4

```bash
# Launch the US4 test tasks together:
Task: "Add unit tests for shopper-specific cadence inference and action preference learning in tests/unit/cart-intelligence/replenishment.test.ts"
Task: "Add integration tests for shopper-specific cadence and reorder-versus-upgrade behavior in tests/integration/routes/replenishment-recommendations.test.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup.
2. Complete Phase 2: Foundational.
3. Complete Phase 3: User Story 1.
4. Validate due reminder behavior independently before expanding scope.

### Incremental Delivery

1. Deliver US1 for timely replenishment reminders.
2. Add US2 for executable refresh-cart actions.
3. Add US3 for suppression and freshness handling.
4. Add US4 for cadence-aware personalization.
5. Finish with polish and quickstart regression validation.

### Parallel Team Strategy

1. One developer handles Prisma and DB query changes in prisma/schema.prisma and app/lib/db/queries.ts.
2. One developer handles lifecycle evaluation logic in app/lib/cart-intelligence/replenishment.ts.
3. One developer handles route and payload changes in app/routes/api.ai.recommendations.tsx, app/lib/cart-intelligence/recommendations.ts, and app/routes/webhooks.orders.create.tsx.
4. Merge by story checkpoint rather than by file ownership alone.

---

## Notes

- All tasks follow the required checklist format.
- Story labels appear only in user story phases.
- `[P]` is used only for tasks that can run in parallel without depending on the same incomplete slice.
- Each user story includes an independent validation target aligned with the specification.