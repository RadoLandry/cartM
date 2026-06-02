# Tasks: Knowledge Graph Editor

**Input**: Design documents from `/specs/021-knowledge-graph-editor/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/, quickstart.md

**Tests**: Test tasks are included to satisfy the project constitution requirement for new business logic coverage.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no blocking dependency)
- **[Story]**: User story label ([US1], [US2], [US3])
- Every task includes an exact file path

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create feature scaffolding and route/component boundaries for the editor.

- [x] T001 Create knowledge graph editor service entry scaffold in app/lib/knowledge-graph/editor.ts
- [x] T002 [P] Create editor domain types and DTO definitions in app/lib/knowledge-graph/editor.types.ts
- [x] T003 [P] Create admin route loader/action scaffold for editor page in app/routes/app.knowledge-graph.tsx
- [x] T004 [P] Create editor UI shell component scaffold in app/components/admin/KnowledgeGraphEditorShell.tsx

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core persistence, validation, conflict, and audit infrastructure required before user story work.

**CRITICAL**: No user story implementation starts until this phase is complete.

- [x] T005 Extend Prisma models for overrides, size mappings, bulk operations, and audit trail in prisma/schema.prisma
- [x] T006 Create migration for editor governance tables and indexes in prisma/migrations/20260602_knowledge_graph_editor/migration.sql
- [x] T007 [P] Implement repository query primitives for editor entities in app/lib/db/queries.ts
- [x] T008 [P] Implement Zod input schemas and validation error mapping in app/lib/knowledge-graph/editor.validation.ts
- [x] T009 Implement optimistic concurrency and stale-write conflict helpers in app/lib/knowledge-graph/editor.concurrency.ts
- [x] T010 [P] Implement audit log writer utility for editor mutations in app/lib/knowledge-graph/editor.audit.ts
- [x] T011 Implement shared propagation token and status helper utilities in app/lib/knowledge-graph/editor.propagation.ts
- [x] T012 Wire foundational loader/action error boundaries and authorization checks in app/routes/app.knowledge-graph.tsx

**Checkpoint**: Foundation complete. User story phases can begin.

---

## Phase 3: User Story 1 - Review and Correct Product Intelligence (Priority: P1) MVP

**Goal**: Let admins review low-confidence items and correct classifications/relationships with auditable, conflict-safe saves.

**Independent Test**: Open the review queue, apply one classification override and one relationship edit, and verify reviewed state, revision updates, and audit records.

### Implementation for User Story 1

- [x] T013 [P] [US1] Implement confidence-prioritized review queue query in app/lib/knowledge-graph/editor.ts
- [x] T014 [P] [US1] Implement classification override upsert flow with precedence metadata in app/lib/knowledge-graph/taxonomy.ts
- [x] T015 [P] [US1] Implement relationship rule upsert/remove flow with revision control in app/lib/knowledge-graph/relationships.ts
- [ ] T016 [US1] Implement review-status transition handler (pending to reviewed/reflagged) in app/lib/knowledge-graph/editor.ts
- [ ] T017 [US1] Implement admin action handlers for queue, override, and relationship mutations in app/routes/app.knowledge-graph.tsx
- [ ] T018 [US1] Implement Polaris review queue list and filters in app/components/admin/KnowledgeGraphReviewQueue.tsx
- [ ] T019 [US1] Implement Polaris override/relationship editor panels in app/components/admin/KnowledgeGraphReviewEditor.tsx
- [ ] T020 [US1] Integrate editor shell with review queue and mutation actions in app/components/admin/KnowledgeGraphEditorShell.tsx
- [ ] T021 [P] [US1] Add unit tests for queue ordering and override precedence in tests/unit/knowledge-graph-editor/review-queue.test.ts
- [ ] T022 [P] [US1] Add integration tests for classification/relationship mutation flows in tests/integration/knowledge-graph-editor/review-mutations.test.ts

**Checkpoint**: US1 delivers a fully usable and testable review-and-correct workflow.

---

## Phase 4: User Story 2 - Manage Size and Fit Mappings Safely (Priority: P2)

**Goal**: Let admins define/update size mappings with strict validation and clear rejection feedback for contradictory rules.

**Independent Test**: Create/update valid size mappings and verify they persist; submit contradictory mappings and verify server-side rejection with structured field errors.

### Implementation for User Story 2

- [ ] T023 [P] [US2] Implement size mapping validation rules and contradiction detection in app/lib/knowledge-graph/sizing.ts
- [ ] T024 [P] [US2] Implement size mapping upsert/deactivate flows with revision checks in app/lib/knowledge-graph/sizing.ts
- [ ] T025 [US2] Implement route actions for size mapping CRUD and conflict responses in app/routes/app.knowledge-graph.tsx
- [ ] T026 [US2] Implement Polaris size mapping management table and editor form in app/components/admin/KnowledgeGraphSizeMappings.tsx
- [ ] T027 [US2] Integrate size mapping panel state and mutation feedback in app/components/admin/KnowledgeGraphEditorShell.tsx
- [ ] T028 [P] [US2] Add unit tests for mapping validation and contradiction rejection in tests/unit/knowledge-graph-editor/size-mapping-validation.test.ts
- [ ] T029 [P] [US2] Add integration tests for size mapping CRUD and rejection semantics in tests/integration/knowledge-graph-editor/size-mapping-actions.test.ts

**Checkpoint**: US2 adds safe and independently testable size governance without regressing US1.

---

## Phase 5: User Story 3 - Apply Bulk Governance Updates Efficiently (Priority: P3)

**Goal**: Enable previewable, confirmable bulk operations with per-record outcomes and cancellation safety.

**Independent Test**: Build a filtered selection, preview and confirm a bulk update, verify per-record outcomes; cancel a previewed operation and verify no persisted changes.

### Implementation for User Story 3

- [ ] T030 [P] [US3] Implement bulk target selection resolver with deterministic filter snapshots in app/lib/knowledge-graph/editor.bulk.ts
- [ ] T031 [P] [US3] Implement preview-hash generation and confirmation guard logic in app/lib/knowledge-graph/editor.bulk.ts
- [ ] T032 [US3] Implement bulk execution orchestrator with per-record result aggregation in app/lib/knowledge-graph/editor.bulk.ts
- [ ] T033 [US3] Implement bulk operation route actions for preview, confirm, cancel, and status reads in app/routes/app.knowledge-graph.tsx
- [ ] T034 [US3] Implement Polaris bulk preview/confirm/cancel UI with result summaries in app/components/admin/KnowledgeGraphBulkOperations.tsx
- [ ] T035 [US3] Integrate bulk operations panel into editor shell and navigation state in app/components/admin/KnowledgeGraphEditorShell.tsx
- [ ] T036 [P] [US3] Add unit tests for preview-hash and aggregate status transitions in tests/unit/knowledge-graph-editor/bulk-operations.test.ts
- [ ] T037 [P] [US3] Add integration tests for confirm/cancel/no-op guarantees in tests/integration/knowledge-graph-editor/bulk-actions.test.ts

**Checkpoint**: US3 provides independently testable bulk governance with explicit safety controls.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final hardening, observability, propagation checks, and documentation alignment across stories.

- [ ] T038 [P] Implement change-history viewer query and pagination wiring in app/lib/knowledge-graph/editor.ts
- [ ] T039 Implement Polaris audit trail panel in app/components/admin/KnowledgeGraphAuditTrail.tsx
- [ ] T040 Implement propagation status metrics and retry-flag logging in app/lib/knowledge-graph/editor.propagation.ts
- [ ] T041 [P] Add integration test for propagation token and <1 minute visibility contract in tests/integration/knowledge-graph-editor/propagation-contract.test.ts
- [ ] T042 [P] Add integration test for stale-write conflict handling in tests/integration/knowledge-graph-editor/concurrency-conflict.test.ts
- [ ] T043 Run quickstart scenario validation and record outcomes in specs/021-knowledge-graph-editor/quickstart.md
- [ ] T044 Validate contract/design consistency notes in specs/021-knowledge-graph-editor/contracts/knowledge-graph-editor-api-contract.md

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: Can start immediately.
- **Phase 2 (Foundational)**: Depends on Phase 1 and blocks all user stories.
- **Phase 3 (US1)**: Starts after Phase 2 and establishes the MVP.
- **Phase 4 (US2)**: Starts after Phase 2; functionally independent from US1 except shared foundations.
- **Phase 5 (US3)**: Starts after Phase 2; functionally independent from US1/US2 except shared foundations.
- **Phase 6 (Polish)**: Starts after targeted user stories are complete.

### User Story Dependencies

- **US1 (P1)**: Depends only on foundational phase.
- **US2 (P2)**: Depends only on foundational phase.
- **US3 (P3)**: Depends only on foundational phase.

### Within Each User Story

- Services and domain rules before route actions.
- Route actions before UI integration.
- Core implementation before story-specific tests complete.

### Parallel Opportunities

- **Setup**: T002, T003, and T004 can run in parallel.
- **Foundational**: T007, T008, and T010 can run in parallel after T005/T006 begin.
- **US1**: T013, T014, and T015 can run in parallel.
- **US2**: T023 and T024 can run in parallel.
- **US3**: T030 and T031 can run in parallel.
- **Polish**: T041 and T042 can run in parallel.

---

## Parallel Example: User Story 1

```bash
Task: "T013 [US1] Implement confidence-prioritized review queue query in app/lib/knowledge-graph/editor.ts"
Task: "T014 [US1] Implement classification override upsert flow in app/lib/knowledge-graph/taxonomy.ts"
Task: "T015 [US1] Implement relationship rule upsert/remove flow in app/lib/knowledge-graph/relationships.ts"
```

## Parallel Example: User Story 2

```bash
Task: "T023 [US2] Implement size mapping validation rules in app/lib/knowledge-graph/sizing.ts"
Task: "T024 [US2] Implement size mapping upsert/deactivate flows in app/lib/knowledge-graph/sizing.ts"
```

## Parallel Example: User Story 3

```bash
Task: "T030 [US3] Implement bulk target selection resolver in app/lib/knowledge-graph/editor.bulk.ts"
Task: "T031 [US3] Implement preview-hash and confirmation guard logic in app/lib/knowledge-graph/editor.bulk.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 and Phase 2.
2. Complete Phase 3 (US1).
3. Validate the independent US1 test criteria.
4. Demo/deploy MVP slice if stable.

### Incremental Delivery

1. Deliver US1 for review/correction core value.
2. Deliver US2 for safe size mapping governance.
3. Deliver US3 for operational efficiency at scale.
4. Finish with Phase 6 propagation and audit hardening.

### Parallel Team Strategy

1. Team aligns on Phase 1/2 foundations.
2. After foundations:
   - Developer A: US1
   - Developer B: US2
   - Developer C: US3
3. Rejoin for cross-cutting polish tasks.

---

## Notes

- [P] tasks are parallelizable when dependencies are met.
- [USx] labels preserve traceability to specification priorities.
- Keep admin UI fully Polaris/App Bridge compliant.
- Ensure all mutations pass server-side validation and emit audit trail entries.
