# Tasks: Product Relationship Mapping

**Input**: Design documents from `/specs/004-product-relationship-mapping/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Include unit and integration tests because the constitution requires new business logic and acceptance criteria to be covered by automated tests.

**Organization**: Tasks are grouped by user story so each slice can be implemented and validated independently.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish the schema and feature scaffolding required by all stories.

- [X] T001 Add relationship enums and models to prisma/schema.prisma
- [X] T002 Create the relationship schema migration in prisma/migrations/
- [X] T003 Create the relationship service scaffold and shared types in app/lib/knowledge-graph/relationships.ts

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Build the shared persistence and test surfaces that every story depends on.

**⚠️ CRITICAL**: No user story work should start until this phase is complete.

- [X] T004 Add base relationship persistence helpers and typed selectors to app/lib/db/queries.ts
- [X] T005 Create shared relationship unit test scaffolding in tests/unit/knowledge-graph/relationships.test.ts
- [X] T006 [P] Create shared relationship integration test scaffolding in tests/integration/routes/knowledge-graph-relationships.test.ts

**Checkpoint**: Relationship schema, query helpers, and test harnesses are ready.

---

## Phase 3: User Story 1 - Generate Relationship Suggestions (Priority: P1) 🎯 MVP

**Goal**: Generate candidate product relationships from catalog, taxonomy, collection, embedding, and available purchase-history signals.

**Independent Test**: Trigger catalog sync for a curated product set and confirm that expected complement, upgrade, alternative, conflict, and same-collection candidates are generated with type and strength.

### Tests for User Story 1

- [X] T007 [P] [US1] Add unit tests for candidate generation, directionality, and strength ranking in tests/unit/knowledge-graph/relationships.test.ts
- [X] T008 [P] [US1] Add integration coverage for sync-generated relationship candidates in tests/integration/routes/catalog-sync.test.ts

### Implementation for User Story 1

- [X] T009 [US1] Implement candidate normalization, evidence aggregation, and ranking in app/lib/knowledge-graph/relationships.ts
- [X] T010 [US1] Persist candidate relationships and evidence summaries in app/lib/db/queries.ts
- [X] T011 [US1] Wire incremental relationship generation into app/lib/knowledge-graph/ingestion.ts
- [X] T012 [US1] Invalidate stale generated relationships during product delete or status changes in app/lib/knowledge-graph/ingestion.ts and app/lib/db/queries.ts

**Checkpoint**: User Story 1 is functional when sync creates bounded, ranked relationship candidates without forcing unsupported links.

---

## Phase 4: User Story 2 - Curate Relationship Rules (Priority: P2)

**Goal**: Let merchants review, create, update, reject, and disable relationships from the embedded knowledge-graph admin UI.

**Independent Test**: Open the knowledge-graph admin page, approve one candidate, reject one candidate, and create one merchant-authored relationship, then confirm the stored active graph reflects each decision.

### Tests for User Story 2

- [x] T013 [P] [US2] Add unit tests for override precedence and symmetric pair normalization in tests/unit/knowledge-graph/relationships.test.ts
- [x] T014 [P] [US2] Add integration coverage for merchant relationship review actions in tests/integration/routes/knowledge-graph-relationships.test.ts

### Implementation for User Story 2

- [x] T015 [US2] Add relationship candidate and active-link loader queries to app/lib/db/queries.ts
- [x] T016 [US2] Extend the embedded admin relationship review UI in app/routes/app.knowledge-graph.tsx
- [x] T017 [US2] Implement merchant create, approve, update, reject, and disable actions in app/routes/app.knowledge-graph.tsx
- [x] T018 [US2] Persist merchant overrides and suppression history in app/lib/db/queries.ts
- [x] T019 [US2] Preserve merchant-reviewed decisions across remapping runs in app/lib/knowledge-graph/relationships.ts and app/lib/db/queries.ts

**Checkpoint**: User Story 2 is functional when merchant decisions override automated suggestions and survive later sync/remapping cycles.

---

## Phase 5: User Story 3 - Supply Trusted Relationships to Cart Intelligence (Priority: P3)

**Goal**: Expose an approved relationship view that downstream cart-intelligence consumers can query safely.

**Independent Test**: Request trusted relationships for a product with active complements and conflicts, then verify only approved, valid links are returned in priority order and invalidated links are excluded.

### Tests for User Story 3

- [x] T020 [P] [US3] Add unit tests for approved relationship filtering and ordering in tests/unit/knowledge-graph/relationships.test.ts
- [x] T021 [P] [US3] Add integration coverage for approved relationship reads in tests/integration/routes/knowledge-graph-relationships.test.ts

### Implementation for User Story 3

- [x] T022 [US3] Implement approved relationship read-model queries in app/lib/db/queries.ts
- [x] T023 [US3] Implement downstream retrieval and filtering helpers in app/lib/knowledge-graph/relationships.ts
- [x] T024 [US3] Export trusted relationship accessors for cart-intelligence consumers in app/lib/knowledge-graph/relationships.ts and app/lib/db/queries.ts

**Checkpoint**: User Story 3 is functional when downstream consumers can retrieve only approved active relationships without re-implementing filtering logic.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final hardening, regression coverage, and validation across stories.

- [x] T025 [P] Add webhook invalidation regression coverage in tests/unit/knowledge-graph/ingestion-webhooks.test.ts
- [x] T026 [P] Add product lifecycle regression coverage in tests/integration/routes/product-webhooks.test.ts
- [x] T027 Optimize candidate bounds, deduplication, and invalidation paths in app/lib/knowledge-graph/relationships.ts
- [x] T028 Run the end-to-end verification flow and capture any implementation-specific notes in specs/004-product-relationship-mapping/quickstart.md

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies.
- **Foundational (Phase 2)**: Depends on Setup completion and blocks all story work.
- **User Story 1 (Phase 3)**: Depends on Foundational completion.
- **User Story 2 (Phase 4)**: Depends on User Story 1 candidate generation being available.
- **User Story 3 (Phase 5)**: Depends on User Story 1 persistence/read infrastructure; it can start after US1, even if US2 is still being refined.
- **Polish (Phase 6)**: Depends on the desired user stories being complete.

### User Story Dependency Graph

- **US1 (P1)**: First deliverable and MVP.
- **US2 (P2)**: Builds on US1-generated relationship data for merchant review.
- **US3 (P3)**: Builds on US1-approved relationship persistence and benefits from US2 curation.

### Recommended Completion Order

1. Finish Phase 1 and Phase 2.
2. Deliver US1 as the MVP.
3. Deliver US2 to enable merchant control.
4. Deliver US3 to expose the trusted read surface.
5. Finish polish and regression validation.

### Parallel Opportunities

- T005 and T006 can proceed in parallel after T004.
- T007 and T008 can proceed in parallel within US1.
- T013 and T014 can proceed in parallel within US2.
- T020 and T021 can proceed in parallel within US3.
- T025 and T026 can proceed in parallel during polish.

---

## Parallel Example: User Story 1

```bash
Task: "Add unit tests for candidate generation, directionality, and strength ranking in tests/unit/knowledge-graph/relationships.test.ts"
Task: "Add integration coverage for sync-generated relationship candidates in tests/integration/routes/catalog-sync.test.ts"
```

## Parallel Example: User Story 2

```bash
Task: "Add unit tests for override precedence and symmetric pair normalization in tests/unit/knowledge-graph/relationships.test.ts"
Task: "Add integration coverage for merchant relationship review actions in tests/integration/routes/knowledge-graph-relationships.test.ts"
```

## Parallel Example: User Story 3

```bash
Task: "Add unit tests for approved relationship filtering and ordering in tests/unit/knowledge-graph/relationships.test.ts"
Task: "Add integration coverage for approved relationship reads in tests/integration/routes/knowledge-graph-relationships.test.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup.
2. Complete Phase 2: Foundational.
3. Complete Phase 3: User Story 1.
4. Validate sync-generated relationship candidates against the US1 independent test.

### Incremental Delivery

1. Setup + Foundational create the shared schema, queries, and tests.
2. US1 delivers relationship generation.
3. US2 adds merchant review and durable override behavior.
4. US3 exposes the trusted read surface for downstream cart intelligence.
5. Polish locks in lifecycle regressions and quickstart validation.

### Team Parallelization

1. One developer handles schema and DB query groundwork.
2. One developer handles relationship-engine logic and sync wiring.
3. One developer handles Polaris admin review flows and integration tests after US1 is in place.

---

## Notes

- Every task follows the required checklist format with a task ID and file path.
- `[P]` markers are used only where tasks can proceed independently in different files.
- US1 is the recommended MVP scope.
- Test tasks are included because the constitution and quickstart require automated validation of the new business logic.
