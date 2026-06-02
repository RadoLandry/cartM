# Tasks: Cart Manipulation via Tools

**Input**: Design documents from /specs/016-cart-manipulation-tools/
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Not explicitly requested in the feature spec, so dedicated test-first tasks are omitted. Validation is included through quickstart flow and implementation checkpoints.

**Organization**: Tasks are grouped by user story so each story can be implemented and validated independently.

## Format: [ID] [P?] [Story] Description

- [P]: Can run in parallel (different files, no dependencies)
- [Story]: Which user story this task belongs to (US1, US2, US3)
- Every task includes an exact file path

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Prepare feature scaffolding and shared type contracts.

- [x] T001 Create feature task index and implementation notes in specs/016-cart-manipulation-tools/tasks.md
- [x] T002 [P] Add cart tool action type definitions in app/lib/ai/schemas.ts
- [x] T003 [P] Add stream event type definitions for tool-action-proposed and tool-action-status in app/lib/ai/schemas.ts
- [x] T004 [P] Add action lifecycle status constants and transition map in app/lib/ai/storefront-chat.ts

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core mutation orchestration and confirmation boundaries required by all user stories.

**CRITICAL**: No user story work begins until this phase is complete.

- [x] T005 Create storefront cart mutation adapter with normalized outcomes in app/lib/shopify/storefront-cart.ts
- [x] T006 Implement proposal token signing and verification helpers in app/lib/shopify/app-proxy.ts
- [x] T007 Implement canonical action lifecycle persistence helpers in app/lib/ai/storefront-chat.ts
- [x] T008 Implement confirmation endpoint route skeleton and request validation in app/routes/api.ai.chat.actions.confirm.tsx
- [x] T009 Extend chat stream route to emit typed tool action stream parts in app/routes/api.ai.chat.tsx
- [x] T010 Add shared tool orchestration entry points for proposal creation and resolution in app/lib/ai/tools.ts

**Checkpoint**: Foundation ready - user story implementation can now begin.

---

## Phase 3: User Story 1 - Confirmed Cart Actions in Chat (Priority: P1) 🎯 MVP

**Goal**: Every cart mutation is proposed first and only executes after explicit shopper approval.

**Independent Test**: Send add-item request in chat, verify approve applies mutation and decline applies no mutation.

### Implementation for User Story 1

- [x] T011 [US1] Implement addToCart proposal builder with preview and expiry metadata in app/lib/ai/tools.ts
- [x] T012 [US1] Wire addToCart proposal emission into chat stream responses in app/routes/api.ai.chat.tsx
- [x] T013 [US1] Implement approve and decline decision handling with lifecycle transitions in app/routes/api.ai.chat.actions.confirm.tsx
- [x] T014 [US1] Execute approved addToCart mutation through adapter and return cart summary in app/routes/api.ai.chat.actions.confirm.tsx
- [x] T015 [US1] Render confirmation UI card for proposed actions in storefront-widget/src/components/guidance/
- [x] T016 [US1] Submit explicit approve and decline actions from widget state hook in storefront-widget/src/hooks/useStorefrontChat.ts
- [x] T017 [US1] Show session-visible action history timeline entries for proposed/approved/declined in storefront-widget/src/hooks/useChatSessionState.ts

**Checkpoint**: User Story 1 is independently functional and testable.

---

## Phase 4: User Story 2 - Reliable Quantity and Removal Handling (Priority: P2)

**Goal**: Change quantity and remove item flows are reliable, revalidated, and resilient to stale cart state.

**Independent Test**: Change quantity and remove existing lines, then repeat with stale or missing lines and verify clear failures.

### Implementation for User Story 2

- [x] T018 [US2] Implement changeQuantity proposal payload validation and preview generation in app/lib/ai/tools.ts
- [x] T019 [US2] Implement removeFromCart proposal payload validation and preview generation in app/lib/ai/tools.ts
- [x] T020 [US2] Add approval-time stale cart revalidation for line existence and quantity constraints in app/routes/api.ai.chat.actions.confirm.tsx
- [x] T021 [US2] Execute approved quantity and remove mutations via adapter with normalized failure mapping in app/routes/api.ai.chat.actions.confirm.tsx
- [x] T022 [US2] Add idempotent replay handling for duplicate approvals by actionId in app/lib/ai/storefront-chat.ts
- [x] T023 [US2] Render clear failure and recovery option states for stale/missing line actions in storefront-widget/src/components/guidance/
- [x] T024 [US2] Surface executed and failed quantity/remove outcomes in action history state in storefront-widget/src/hooks/useChatSessionState.ts

**Checkpoint**: User Stories 1 and 2 both work independently.

---

## Phase 5: User Story 3 - Variant Swap With Clear Outcome (Priority: P3)

**Goal**: Variant swap proposals clearly show before/after details and execute safely through confirmation.

**Independent Test**: Request swap for an eligible line, verify before/after preview, approve success path, and unavailable variant failure path.

### Implementation for User Story 3

- [x] T025 [US3] Implement swapVariant proposal builder with before and after preview metadata in app/lib/ai/tools.ts
- [x] T026 [US3] Implement swap mutation execution flow (remove then add) in adapter with normalized partial failure messaging in app/lib/shopify/storefront-cart.ts
- [x] T027 [US3] Add approval-time variant availability revalidation in confirmation route in app/routes/api.ai.chat.actions.confirm.tsx
- [x] T028 [US3] Render swap-specific confirmation and outcome components in storefront-widget/src/components/guidance/
- [x] T029 [US3] Update widget stream reducer to map swap proposal and status events in storefront-widget/src/hooks/useStorefrontChat.ts

**Checkpoint**: All user stories are independently functional.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final hardening, docs alignment, and end-to-end validation.

- [x] T030 [P] Document action lifecycle, status semantics, and recovery codes in specs/016-cart-manipulation-tools/quickstart.md
- [x] T031 [P] Align contracts with final payload fields and status values in specs/016-cart-manipulation-tools/contracts/
- [x] T032 Run quickstart validation scenarios and record completion notes in specs/016-cart-manipulation-tools/quickstart.md
- [x] T033 Validate TypeScript consistency for changed modules and fix surfaced typing issues in app/lib/ai/schemas.ts

---

## Dependencies & Execution Order

### Phase Dependencies

- Phase 1: No dependencies, starts immediately.
- Phase 2: Depends on Phase 1 completion and blocks all user stories.
- Phase 3 to Phase 5: Depend on Phase 2 completion.
- Phase 6: Depends on completion of all targeted user stories.

### User Story Dependencies

- US1 (P1): Starts after Foundational phase, no dependency on other stories.
- US2 (P2): Starts after Foundational phase; can proceed independently of US1.
- US3 (P3): Starts after Foundational phase; can proceed independently of US1 and US2.

### Within Each User Story

- Build proposal schema and payload mapping before confirmation execution wiring.
- Complete server-side revalidation and execution before final widget outcome rendering.
- Complete story checkpoint validation before moving to lower priority story.

## Parallel Opportunities

- T002, T003, and T004 can run in parallel in Phase 1.
- T005 and T006 can run in parallel in Phase 2, then merge into T008 to T010.
- After Phase 2, US1, US2, and US3 can run in parallel by different contributors.
- T030 and T031 can run in parallel in Phase 6.

## Parallel Example: User Story 1

- Task: T015 [US1] Render confirmation UI card for proposed actions in storefront-widget/src/components/guidance/
- Task: T016 [US1] Submit explicit approve and decline actions from widget state hook in storefront-widget/src/hooks/useStorefrontChat.ts
- Task: T017 [US1] Show session-visible action history timeline entries for proposed/approved/declined in storefront-widget/src/hooks/useChatSessionState.ts

## Parallel Example: User Story 2

- Task: T018 [US2] Implement changeQuantity proposal payload validation and preview generation in app/lib/ai/tools.ts
- Task: T019 [US2] Implement removeFromCart proposal payload validation and preview generation in app/lib/ai/tools.ts

## Parallel Example: User Story 3

- Task: T028 [US3] Render swap-specific confirmation and outcome components in storefront-widget/src/components/guidance/
- Task: T029 [US3] Update widget stream reducer to map swap proposal and status events in storefront-widget/src/hooks/useStorefrontChat.ts

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 and Phase 2.
2. Complete Phase 3 (US1).
3. Validate approve and decline behavior for add-to-cart.
4. Demo and checkpoint MVP.

### Incremental Delivery

1. Ship US1 for confirmation-safe mutation flow.
2. Add US2 for robust quantity/remove operations.
3. Add US3 for variant swap support.
4. Run cross-cutting validation in Phase 6.

### Parallel Team Strategy

1. Team aligns on Phase 1 and 2 foundations.
2. Assign one contributor per user story phase.
3. Rejoin for Phase 6 docs and validation.

## Notes

- [P] tasks use separate files and can execute concurrently.
- [USx] labels map each task to one independently testable user story.
- Keep confirmation-token scope checks and idempotent action handling intact across all stories.
- Implementation note (2026-06-02): Phase 1 setup tasks T001-T004 completed; schema/types and lifecycle transitions are now in place for foundational route and tool orchestration work.
- Implementation note (2026-06-02): Phase 2 foundational tasks T005-T010 completed with initial adapter skeleton, confirmation-token flow, lifecycle store, proposal event streaming, and confirmation endpoint scaffolding.
- Implementation note (2026-06-02): Phase 3 User Story 1 tasks T011-T017 completed with add-action proposal + approval flow, confirmation cards, and session-visible action history.
- Implementation note (2026-06-02): Phase 4 User Story 2 tasks T018-T024 completed with quantity/remove proposal previews, stale-line checks at approval, adapter execution paths, and failed/executed outcomes reflected in action history.
- Implementation note (2026-06-02): Phase 5 User Story 3 tasks T025-T029 completed with swap previews, remove+add swap execution, variant revalidation, and swap event rendering through the same confirmation workflow.
- Implementation note (2026-06-02): Phase 6 polish tasks T030-T033 completed with lifecycle/recovery documentation updates, confirmation contract alignment, and zero diagnostics errors across changed files.
