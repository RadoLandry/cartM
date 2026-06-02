# Tasks: Bundle Rule Manager

**Input**: Design documents from `/specs/022-bundle-rule-manager/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Prepare feature scaffolding and route/component structure.

- [X] T001 Create bundle route scaffolding in app/routes/app.bundles.tsx
- [X] T002 [P] Create admin list/panel component shell in app/components/admin/BundleRuleList.tsx
- [X] T003 [P] Create admin form component shell in app/components/admin/BundleRuleForm.tsx
- [X] T004 [P] Create preview panel component shell in app/components/admin/BundleRulePreviewPanel.tsx

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core persistence and deterministic engine required by all user stories.

- [X] T005 Add bundle lifecycle enums and models in prisma/schema.prisma
- [X] T006 Generate and commit Prisma migration for bundle rule models in prisma/migrations/
- [X] T007 Add base bundle rule CRUD query helpers in app/lib/db/queries.ts
- [X] T008 Add deterministic evaluator core and tie-break policy in app/lib/cart-intelligence/bundles.ts
- [X] T009 Add shared route/action payload schemas for bundle operations in app/routes/app.bundles.tsx
- [X] T010 Add audit record persistence helper in app/lib/db/queries.ts

**Checkpoint**: Foundation complete. User story work can proceed.

---

## Phase 3: User Story 1 - Create And Activate Bundle Rules (Priority: P1) 🎯 MVP

**Goal**: Enable merchants to create valid rules and activate them safely.

**Independent Test**: Merchant can create a new rule with required items and discount, activate it, and see it listed as ACTIVE in admin.

### Implementation for User Story 1

- [X] T011 [US1] Implement create-rule action handler with schema validation in app/routes/app.bundles.tsx
- [X] T012 [US1] Implement update-rule action handler with non-destructive field updates in app/routes/app.bundles.tsx
- [X] T013 [P] [US1] Implement create/update persistence operations in app/lib/db/queries.ts
- [X] T014 [US1] Implement activation guard validation (required requirements, discount validity, schedule checks) in app/lib/cart-intelligence/bundles.ts
- [X] T015 [US1] Implement status transition action for DRAFT->ACTIVE in app/routes/app.bundles.tsx
- [X] T016 [P] [US1] Build rule creation/edit form fields and validation display in app/components/admin/BundleRuleForm.tsx
- [X] T017 [US1] Wire admin route loader data into list + form shells in app/routes/app.bundles.tsx
- [X] T018 [US1] Render active/draft rule state and validation feedback in app/components/admin/BundleRuleList.tsx

**Checkpoint**: User Story 1 is independently functional and demoable.

---

## Phase 4: User Story 2 - Preview And Validate Bundle Behavior (Priority: P2)

**Goal**: Let merchants preview qualification outcomes using live evaluator logic before publishing.

**Independent Test**: Merchant can run preview on sample cart lines and receives deterministic qualification result with missing requirements and discount outcome.

### Implementation for User Story 2

- [ ] T019 [US2] Implement preview action endpoint using shared evaluator in app/routes/app.bundles.tsx
- [ ] T020 [US2] Implement preview cart-line normalization and catalog existence checks in app/lib/cart-intelligence/bundles.ts
- [ ] T021 [US2] Implement overlap candidate reporting with tie-break reasons in app/lib/cart-intelligence/bundles.ts
- [ ] T022 [P] [US2] Render preview request builder UI in app/components/admin/BundleRulePreviewPanel.tsx
- [ ] T023 [US2] Render qualification result, missing requirements, and decision trace in app/components/admin/BundleRulePreviewPanel.tsx
- [ ] T024 [US2] Add preview result integration section in route view composition in app/routes/app.bundles.tsx
- [ ] T025 [P] [US2] Add compact active-rule projection helper for downstream consumers in app/lib/cart-intelligence/recommendations.ts

**Checkpoint**: User Story 2 is independently functional and testable.

---

## Phase 5: User Story 3 - Maintain Rule Lifecycle Safely (Priority: P3)

**Goal**: Support pause, archive, and duplicate workflows with auditability and safe state transitions.

**Independent Test**: Merchant can pause/archive/duplicate a rule and verify expected visibility, status, and audit continuity without affecting unrelated rules.

### Implementation for User Story 3

- [ ] T026 [US3] Implement transition actions for ACTIVE->PAUSED and PAUSED->ACTIVE in app/routes/app.bundles.tsx
- [ ] T027 [US3] Implement archive action and archived-filter behavior in app/routes/app.bundles.tsx
- [ ] T028 [P] [US3] Implement duplicate-rule persistence operation with draft reset in app/lib/db/queries.ts
- [ ] T029 [US3] Implement immutable audit event creation for lifecycle actions in app/lib/db/queries.ts
- [ ] T030 [P] [US3] Render lifecycle action controls (pause/archive/duplicate) in app/components/admin/BundleRuleList.tsx
- [ ] T031 [US3] Implement lifecycle transition guards and failure semantics in app/lib/cart-intelligence/bundles.ts
- [ ] T032 [US3] Add archived/default filtering and search handling in route loader in app/routes/app.bundles.tsx

**Checkpoint**: User Story 3 is independently functional and testable.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final hardening across stories.

- [ ] T033 Add projection versioning + fallback behavior checks in app/lib/cart-intelligence/recommendations.ts
- [ ] T034 Update feature quickstart verification notes in specs/022-bundle-rule-manager/quickstart.md
- [ ] T035 Run full feature validation checklist and mark outcomes in specs/022-bundle-rule-manager/checklists/requirements.md

---

## Dependencies & Execution Order

### Phase Dependencies

- Phase 1 (Setup): can start immediately.
- Phase 2 (Foundational): depends on Phase 1 and blocks all user stories.
- Phase 3 (US1): depends on Phase 2.
- Phase 4 (US2): depends on Phase 2 and can run in parallel with Phase 3 after foundation is complete.
- Phase 5 (US3): depends on Phase 2 and can run in parallel with Phases 3-4 after foundation is complete.
- Phase 6 (Polish): depends on completion of desired user stories.

### User Story Dependencies

- US1 (P1): no dependency on other stories once foundational work is complete.
- US2 (P2): no dependency on US1 outcomes; uses the same foundational evaluator and route framework.
- US3 (P3): no dependency on US1/US2 outcomes; uses foundational lifecycle and persistence model.

### Within Each User Story

- Action handlers depend on available persistence and evaluator helpers.
- UI wiring depends on route loader/action payloads.
- Guard logic should be complete before final lifecycle activation in that story.

### Parallel Opportunities

- Setup tasks T002-T004 can run in parallel.
- Foundational tasks T007 and T008 can run in parallel after schema + migration baseline (T005-T006).
- US1 UI work (T016) can run in parallel with backend persistence updates (T013-T015).
- US2 preview UI (T022-T023) can run in parallel with overlap engine work (T021).
- US3 lifecycle UI (T030) can run in parallel with duplicate persistence work (T028).

---

## Parallel Example: User Story 1

```bash
# Parallel backend + UI stream after foundational phase:
Task T013: Implement create/update persistence operations in app/lib/db/queries.ts
Task T016: Build rule creation/edit form fields and validation display in app/components/admin/BundleRuleForm.tsx

# Follow with integration wiring:
Task T017: Wire admin route loader data into list + form shells in app/routes/app.bundles.tsx
```

## Parallel Example: User Story 2

```bash
# Parallel evaluator + UI preview stream:
Task T021: Implement overlap candidate reporting in app/lib/cart-intelligence/bundles.ts
Task T022: Render preview request builder UI in app/components/admin/BundleRulePreviewPanel.tsx
```

## Parallel Example: User Story 3

```bash
# Parallel lifecycle logic + UI controls:
Task T028: Implement duplicate-rule persistence operation in app/lib/db/queries.ts
Task T030: Render lifecycle action controls in app/components/admin/BundleRuleList.tsx
```

---

## Implementation Strategy

### MVP First (US1)

1. Complete Phase 1 and Phase 2.
2. Deliver Phase 3 (US1) and validate merchant rule creation + activation.
3. Demo/deploy MVP behavior.

### Incremental Delivery

1. Add US2 preview and deterministic diagnostics.
2. Add US3 lifecycle governance and duplication.
3. Finish with cross-cutting polish and validation.

### Team Parallelization

1. Pair on schema + evaluator foundation.
2. Split by story after foundation:
   - Engineer A: US1 create/activate path
   - Engineer B: US2 preview path
   - Engineer C: US3 lifecycle path
3. Converge for integration and final validation.

---

## Notes

- All tasks follow required checklist format: `- [ ] T### [P?] [US?] Description with file path`.
- Story labels are used only in user-story phases.
- [P] markers denote file-level parallelization opportunities.
