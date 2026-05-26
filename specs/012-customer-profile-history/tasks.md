# Tasks: Customer Profile & History

**Input**: Design documents from `/specs/012-customer-profile-history/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Include unit and integration tests because the plan explicitly requires coverage for profile resolution, route validation, merge behavior, confidence handling, and recommendation personalization.

**Organization**: Tasks are grouped by user story so each story can be implemented and validated independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this belongs to (e.g. `US1`, `US2`)
- Every task includes an exact file path

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create the shared scaffolding needed to implement and validate customer-profile personalization.

- [X] T001 Create shared customer-profile fixture builders in tests/helpers/customer-profile-fixtures.ts
- [X] T002 Create the customer-profile test scaffold in tests/integration/routes/customer-profile-recommendations.test.ts

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core persistence and request plumbing that every user story depends on.

**⚠️ CRITICAL**: No user story work should begin until this phase is complete.

- [X] T003 Extend the CustomerProfile persistence fields in prisma/schema.prisma
- [X] T004 Update customer-profile read, upsert, and merge helpers in app/lib/db/queries.ts
- [X] T005 [P] Add field-minimal customer and order summary GraphQL helpers in app/lib/shopify/graphql.ts
- [X] T006 [P] Extend shopper identity and profile-input request validation in app/routes/api.ai.recommendations.tsx
- [X] T007 Create base profile resolution types and merge utilities in app/lib/cart-intelligence/customer-profile.ts

**Checkpoint**: Foundation ready. User stories can now proceed independently.

---

## Phase 3: User Story 1 - Remember Returning Shopper Preferences (Priority: P1) 🎯 MVP

**Goal**: Reuse persistent recognized-shopper history so recommendations and sizing context feel continuous across sessions.

**Independent Test**: Use a logged-in shopper with stored history and verify that a later recommendation request reflects discipline, size, and recency-aware profile context without restating it.

### Tests for User Story 1

- [X] T008 [P] [US1] Add unit tests for recognized-shopper profile resolution and recency weighting in tests/unit/cart-intelligence/customer-profile.test.ts
- [X] T009 [P] [US1] Add integration tests for returning-shopper recommendation personalization in tests/integration/routes/customer-profile-recommendations.test.ts

### Implementation for User Story 1

- [X] T010 [US1] Implement recognized-shopper profile lookup and purchase-summary persistence in app/lib/db/queries.ts
- [X] T011 [US1] Implement returning-shopper resolution, recency weighting, and purchase-frequency mapping in app/lib/cart-intelligence/customer-profile.ts
- [X] T012 [US1] Inject resolved recognized-shopper context into app/routes/api.ai.recommendations.tsx
- [X] T013 [US1] Extend personalized recommendation payload shaping in app/lib/cart-intelligence/recommendations.ts
- [X] T014 [US1] Add order-created purchase-summary refresh handling in app/routes/webhooks.orders.create.tsx

**Checkpoint**: User Story 1 should now provide independently testable persistent personalization for returning shoppers.

---

## Phase 4: User Story 2 - Adapt Within an Anonymous Session (Priority: P1)

**Goal**: Build session-scoped personalization that improves guidance during an anonymous visit without leaking between shoppers.

**Independent Test**: Start an anonymous session, accumulate discipline or size signals, and verify later requests in the same session use that context while unrelated sessions remain isolated.

### Tests for User Story 2

- [X] T015 [P] [US2] Add unit tests for session-scoped profile resolution and isolation in tests/unit/cart-intelligence/customer-profile.test.ts
- [X] T016 [P] [US2] Add integration tests for anonymous-session personalization in tests/integration/routes/customer-profile-recommendations.test.ts

### Implementation for User Story 2

- [X] T017 [US2] Implement session-profile lookup, upsert, and isolation behavior in app/lib/db/queries.ts
- [X] T018 [US2] Implement anonymous-session resolution and generic fallback logic in app/lib/cart-intelligence/customer-profile.ts
- [X] T019 [US2] Wire sessionId-based personalization flow in app/routes/api.ai.recommendations.tsx

**Checkpoint**: User Story 2 should now provide independently testable anonymous-session personalization.

---

## Phase 5: User Story 3 - Let Explicit Inputs Correct the Profile (Priority: P2)

**Goal**: Allow shopper-provided profile details to override weaker inferred signals immediately.

**Independent Test**: Pass explicit profile input that conflicts with stored behavior and verify the next recommendation cycle follows the shopper-provided values.

### Tests for User Story 3

- [ ] T020 [P] [US3] Add unit tests for explicit-input precedence and source summaries in tests/unit/cart-intelligence/customer-profile.test.ts
- [ ] T021 [P] [US3] Add integration tests for profileInput request handling and validation in tests/integration/routes/customer-profile-recommendations.test.ts

### Implementation for User Story 3

- [ ] T022 [US3] Implement explicit profile merge and update handling in app/lib/db/queries.ts
- [ ] T023 [US3] Implement explicit-input precedence and attribute source tracking in app/lib/cart-intelligence/customer-profile.ts
- [ ] T024 [US3] Extend explicit profile-input parsing and response shaping in app/routes/api.ai.recommendations.tsx

**Checkpoint**: User Story 3 should now provide independently testable explicit-profile override behavior.

---

## Phase 6: User Story 4 - Reduce Noise for Experienced Repeat Shoppers (Priority: P2)

**Goal**: Use confidence, repeat-purchase patterns, and saved sizes to suppress low-value guidance for stable repeat shoppers while keeping safe fallbacks.

**Independent Test**: Use strong repeat-shopper histories and conflicting/low-confidence histories to verify the system reduces noise only when confidence supports it.

### Tests for User Story 4

- [ ] T025 [P] [US4] Add unit tests for guidance mode, low-confidence fallback, and repeat-shopper suppression in tests/unit/cart-intelligence/customer-profile.test.ts
- [ ] T026 [P] [US4] Add integration tests for reduced-noise recommendation behavior in tests/integration/routes/customer-profile-recommendations.test.ts

### Implementation for User Story 4

- [ ] T027 [US4] Implement confidence thresholds, guidance modes, and repeat-shopper noise reduction in app/lib/cart-intelligence/customer-profile.ts
- [ ] T028 [US4] Apply personalization intensity and source-aware messaging in app/lib/cart-intelligence/recommendations.ts
- [ ] T029 [US4] Consume resolved known sizes and low-confidence fallback behavior in app/lib/knowledge-graph/sizing.ts

**Checkpoint**: User Story 4 should now provide independently testable noise reduction for experienced repeat shoppers.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Final regression validation, contract examples, and performance hardening across all stories.

- [ ] T030 [P] Document final profile-resolution examples in specs/012-customer-profile-history/contracts/profile-resolution.md
- [ ] T031 [P] Document final route request examples in specs/012-customer-profile-history/contracts/recommendation-personalization-request.md
- [ ] T032 Tune profile-resolution and payload performance in app/lib/cart-intelligence/customer-profile.ts
- [ ] T033 Run quickstart regression scenarios in tests/integration/routes/customer-profile-recommendations.test.ts

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies.
- **Foundational (Phase 2)**: Depends on Setup completion and blocks all user stories.
- **User Stories (Phases 3-6)**: All depend on Foundational completion.
- **Polish (Phase 7)**: Depends on all desired user stories being complete.

### User Story Dependencies

- **User Story 1 (P1)**: Starts after Foundational and is the MVP slice for persistent returning-shopper personalization.
- **User Story 2 (P1)**: Starts after Foundational and can be delivered independently as anonymous-session personalization.
- **User Story 3 (P2)**: Starts after Foundational and layers explicit override behavior onto the resolved profile pipeline.
- **User Story 4 (P2)**: Starts after Foundational and depends on the resolved profile pipeline, but remains independently testable as confidence-based guidance reduction.

### Recommended Delivery Order

- **MVP**: Phase 1 → Phase 2 → Phase 3 (US1)
- **Next**: Phase 4 (US2)
- **Then**: Phase 5 (US3)
- **Finally**: Phase 6 (US4) → Phase 7 (Polish)

### Within Each User Story

- Tests should be written before or alongside implementation and must fail before the corresponding story is considered complete.
- Persistence and profile-resolution work should land before route wiring.
- Route wiring should precede payload refinement only when the story needs new request inputs; otherwise payload shaping follows resolver changes.
- Each story should be validated independently before moving to the next priority.

---

## Parallel Opportunities

- `T005` and `T006` can run in parallel after `T004` starts stabilizing the persistence shape.
- `T008` and `T009` can run in parallel for US1.
- `T015` and `T016` can run in parallel for US2.
- `T020` and `T021` can run in parallel for US3.
- `T025` and `T026` can run in parallel for US4.
- `T030` and `T031` can run in parallel during polish.

---

## Parallel Example: User Story 1

```bash
# Launch the US1 test tasks together:
Task: "Add unit tests for recognized-shopper profile resolution and recency weighting in tests/unit/cart-intelligence/customer-profile.test.ts"
Task: "Add integration tests for returning-shopper recommendation personalization in tests/integration/routes/customer-profile-recommendations.test.ts"
```

## Parallel Example: User Story 2

```bash
# Launch the US2 test tasks together:
Task: "Add unit tests for session-scoped profile resolution and isolation in tests/unit/cart-intelligence/customer-profile.test.ts"
Task: "Add integration tests for anonymous-session personalization in tests/integration/routes/customer-profile-recommendations.test.ts"
```

## Parallel Example: User Story 4

```bash
# Launch the US4 test tasks together:
Task: "Add unit tests for guidance mode, low-confidence fallback, and repeat-shopper suppression in tests/unit/cart-intelligence/customer-profile.test.ts"
Task: "Add integration tests for reduced-noise recommendation behavior in tests/integration/routes/customer-profile-recommendations.test.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup.
2. Complete Phase 2: Foundational.
3. Complete Phase 3: User Story 1.
4. Validate returning-shopper personalization independently before expanding scope.

### Incremental Delivery

1. Deliver US1 for persistent returning-shopper context.
2. Add US2 for anonymous-session adaptation.
3. Add US3 for explicit-profile correction.
4. Add US4 for confidence-based noise reduction and saved-size handoff.
5. Finish with polish and quickstart regression validation.

### Parallel Team Strategy

1. One developer handles Prisma and DB query changes in `prisma/schema.prisma` and `app/lib/db/queries.ts`.
2. One developer handles profile-resolution logic in `app/lib/cart-intelligence/customer-profile.ts`.
3. One developer handles route and payload changes in `app/routes/api.ai.recommendations.tsx` and `app/lib/cart-intelligence/recommendations.ts`.
4. Merge by story checkpoint rather than by file ownership alone.

---

## Notes

- All tasks follow the required checklist format.
- Story labels appear only in user story phases.
- `[P]` is used only for tasks that can run in parallel without depending on the same incomplete slice.
- Each user story includes an independent validation target aligned with the specification.