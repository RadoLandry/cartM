# Tasks: Chat Cart Management

**Input**: Design documents from `/specs/028-add-chat-cart-management/`  
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/, quickstart.md

**Tests**: Included. The plan and quickstart explicitly require focused automated coverage for proposal parsing, mutation execution semantics, confirmation lifecycle, and storefront action confirmation behavior.

**Organization**: Tasks are grouped by user story so each story can be implemented and tested independently.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Prepare feature-specific test scaffolding, traceability, and storefront chat fixture alignment.

- [X] T001 Create feature task traceability notes in specs/028-add-chat-cart-management/tasks.md
- [X] T002 [P] Add shared chat cart mutation test fixtures in tests/helpers/storefront-chat-cart-fixtures.ts
- [X] T003 [P] Add shared action-lifecycle assertion helpers in tests/helpers/cart-action-lifecycle-assertions.ts

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core mutation contracts and lifecycle invariants required by all user stories.

**CRITICAL**: No user story implementation begins until these are complete.

- [X] T004 Extend cart mutation request/response schemas for strict chat cart payload validation in app/lib/ai/schemas.ts
- [X] T005 Harden action lifecycle transition and idempotent replay guardrails for cart tool actions in app/lib/ai/storefront-chat.ts
- [X] T006 Enforce mutation adapter conflict-safe outcome codes/messages across add/remove/change/swap paths in app/lib/shopify/storefront-cart.ts
- [X] T007 [P] Add unit coverage for foundational lifecycle transition and replay invariants in tests/unit/ai/cart-action-lifecycle.test.ts
- [X] T008 [P] Add unit coverage for foundational mutation adapter error code semantics in tests/unit/shopify/storefront-cart-mutation-adapter.test.ts

**Checkpoint**: Foundation ready - user stories can now proceed.

---

## Phase 3: User Story 1 - Manage cart items by chat (Priority: P1) 🎯 MVP

**Goal**: Allow shoppers to add, remove, and update cart lines through conversation with explicit confirmation and clear success/failure feedback.

**Independent Test**: Start with a populated cart, request add/remove/update through chat, approve each action, and verify resulting cart state and action history after each mutation.

### Tests for User Story 1

- [X] T009 [P] [US1] Add unit tests for add/remove/change_quantity proposal inference in tests/unit/ai/cart-tool-proposal.test.ts
- [X] T010 [P] [US1] Add integration tests for approve/decline execution of add/remove/change_quantity actions in tests/integration/routes/storefront-chat-action-confirm.test.ts
- [X] T011 [P] [US1] Add storefront widget action-confirmation state tests for add/remove/change_quantity flows in tests/unit/storefront/useStorefrontChat-action-confirmation.test.ts

### Implementation for User Story 1

- [X] T012 [US1] Implement robust add/remove/change_quantity intent extraction and proposal generation in app/lib/ai/tools.ts
- [X] T013 [US1] Implement approve/decline execution handling for add/remove/change_quantity cart tool actions in app/routes/api.ai.chat.actions.confirm.tsx
- [X] T014 [US1] Ensure chat stream emits cart action proposal/status parts for add/remove/change_quantity in app/routes/api.ai.chat.tsx
- [X] T015 [US1] Update mutation adapter add/remove/update semantics and summaries for conversational execution parity in app/lib/shopify/storefront-cart.ts
- [X] T016 [US1] Wire storefront chat client confirmation calls and status reconciliation for add/remove/change_quantity in storefront-widget/src/hooks/useStorefrontChat.ts
- [X] T017 [US1] Update chat action rendering for add/remove/change_quantity previews and outcomes in storefront-widget/src/components/ChatMessageList.tsx

**Checkpoint**: User Story 1 is independently functional and testable (MVP).

---

## Phase 4: User Story 2 - Replace variant on existing line (Priority: P2)

**Goal**: Let shoppers swap an existing cart line variant through chat while preserving safety, idempotency, and clear recovery messaging.

**Independent Test**: Start with an existing line, request a variant replacement, approve it, and verify old variant removal + new variant presence; verify unavailable target variant fails safely with no unintended destructive result.

### Tests for User Story 2

- [X] T018 [P] [US2] Add unit tests for swap_variant proposal inference and preview generation in tests/unit/ai/cart-tool-proposal.test.ts
- [X] T019 [P] [US2] Add integration tests for swap_variant confirmation execution and failure paths in tests/integration/routes/storefront-chat-action-confirm.test.ts
- [X] T020 [P] [US2] Add adapter tests for swap_variant rollback-safe and conflict behavior in tests/unit/shopify/storefront-cart-mutation-adapter.test.ts

### Implementation for User Story 2

- [X] T021 [US2] Implement swap_variant proposal resolution with line/variant targeting validation in app/lib/ai/tools.ts
- [X] T022 [US2] Implement swap_variant approval execution, unavailable-variant handling, and user recovery options in app/routes/api.ai.chat.actions.confirm.tsx
- [X] T023 [US2] Harden swapLineVariant adapter behavior for no-partial-success failure semantics in app/lib/shopify/storefront-cart.ts
- [X] T024 [US2] Emit swap_variant proposal/status events in chat streaming response assembly in app/routes/api.ai.chat.tsx
- [X] T025 [US2] Render swap_variant-specific status and action history context in storefront-widget/src/components/ChatMessageList.tsx

**Checkpoint**: User Stories 1 and 2 both work independently.

---

## Phase 5: User Story 3 - Adjust quantity by chat (Priority: P3)

**Goal**: Support explicit quantity increase/decrease requests with minimum-limit enforcement and accurate cart/result synchronization.

**Independent Test**: For an existing cart line, request increase then decrease via chat approvals and validate quantities/totals; request below-minimum quantity and verify validation rejection.

### Tests for User Story 3

- [X] T026 [P] [US3] Add unit tests for quantity increase/decrease parsing and boundary handling in tests/unit/ai/cart-tool-proposal.test.ts
- [X] T027 [P] [US3] Add integration tests for change_quantity lower-bound rejection and success paths in tests/integration/routes/storefront-chat-action-confirm.test.ts
- [X] T028 [P] [US3] Add storefront widget sync tests for post-quantity-mutation state reconciliation in tests/unit/storefront/useStorefrontChat-action-confirmation.test.ts

### Implementation for User Story 3

- [X] T029 [US3] Implement quantity intent normalization (increase/decrease to explicit quantity) in app/lib/ai/tools.ts
- [X] T030 [US3] Enforce quantity minimum and clear error messaging in chat action confirmation route in app/routes/api.ai.chat.actions.confirm.tsx
- [X] T031 [US3] Align quantity mutation adapter outcomes/messages with conversational confirmations in app/lib/shopify/storefront-cart.ts
- [X] T032 [US3] Ensure storefront chat applies quantity action outcomes and refreshes cart snapshot coherently in storefront-widget/src/hooks/useStorefrontChat.ts

**Checkpoint**: All user stories are independently functional.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final hardening, non-regression verification, and documentation sync.

- [X] T033 [P] Add edge-case coverage for ambiguous requests and duplicate approvals in tests/integration/routes/storefront-chat-action-confirm.test.ts
- [X] T034 [P] Add cross-story action history and replay regression coverage in tests/unit/storefront/useStorefrontChat-action-confirmation.test.ts
- [X] T035 Run full quickstart validation commands and record outcome notes in specs/028-add-chat-cart-management/quickstart.md
- [X] T036 Verify theme extension cart chat block configuration remains compatible with new cart mutation flows in extensions/cart-drawer-block/blocks/ai-cart.liquid
- [X] T037 Update feature changelog notes for chat cart management delivery in CHANGELOG.md

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: no dependencies.
- **Phase 2 (Foundational)**: depends on Phase 1 and blocks all story work.
- **Phase 3 (US1)**: depends on Phase 2.
- **Phase 4 (US2)**: depends on Phase 2 and can run after US1 MVP validation.
- **Phase 5 (US3)**: depends on Phase 2 and can run after US1 MVP validation.
- **Phase 6 (Polish)**: depends on completion of desired stories.

### User Story Dependencies

- **US1 (P1)**: no dependency on other stories after foundation.
- **US2 (P2)**: no strict dependency on US1, but reuses shared action lifecycle/mutation adapter surfaces.
- **US3 (P3)**: no strict dependency on US2; reuses shared proposal/confirmation/mutation surfaces.

### Within Each User Story

- Write/adjust tests first and ensure failures reproduce expected gaps.
- Implement proposal/parser logic before route execution updates.
- Route execution updates before storefront widget rendering/state reconciliation.
- Complete story-level regression checks before moving to next checkpoint.

---

## Parallel Opportunities

- Setup tasks `T002` and `T003` can run in parallel.
- Foundational tests `T007` and `T008` can run in parallel with non-overlapping files.
- In US1, tests `T009`, `T010`, `T011` can run in parallel.
- In US2, tests `T018`, `T019`, `T020` can run in parallel.
- In US3, tests `T026`, `T027`, `T028` can run in parallel.
- Polish tasks `T033` and `T034` can run in parallel.

## Parallel Example: User Story 1

```bash
# Run US1 test authoring/execution tasks in parallel:
Task: T009 [US1] tests/unit/ai/cart-tool-proposal.test.ts
Task: T010 [US1] tests/integration/routes/storefront-chat-action-confirm.test.ts
Task: T011 [US1] tests/unit/storefront/useStorefrontChat-action-confirmation.test.ts
```

---

## Implementation Strategy

### MVP First (US1 only)

1. Complete Phase 1 and Phase 2.
2. Complete Phase 3 (US1).
3. Validate US1 independently using its test and manual criteria.
4. Demo/deploy MVP slice.

### Incremental Delivery

1. Foundation ready (Phases 1-2).
2. Deliver US1 (MVP) -> validate.
3. Deliver US2 (variant replacement) -> validate.
4. Deliver US3 (quantity adjust) -> validate.
5. Finish cross-cutting polish and full quickstart validation.

### Parallel Team Strategy

1. Team completes setup/foundation together.
2. After foundation:
   - Engineer A: US1 implementation/tests.
   - Engineer B: US2 implementation/tests.
   - Engineer C: US3 implementation/tests.
3. Merge after story checkpoints and finish polish tasks.

---

## Notes

- `[P]` tasks indicate file-level independence and can be executed concurrently.
- Story labels `[US1]`, `[US2]`, `[US3]` map directly to spec priorities.
- Each story includes an independent test criterion to support isolated validation.
- All tasks include concrete target file paths for immediate execution.

## Task Traceability Notes

- Story to requirement mapping:
   - US1 -> FR-001, FR-002, FR-003, FR-007, FR-008, FR-009
   - US2 -> FR-004, FR-007, FR-008, FR-009, FR-010
   - US3 -> FR-005, FR-006, FR-007, FR-008
- Success criteria coverage:
   - SC-001 tracked via integration execution success assertions in `tests/integration/routes/storefront-chat-action-confirm.test.ts`
   - SC-002 tracked via response timing observations in quickstart execution notes
   - SC-003 tracked via independent story validation checkpoints
   - SC-004 tracked post-release via analytics/support trend monitoring
