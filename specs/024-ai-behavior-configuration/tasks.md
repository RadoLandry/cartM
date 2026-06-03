# Tasks: AI Behavior Configuration

**Input**: Design documents from /specs/024-ai-behavior-configuration/
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/ai-behavior-configuration.openapi.yaml, quickstart.md

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Prepare feature scaffolding and shared module boundaries.

- [x] T001 Create AI behavior admin component directory in app/components/admin/ai-behavior/.gitkeep
- [x] T002 [P] Create AI behavior unit test directory in tests/unit/ai/.gitkeep
- [x] T003 [P] Create AI behavior integration test directory in tests/integration/ai-behavior/.gitkeep
- [x] T004 Add app navigation entry for settings route in app/routes/app.tsx
- [x] T005 Create feature constants scaffold for behavior defaults in app/lib/ai/behavior-config.ts

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Build persistence, contracts, and shared runtime plumbing required by all user stories.

**CRITICAL**: No user story implementation begins until this phase is complete.

- [x] T006 Add AI behavior draft/version/audit/preview models and enums in prisma/schema.prisma
- [x] T007 Generate and apply Prisma migration for AI behavior entities in prisma/migrations/
- [x] T008 [P] Add AI behavior select/update helpers in app/lib/db/queries.ts
- [x] T009 [P] Add AI behavior publish transaction helper in app/lib/db/queries.ts
- [x] T010 [P] Add AI behavior rollback transaction helper in app/lib/db/queries.ts
- [x] T011 [P] Add AI behavior audit write helpers in app/lib/db/queries.ts
- [x] T012 [P] Add active behavior version lookup helper with fallback in app/lib/db/queries.ts
- [x] T013 Add behavior config request/response schemas to app/lib/ai/schemas.ts
- [x] T014 Add preview request/response schemas to app/lib/ai/schemas.ts
- [x] T015 Add publish/rollback request schemas to app/lib/ai/schemas.ts
- [x] T016 Add prompt budget and starter constraints utilities in app/lib/ai/behavior-config.ts
- [x] T017 Add behavior config API route scaffold in app/routes/api.ai.behavior.config.tsx
- [x] T018 Add behavior preview API route scaffold in app/routes/api.ai.behavior.preview.tsx
- [x] T019 Wire route exports for behavior APIs in app/routes.ts

**Checkpoint**: Foundation complete; user stories can proceed.

---

## Phase 3: User Story 1 - Set Safe AI Policy (Priority: P1) 🎯 MVP

**Goal**: Enable admins to configure and save safety-centered behavior policy that reliably drives storefront assistant behavior.

**Independent Test**: Save policy settings in admin and confirm new conversations apply safety-priority behavior with protected fallback on invalid input.

### Tests for User Story 1

- [x] T020 [P] [US1] Add behavior policy schema validation tests in tests/unit/ai/behavior-policy-schema.test.ts
- [x] T021 [P] [US1] Add safety-precedence prompt composition tests in tests/unit/ai/prompt-safety-precedence.test.ts
- [x] T022 [P] [US1] Add config API validation integration tests in tests/integration/ai-behavior/config-validation.test.ts
- [x] T023 [P] [US1] Add fallback-to-last-published integration tests in tests/integration/ai-behavior/fallback-runtime.test.ts

### Implementation for User Story 1

- [x] T024 [US1] Implement settings loader/action for safety policy controls in app/routes/app.settings.tsx
- [x] T025 [US1] Implement safety priority UI section in app/components/admin/ai-behavior/SafetyPolicySection.tsx
- [x] T026 [US1] Implement draft save and optimistic concurrency handling in app/routes/api.ai.behavior.config.tsx
- [x] T027 [US1] Implement draft validation and policy conflict resolution in app/lib/ai/behavior-config.ts
- [x] T028 [US1] Integrate active behavior resolution into prompt builder in app/lib/ai/prompts.ts
- [x] T029 [US1] Integrate active behavior resolution into chat runtime in app/lib/ai/storefront-chat.ts
- [x] T030 [US1] Implement runtime fallback to last valid published behavior in app/lib/ai/storefront-chat.ts
- [x] T031 [US1] Write draft-save audit entries for policy changes in app/lib/db/queries.ts

**Checkpoint**: User Story 1 is independently functional and testable.

---

## Phase 4: User Story 2 - Tune Tone and Commercial Aggressiveness (Priority: P2)

**Goal**: Allow merchants to tune tone/aggressiveness and conversation starters, then see those settings reflected in new conversations.

**Independent Test**: Update tone/aggressiveness/starters and verify chat outputs and bootstrap payloads reflect the chosen profile.

### Tests for User Story 2

- [ ] T032 [P] [US2] Add tone rendering prompt tests in tests/unit/ai/prompt-tone-profile.test.ts
- [ ] T033 [P] [US2] Add aggressiveness-level behavior tests in tests/unit/ai/prompt-aggressiveness.test.ts
- [ ] T034 [P] [US2] Add conversation starter constraints tests in tests/unit/ai/conversation-starters.test.ts
- [ ] T035 [P] [US2] Add bootstrap payload starter integration tests in tests/integration/ai-behavior/bootstrap-starters.test.ts

### Implementation for User Story 2

- [ ] T036 [US2] Implement tone and aggressiveness UI controls in app/components/admin/ai-behavior/StyleControlsSection.tsx
- [ ] T037 [US2] Implement custom guidance and starter management UI in app/components/admin/ai-behavior/GuidanceSection.tsx
- [ ] T038 [US2] Persist tone/aggressiveness/custom guidance fields in config API route app/routes/api.ai.behavior.config.tsx
- [ ] T039 [US2] Persist and normalize conversation starters in app/lib/ai/behavior-config.ts
- [ ] T040 [US2] Apply tone/aggressiveness/custom guidance composition rules in app/lib/ai/prompts.ts
- [ ] T041 [US2] Extend chat bootstrap schema with conversation starters in app/lib/ai/schemas.ts
- [ ] T042 [US2] Return active starters in bootstrap route app/routes/api.app-proxy.chat-bootstrap.tsx
- [ ] T043 [US2] Add config metadata panel in settings page app/routes/app.settings.tsx

**Checkpoint**: User Stories 1 and 2 are independently functional.

---

## Phase 5: User Story 3 - Validate and Publish Behavior Changes (Priority: P3)

**Goal**: Provide preview, publish, and rollback lifecycle so merchants can safely validate and deploy behavior updates.

**Independent Test**: Run preview on a draft, publish it, confirm activation, then rollback to a previous version and confirm activation and audit trace.

### Tests for User Story 3

- [ ] T044 [P] [US3] Add preview response contract tests in tests/integration/ai-behavior/preview-contract.test.ts
- [ ] T045 [P] [US3] Add publish lifecycle transaction tests in tests/integration/ai-behavior/publish-lifecycle.test.ts
- [ ] T046 [P] [US3] Add rollback lifecycle transaction tests in tests/integration/ai-behavior/rollback-lifecycle.test.ts
- [ ] T047 [P] [US3] Add audit snapshot integrity tests in tests/unit/ai/audit-snapshots.test.ts

### Implementation for User Story 3

- [ ] T048 [US3] Implement preview endpoint request handling in app/routes/api.ai.behavior.preview.tsx
- [ ] T049 [US3] Implement preview scenario runner and policy checks in app/lib/ai/behavior-preview.ts
- [ ] T050 [US3] Implement publish endpoint and active-version swap in app/routes/api.ai.behavior.config.tsx
- [ ] T051 [US3] Implement rollback endpoint and version recreation in app/routes/api.ai.behavior.config.tsx
- [ ] T052 [US3] Implement version history retrieval for settings page in app/lib/db/queries.ts
- [ ] T053 [US3] Implement preview/publish/rollback controls in app/components/admin/ai-behavior/ReleaseControlsSection.tsx
- [ ] T054 [US3] Render version history and rollback picker in app/routes/app.settings.tsx
- [ ] T055 [US3] Persist publish/rollback audit snapshots in app/lib/db/queries.ts

**Checkpoint**: All user stories are independently functional.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final hardening, documentation, and validation across all stories.

- [ ] T056 [P] Add end-to-end quickstart validation checklist updates in specs/024-ai-behavior-configuration/quickstart.md
- [ ] T057 [P] Add API contract conformance tests for behavior endpoints in tests/integration/ai-behavior/api-contract.test.ts
- [ ] T058 Add performance instrumentation for config read and publish latency in app/routes/api.ai.behavior.config.tsx
- [ ] T059 Add resilience telemetry for preview failures in app/routes/api.ai.behavior.preview.tsx
- [ ] T060 Add data migration/backfill notes for existing shops in specs/024-ai-behavior-configuration/plan.md
- [ ] T061 Run and document full test command set for feature in specs/024-ai-behavior-configuration/quickstart.md

---

## Dependencies & Execution Order

### Phase Dependencies

- Setup (Phase 1): No dependencies.
- Foundational (Phase 2): Depends on Setup completion and blocks all user stories.
- User Story phases (Phases 3-5): Depend on Foundational completion.
- Polish (Phase 6): Depends on completion of all user story phases.

### User Story Dependencies

- User Story 1 (P1): Starts after Foundational; no dependency on other stories.
- User Story 2 (P2): Starts after Foundational; depends on shared config schema and persistence from Phase 2, but not on US3 lifecycle actions.
- User Story 3 (P3): Starts after Foundational and uses US1/US2 config foundations for preview/publish/rollback lifecycle.

### Within Each User Story

- Tests are created first and should fail before implementation.
- Validation and schema work precede route mutations.
- DB lifecycle logic precedes UI controls that trigger it.
- Runtime prompt/bootstrap integration precedes final story checkpoint.

## Parallel Opportunities

- Setup: T002 and T003 can run in parallel after T001.
- Foundational: T008-T012 can run in parallel after T006-T007; T013-T015 can run in parallel.
- US1: T020-T023 can run in parallel; T028 and T029 can run in parallel after T027.
- US2: T032-T035 can run in parallel; T036 and T037 can run in parallel.
- US3: T044-T047 can run in parallel; T050 and T051 can run in parallel after T048-T049.
- Polish: T056 and T057 can run in parallel; T058 and T059 can run in parallel.

## Parallel Example: User Story 1

- Run in parallel: T020 in tests/unit/ai/behavior-policy-schema.test.ts, T021 in tests/unit/ai/prompt-safety-precedence.test.ts, T022 in tests/integration/ai-behavior/config-validation.test.ts, T023 in tests/integration/ai-behavior/fallback-runtime.test.ts.
- Run in parallel after policy validation logic is in place: T028 in app/lib/ai/prompts.ts and T029 in app/lib/ai/storefront-chat.ts.

## Parallel Example: User Story 2

- Run in parallel: T032 in tests/unit/ai/prompt-tone-profile.test.ts, T033 in tests/unit/ai/prompt-aggressiveness.test.ts, T034 in tests/unit/ai/conversation-starters.test.ts, T035 in tests/integration/ai-behavior/bootstrap-starters.test.ts.
- Run in parallel: T036 in app/components/admin/ai-behavior/StyleControlsSection.tsx and T037 in app/components/admin/ai-behavior/GuidanceSection.tsx.

## Parallel Example: User Story 3

- Run in parallel: T044 in tests/integration/ai-behavior/preview-contract.test.ts, T045 in tests/integration/ai-behavior/publish-lifecycle.test.ts, T046 in tests/integration/ai-behavior/rollback-lifecycle.test.ts, T047 in tests/unit/ai/audit-snapshots.test.ts.
- Run in parallel after preview runner is complete: T050 in app/routes/api.ai.behavior.config.tsx and T053 in app/components/admin/ai-behavior/ReleaseControlsSection.tsx.

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 and Phase 2.
2. Complete Phase 3 (US1).
3. Validate independently with US1 test set and runtime fallback checks.
4. Demo merchant-safe policy controls as MVP.

### Incremental Delivery

1. Add User Story 2 for tone/aggressiveness/starter tuning.
2. Validate independent behavior changes in new conversations.
3. Add User Story 3 for preview, publish, and rollback lifecycle.
4. Finish with Polish phase contract/perf/reliability hardening.

### Parallel Team Strategy

1. Team completes Setup and Foundational together.
2. After Phase 2:
   - Engineer A: US1 policy + fallback/runtime.
   - Engineer B: US2 style controls + bootstrap integration.
   - Engineer C: US3 lifecycle APIs + version history.
3. Merge in story priority order with contract and integration tests as release gates.

## Notes

- [P] marks tasks that can run in parallel on different files without unmet dependencies.
- [USx] labels maintain traceability from tasks to user stories.
- Each story has explicit independent test criteria and checkpoint.
- Preserve strict TypeScript and boundary validation requirements from constitution gates.
