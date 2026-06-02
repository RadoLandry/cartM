# Tasks: Kit Composition Renderer

**Input**: Design documents from `/specs/019-render-kit-composition/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Included because the plan and constitution require test coverage for new business logic.

**Organization**: Tasks are grouped by user story so each story can be implemented and tested independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Every task includes an exact file path

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Prepare feature-specific test/data scaffolding.

- [x] T001 Create kit preview test fixtures and cart snapshots in tests/helpers/kit-preview-fixtures.ts
- [x] T002 [P] Create preview performance assertion helpers in tests/helpers/kit-preview-performance.ts
- [x] T003 [P] Create route test skeleton for kit preview endpoint in tests/integration/routes/kit-preview-route.test.ts

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core endpoint and composition foundations required before all user stories.

**⚠️ CRITICAL**: No user story work starts until this phase is complete.

- [x] T004 Add request payload validation and Node runtime declaration in app/routes/api.ai.kit-preview.tsx
- [x] T005 [P] Implement cart snapshot normalization for preview composition in app/lib/shopify/storefront-cart.ts
- [x] T006 [P] Implement layout profile registry with mixed-discipline fallback in app/lib/visual/templates.ts
- [x] T007 Define composition result and omission reason primitives in app/lib/visual/compositor.ts
- [x] T008 Implement cache key derivation from snapshot signature and template version in app/lib/visual/compositor.ts
- [x] T009 Wire endpoint orchestration skeleton (normalize, select layout, compose, respond) in app/routes/api.ai.kit-preview.tsx

**Checkpoint**: Foundation ready. User stories can begin.

---

## Phase 3: User Story 1 - View Complete Kit Preview (Priority: P1) 🎯 MVP

**Goal**: Return a cohesive composed kit preview for current cart contents and refresh it when cart changes.

**Independent Test**: Populate cart with multiple eligible items, request preview, verify a single composed preview is returned and updates after cart edits.

### Tests for User Story 1

- [x] T010 [P] [US1] Add integration test for successful composed preview response in tests/integration/routes/kit-preview-route.test.ts
- [x] T011 [P] [US1] Add unit test for full composition of eligible items in tests/unit/visual/compositor.test.ts

### Implementation for User Story 1

- [x] T012 [US1] Implement full composition pipeline for eligible cart items in app/lib/visual/compositor.ts
- [x] T013 [US1] Implement endpoint success payload mapping for composed preview in app/routes/api.ai.kit-preview.tsx
- [x] T014 [US1] Add storefront preview request flow in storefront-widget/src/hooks/useStorefrontChat.ts
- [x] T015 [US1] Implement preview rendering component for composed asset in storefront-widget/src/components/guidance/KitPreviewCard.tsx
- [x] T016 [US1] Trigger preview regeneration after cart mutations in storefront-widget/src/hooks/useStorefrontChat.ts

**Checkpoint**: US1 is independently functional and testable.

---

## Phase 4: User Story 2 - Receive Discipline-Appropriate Layout (Priority: P1)

**Goal**: Use discipline-aware layouts with deterministic mixed-discipline fallback.

**Independent Test**: Compare outputs for single-discipline carts and mixed carts; verify expected template selection and context signaling.

### Tests for User Story 2

- [x] T017 [P] [US2] Add unit tests for discipline template selection logic in tests/unit/visual/templates.test.ts
- [x] T018 [P] [US2] Add integration test for mixed-discipline fallback behavior in tests/integration/routes/kit-preview-route.test.ts

### Implementation for User Story 2

- [x] T019 [US2] Implement discipline-specific slot templates and neutral fallback template in app/lib/visual/templates.ts
- [x] T020 [US2] Implement discipline-to-layout resolution in composition pipeline in app/lib/visual/compositor.ts
- [x] T021 [US2] Include inferred discipline and layout metadata in endpoint response in app/routes/api.ai.kit-preview.tsx
- [x] T022 [US2] Render mixed-context indicator and layout metadata in storefront-widget/src/components/guidance/KitPreviewCard.tsx

**Checkpoint**: US2 is independently functional and testable.

---

## Phase 5: User Story 3 - Reuse Existing Preview Quickly (Priority: P2)

**Goal**: Reuse unchanged preview assets and invalidate deterministically when cart/template changes.

**Independent Test**: Request preview twice without cart changes to verify reuse, then mutate cart and verify regeneration.

### Tests for User Story 3

- [x] T023 [P] [US3] Add integration test for unchanged-cart preview reuse in tests/integration/routes/kit-preview-route.test.ts
- [x] T024 [P] [US3] Add integration test for regeneration after cart mutation in tests/integration/routes/kit-preview-route.test.ts
- [x] T025 [P] [US3] Add unit tests for deterministic cache key generation in tests/unit/visual/compositor.test.ts

### Implementation for User Story 3

- [x] T026 [US3] Implement reuse-record lookup and write-through behavior in app/lib/visual/compositor.ts
- [x] T027 [US3] Implement forceRegenerate and invalidation path handling in app/routes/api.ai.kit-preview.tsx
- [x] T028 [US3] Return reuse diagnostics (reused flag and generation timing) in app/routes/api.ai.kit-preview.tsx
- [x] T029 [US3] Add client handling for reused preview metadata in storefront-widget/src/hooks/useStorefrontChat.ts

**Checkpoint**: US3 is independently functional and testable.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final hardening across all stories.

- [x] T030 [P] Implement omission/fallback UI messaging for excluded items in storefront-widget/src/components/guidance/KitPreviewCard.tsx
- [x] T031 [P] Add edge-case integration tests (empty cart, missing image, fetch failure) in tests/integration/routes/kit-preview-route.test.ts
- [x] T032 Add composition performance assertions for first-render vs reuse paths in tests/integration/routes/kit-preview-route.test.ts
- [x] T033 Run and document quickstart scenario validation updates in specs/019-render-kit-composition/quickstart.md

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies.
- **Phase 2 (Foundational)**: Depends on Phase 1; blocks all user story work.
- **Phase 3 (US1)**: Depends on Phase 2.
- **Phase 4 (US2)**: Depends on Phase 2; can run in parallel with US1 after foundational completion.
- **Phase 5 (US3)**: Depends on Phase 2 and benefits from US1 endpoint/composition flow.
- **Phase 6 (Polish)**: Depends on completion of selected user stories.

### User Story Dependencies

- **US1 (P1)**: Starts after Foundational phase; no dependency on US2/US3.
- **US2 (P1)**: Starts after Foundational phase; independent of US1 except shared files.
- **US3 (P2)**: Starts after Foundational; depends on established composition endpoint behavior from US1.

### Within Each User Story

- Write tests first and confirm they fail.
- Implement core logic next.
- Wire endpoint/UI integration after core logic.
- Validate independent test criteria before moving on.

### Parallel Opportunities

- Setup: T002 and T003 can run in parallel after T001.
- Foundational: T005 and T006 can run in parallel; T004 can proceed concurrently.
- US1: T010 and T011 in parallel; T014 can start after T013.
- US2: T017 and T018 in parallel; T019 and T020 can overlap with clear ownership.
- US3: T023, T024, and T025 in parallel; T027 and T028 can follow T026.
- Polish: T030 and T031 in parallel; T032 after core tests are stable.

---

## Parallel Example: User Story 1

```bash
# Parallel test tasks (US1)
Task: "T010 [US1] Add integration test for successful composed preview response in tests/integration/routes/kit-preview-route.test.ts"
Task: "T011 [US1] Add unit test for full composition of eligible items in tests/unit/visual/compositor.test.ts"

# Parallel implementation opportunities (US1)
Task: "T012 [US1] Implement full composition pipeline for eligible cart items in app/lib/visual/compositor.ts"
Task: "T015 [US1] Implement preview rendering component for composed asset in storefront-widget/src/components/guidance/KitPreviewCard.tsx"
```

## Parallel Example: User Story 2

```bash
# Parallel test tasks (US2)
Task: "T017 [US2] Add unit tests for discipline template selection logic in tests/unit/visual/templates.test.ts"
Task: "T018 [US2] Add integration test for mixed-discipline fallback behavior in tests/integration/routes/kit-preview-route.test.ts"

# Parallel implementation opportunities (US2)
Task: "T019 [US2] Implement discipline-specific slot templates and neutral fallback template in app/lib/visual/templates.ts"
Task: "T022 [US2] Render mixed-context indicator and layout metadata in storefront-widget/src/components/guidance/KitPreviewCard.tsx"
```

## Parallel Example: User Story 3

```bash
# Parallel test tasks (US3)
Task: "T023 [US3] Add integration test for unchanged-cart preview reuse in tests/integration/routes/kit-preview-route.test.ts"
Task: "T025 [US3] Add unit tests for deterministic cache key generation in tests/unit/visual/compositor.test.ts"

# Parallel implementation opportunities (US3)
Task: "T026 [US3] Implement reuse-record lookup and write-through behavior in app/lib/visual/compositor.ts"
Task: "T029 [US3] Add client handling for reused preview metadata in storefront-widget/src/hooks/useStorefrontChat.ts"
```

---

## Implementation Strategy

### MVP First (US1)

1. Complete Phase 1 and Phase 2.
2. Deliver Phase 3 (US1) end-to-end.
3. Validate US1 independent test criteria.
4. Demo/deploy MVP preview capability.

### Incremental Delivery

1. Foundation complete (Phases 1-2).
2. Add US1 (core composed preview).
3. Add US2 (discipline-aware layout behavior).
4. Add US3 (fast deterministic reuse and invalidation).
5. Finish with Phase 6 polish and quickstart validation.

### Parallel Team Strategy

1. Team aligns on foundational contracts (Phase 2).
2. Split by story tracks after foundation:
   - Developer A: US1 endpoint + composition flow.
   - Developer B: US2 template and layout behavior.
   - Developer C: US3 caching/reuse behavior.
3. Consolidate for cross-cutting polish and performance checks.

---

## Notes

- [P] tasks are file-isolated and dependency-safe for parallel execution.
- [USx] labels provide traceability from tasks to user stories.
- Keep commits scoped per task or tightly related task cluster.
- Re-run quickstart scenarios before closing the feature.
