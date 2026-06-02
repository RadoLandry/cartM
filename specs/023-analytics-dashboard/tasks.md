# Tasks: Analytics Dashboard

**Input**: Design documents from /specs/023-analytics-dashboard/
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/analytics-dashboard.openapi.yaml, quickstart.md

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Prepare analytics feature scaffolding and shared conventions.

- [x] T001 Create analytics domain module index in app/lib/analytics/index.ts
- [x] T002 [P] Create KPI definition constants scaffold in app/lib/analytics/definitions.ts
- [x] T003 [P] Create analytics validation schema scaffold in app/lib/analytics/schemas.ts
- [x] T004 [P] Create analytics unit test folder bootstrap in tests/unit/analytics/.gitkeep
- [x] T005 [P] Create analytics integration test folder bootstrap in tests/integration/analytics/.gitkeep

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Build core data and service foundations required by all user stories.

**CRITICAL**: No user story work begins until this phase is complete.

- [x] T006 Add analytics entities and enums to Prisma schema in prisma/schema.prisma
- [x] T007 Generate and apply migration for analytics entities from prisma/schema.prisma
- [x] T008 [P] Implement idempotent analytics event write helpers in app/lib/db/queries.ts
- [x] T009 [P] Implement KPI snapshot read/write helpers in app/lib/db/queries.ts
- [x] T010 [P] Implement attribution record read/write helpers in app/lib/db/queries.ts
- [x] T011 [P] Implement export report persistence helpers in app/lib/db/queries.ts
- [x] T012 Implement date-range and customer-type filter parsing in app/lib/analytics/schemas.ts
- [x] T013 Implement baseline period resolver and guardrails in app/lib/analytics/aggregation.ts
- [x] T014 Implement metric definition registry and formula metadata in app/lib/analytics/definitions.ts
- [x] T015 Implement shared analytics response mapper in app/lib/analytics/serializers.ts
- [x] T016 Add analytics route registrations to app/routes.ts

**Checkpoint**: Foundation is complete; user stories can proceed.

---

## Phase 3: User Story 1 - Track Business Impact (Priority: P1) 🎯 MVP

**Goal**: Deliver core KPI dashboard values with period-over-period comparison and empty-state handling.

**Independent Test**: Open analytics dashboard with a seeded period and verify core KPI cards, baseline deltas, and no-data states render correctly.

### Tests for User Story 1

- [x] T017 [P] [US1] Add KPI aggregation unit tests in tests/unit/analytics/aggregation-core-kpis.test.ts
- [x] T018 [P] [US1] Add baseline comparison unit tests in tests/unit/analytics/baseline-comparison.test.ts
- [x] T019 [P] [US1] Add dashboard payload integration tests in tests/integration/analytics/dashboard-core.test.ts

### Implementation for User Story 1

- [x] T020 [US1] Implement core KPI aggregation service in app/lib/analytics/aggregation.ts
- [x] T021 [US1] Implement KPI freshness evaluation service in app/lib/analytics/freshness.ts
- [x] T022 [US1] Implement dashboard loader endpoint for core KPIs in app/routes/app.analytics.tsx
- [x] T023 [US1] Build Polaris KPI summary section in app/components/admin/analytics/KpiSummarySection.tsx
- [x] T024 [US1] Build global analytics filter bar in app/components/admin/analytics/AnalyticsFilterBar.tsx
- [x] T025 [US1] Add empty and partial-data states for KPI views in app/components/admin/analytics/KpiEmptyState.tsx
- [x] T026 [US1] Compose analytics route page with core KPI modules in app/routes/app.analytics.tsx

**Checkpoint**: User Story 1 is independently functional and testable.

---

## Phase 4: User Story 2 - Understand Recommendation Performance (Priority: P2)

**Goal**: Deliver recommendation performance analytics and ordered category insights with funnel linkage.

**Independent Test**: Seed recommendation events and verify category performance, interaction rates, and funnel progression metrics in the analytics route.

### Tests for User Story 2

- [x] T027 [P] [US2] Add recommendation attribution unit tests in tests/unit/analytics/recommendation-attribution.test.ts
- [x] T028 [P] [US2] Add recommendation ranking unit tests in tests/unit/analytics/recommendation-ranking.test.ts
- [x] T029 [P] [US2] Add recommendation performance integration tests in tests/integration/analytics/recommendation-performance.test.ts

### Implementation for User Story 2

- [x] T030 [US2] Implement recommendation performance aggregator in app/lib/analytics/recommendations.ts
- [x] T031 [US2] Implement recommendation funnel stage computations in app/lib/analytics/funnel.ts
- [x] T032 [US2] Extend dashboard loader with recommendation payload in app/routes/app.analytics.tsx
- [x] T033 [US2] Build recommendation performance table section in app/components/admin/analytics/RecommendationPerformanceSection.tsx
- [x] T034 [US2] Build funnel visualization section in app/components/admin/analytics/FunnelSection.tsx
- [x] T035 [US2] Add metric definitions panel for recommendation KPIs in app/components/admin/analytics/MetricDefinitionPanel.tsx

**Checkpoint**: User Stories 1 and 2 are independently functional.

---

## Phase 5: User Story 3 - Analyze Conversation and Bundle Outcomes (Priority: P3)

**Goal**: Deliver conversation and bundle analytics sections with reliable no-data behavior and period comparisons.

**Independent Test**: Seed chat and bundle events, then verify session outcomes, bundle completion metrics, and period-over-period values render correctly.

### Tests for User Story 3

- [x] T036 [P] [US3] Add chat outcome aggregation unit tests in tests/unit/analytics/chat-outcomes.test.ts
- [x] T037 [P] [US3] Add bundle outcome aggregation unit tests in tests/unit/analytics/bundle-outcomes.test.ts
- [x] T038 [P] [US3] Add chat and bundle integration tests in tests/integration/analytics/chat-bundle-performance.test.ts

### Implementation for User Story 3

- [x] T039 [US3] Implement chat outcome aggregator in app/lib/analytics/chat.ts
- [x] T040 [US3] Implement bundle outcome aggregator in app/lib/analytics/bundles.ts
- [x] T041 [US3] Extend dashboard loader with chat and bundle payloads in app/routes/app.analytics.tsx
- [x] T042 [US3] Build chat outcomes section in app/components/admin/analytics/ChatPerformanceSection.tsx
- [x] T043 [US3] Build bundle outcomes section in app/components/admin/analytics/BundlePerformanceSection.tsx
- [x] T044 [US3] Add no-data safeguards for rate calculations in app/lib/analytics/aggregation.ts

**Checkpoint**: All user stories are independently functional.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Add export flow, contract alignment, reconciliation checks, and final hardening.

- [x] T045 [P] Implement analytics export creation action in app/routes/api.analytics.export.tsx
- [x] T046 [P] Implement synchronous CSV export generation in app/lib/analytics/export.ts
- [x] T047 Implement asynchronous export fallback and status transitions in app/lib/analytics/export-jobs.ts
- [x] T048 Implement export status endpoint behavior in app/routes/api.analytics.export.$exportId.tsx
- [x] T049 [P] Add export integration tests in tests/integration/analytics/export-flow.test.ts
- [x] T050 [P] Add contract response conformance tests in tests/integration/analytics/analytics-contract.test.ts
- [x] T051 Add sampled reconciliation checks against source events in tests/integration/analytics/reconciliation.test.ts
- [x] T052 Add route-level performance instrumentation for dashboard loaders in app/routes/app.analytics.tsx
- [x] T053 Update analytics quick validation checklist in specs/023-analytics-dashboard/quickstart.md

---

## Dependencies & Execution Order

### Phase Dependencies

- Setup (Phase 1): No dependencies.
- Foundational (Phase 2): Depends on Setup completion and blocks all user stories.
- User Story phases (Phases 3-5): Depend on Foundational completion.
- Polish (Phase 6): Depends on completion of all user story phases.

### User Story Dependencies

- User Story 1 (P1): Starts after Foundational; no dependency on other stories.
- User Story 2 (P2): Starts after Foundational; depends on shared KPI/filter payload shape from US1 route loader.
- User Story 3 (P3): Starts after Foundational; depends on shared filtering and baseline services from US1.

### Within Each User Story

- Tests are created before implementation tasks and should fail first.
- Aggregation services precede route payload integration.
- Route payload integration precedes UI section implementation.
- Empty/no-data safeguards are finalized before checkpoint validation.

## Parallel Opportunities

- Setup: T002, T003, T004, T005 can run in parallel after T001.
- Foundational: T008-T011 can run in parallel after T006-T007.
- US1: T017-T019 can run in parallel; T023-T025 can run in parallel after T022.
- US2: T027-T029 can run in parallel; T033-T035 can run in parallel after T032.
- US3: T036-T038 can run in parallel; T042-T043 can run in parallel after T041.
- Polish: T045, T046, T049, T050 can run in parallel once user stories are complete.

## Parallel Example: User Story 1

- Run in parallel: T017 in tests/unit/analytics/aggregation-core-kpis.test.ts, T018 in tests/unit/analytics/baseline-comparison.test.ts, T019 in tests/integration/analytics/dashboard-core.test.ts
- Run in parallel after loader integration: T023 in app/components/admin/analytics/KpiSummarySection.tsx, T024 in app/components/admin/analytics/AnalyticsFilterBar.tsx, T025 in app/components/admin/analytics/KpiEmptyState.tsx

## Parallel Example: User Story 2

- Run in parallel: T027 in tests/unit/analytics/recommendation-attribution.test.ts, T028 in tests/unit/analytics/recommendation-ranking.test.ts, T029 in tests/integration/analytics/recommendation-performance.test.ts
- Run in parallel after T032: T033 in app/components/admin/analytics/RecommendationPerformanceSection.tsx, T034 in app/components/admin/analytics/FunnelSection.tsx, T035 in app/components/admin/analytics/MetricDefinitionPanel.tsx

## Parallel Example: User Story 3

- Run in parallel: T036 in tests/unit/analytics/chat-outcomes.test.ts, T037 in tests/unit/analytics/bundle-outcomes.test.ts, T038 in tests/integration/analytics/chat-bundle-performance.test.ts
- Run in parallel after T041: T042 in app/components/admin/analytics/ChatPerformanceSection.tsx and T043 in app/components/admin/analytics/BundlePerformanceSection.tsx

## Implementation Strategy

### MVP First (User Story 1)

1. Complete Phase 1 and Phase 2.
2. Complete Phase 3 (US1) and validate independent KPI dashboard behavior.
3. Demo/deploy MVP analytics impact view.

### Incremental Delivery

1. Add US2 recommendation and funnel analytics after US1 stability.
2. Add US3 chat and bundle analytics after US2 stability.
3. Complete Phase 6 export, contract, reconciliation, and performance hardening.

### Team Parallelization

1. Team aligns on Phase 1 and Phase 2.
2. After Foundational completion:
   - Engineer A: US1 components and route composition.
   - Engineer B: US2 recommendation/funnel services and tests.
   - Engineer C: US3 chat/bundle services and tests.
3. Merge in story order with contract tests and reconciliation checks as final gate.

## Notes

- [P] tasks indicate different files and no blocking dependency on incomplete tasks.
- [USx] label maps each task to a specific user story for traceability.
- Every user story includes independent test criteria and checkpoint.
- Keep GraphQL field usage minimal and all boundary input validation explicit per constitution gates.
