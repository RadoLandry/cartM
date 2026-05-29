# Tasks: Cart-Aware Conversation

**Input**: Design documents from `/specs/015-cart-aware-conversation/`
**Prerequisites**: `plan.md` (required), `spec.md` (required), `research.md`, `data-model.md`, `contracts/`, `quickstart.md`

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Align feature configuration and baseline contracts for implementation.

- [X] T001 Confirm feature context and plan references in .github/copilot-instructions.md
- [X] T002 Align feature package scripts and validation commands in package.json
- [X] T003 [P] Document cart-aware conversation environment requirements in specs/015-cart-aware-conversation/quickstart.md

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core transport, schema, and security foundations required before user-story work.

**CRITICAL**: No user story implementation should begin until this phase is complete.

- [X] T004 Strengthen bootstrap and stream payload contracts in app/lib/ai/schemas.ts
- [X] T005 Harden stream token scope and TTL verification logic in app/lib/shopify/app-proxy.ts
- [X] T006 Enforce origin and scope checks in stream route boundary handling in app/routes/api.ai.chat.tsx
- [X] T007 Normalize bootstrap response behavior and validation failures in app/routes/api.app-proxy.chat-bootstrap.tsx
- [X] T008 [P] Add foundational bootstrap contract coverage for invalid payload/auth paths in tests/integration/routes/storefront-chat-bootstrap.test.ts
- [X] T009 [P] Add foundational stream boundary coverage for token/origin/scope failures in tests/integration/routes/storefront-chat-stream.test.ts

**Checkpoint**: Foundation complete. User stories can now be implemented independently.

---

## Phase 3: User Story 1 - Get Cart-Specific Advice (Priority: P1) 🎯 MVP

**Goal**: Ensure every response is grounded in the latest cart and references relevant cart items.

**Independent Test**: Seed a cart with multiple items, ask cart-audit questions, and verify assistant responses explicitly reference current cart items and remain consistent on follow-up.

### Tests for User Story 1

- [X] T010 [P] [US1] Add unit coverage for cart-aware prompt construction in tests/unit/storefront/chat-guidance-model.test.ts
- [X] T011 [P] [US1] Add integration coverage for cart item references in streamed replies in tests/integration/routes/storefront-chat-stream.test.ts

### Implementation for User Story 1

- [X] T012 [US1] Build cart-context prompt assembly and safeguards in app/lib/ai/prompts.ts
- [X] T013 [US1] Implement cart-aware reply composer that references current cart lines in app/lib/ai/storefront-chat.ts
- [X] T014 [US1] Ensure stream route emits consistent turn outputs for unchanged cart follow-ups in app/routes/api.ai.chat.tsx
- [X] T015 [US1] Update chat message reconciliation for deterministic assistant text assembly in storefront-widget/src/hooks/useStorefrontChat.ts

**Checkpoint**: US1 is independently functional and testable.

---

## Phase 4: User Story 2 - Receive Actionable Cart Changes (Priority: P2)

**Goal**: Provide actionable keep/add/remove/swap/size guidance with shopper-friendly reasoning and safety-first priority.

**Independent Test**: Ask for missing-kit and budget optimization guidance and verify structured, actionable recommendations with rationale and safety-first ordering.

### Tests for User Story 2

- [X] T016 [P] [US2] Add unit coverage for actionable recommendation block mapping in tests/unit/storefront/chat-guidance-model.test.ts
- [X] T017 [P] [US2] Add integration coverage for structured actionable guidance emission in tests/integration/routes/storefront-chat-stream.test.ts

### Implementation for User Story 2

- [X] T018 [US2] Extend structured guidance schema for actionable recommendation semantics in app/lib/ai/schemas.ts
- [X] T019 [US2] Implement actionable guidance generation with rationale and prioritization in app/lib/ai/storefront-chat.ts
- [X] T020 [US2] Enforce unavailable-product suppression and fallback behavior in app/lib/ai/storefront-chat.ts
- [X] T021 [US2] Update guidance render model for actionable categories in storefront-widget/src/components/guidance/getGuidanceRenderModel.ts
- [X] T022 [P] [US2] Update recommendation list presentation for actionable fields in storefront-widget/src/components/guidance/RecommendationList.tsx
- [X] T023 [P] [US2] Update comparison/size/fallback rendering alignment in storefront-widget/src/components/guidance/ComparisonTable.tsx

**Checkpoint**: US1 and US2 both work independently.

---

## Phase 5: User Story 3 - Keep Guidance Current as Cart Changes (Priority: P3)

**Goal**: Maintain response accuracy when cart contents change during an active chat session.

**Independent Test**: Change cart lines between prompts and verify subsequent responses use updated cart state; confirm empty-cart guidance is explicit and helpful.

### Tests for User Story 3

- [X] T024 [P] [US3] Add session-state coverage for cart-change continuity behavior in tests/unit/storefront/chat-session-state.test.ts
- [X] T025 [P] [US3] Add integration coverage for empty-cart and updated-cart follow-up behavior in tests/integration/routes/storefront-chat-stream.test.ts

### Implementation for User Story 3

- [X] T026 [US3] Handle cart mutation between turns and rebootstrap/session invalidation flow in storefront-widget/src/hooks/useStorefrontChat.ts
- [X] T027 [US3] Persist and reconcile retryable conversation state across close/reopen in storefront-widget/src/hooks/useChatSessionState.ts
- [X] T028 [US3] Improve empty-cart response and next-step fallback guidance in app/lib/ai/storefront-chat.ts
- [X] T029 [US3] Wire cart-surface state refresh trigger for chat mount payloads in storefront-widget/src/CartMindChat.tsx
- [X] T030 [US3] Ensure cart drawer block passes updated session/cart inputs reliably in extensions/cart-drawer-block/blocks/ai-cart.liquid

**Checkpoint**: All user stories are independently functional.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final validation, documentation, and quality hardening across stories.

- [X] T031 [P] Refresh contract documentation to match final payloads in specs/015-cart-aware-conversation/contracts/storefront-chat-stream.md
- [X] T032 [P] Refresh bootstrap contract examples for final token/session behavior in specs/015-cart-aware-conversation/contracts/storefront-chat-bootstrap.md
- [X] T033 [P] Refresh UI model contract with final rendered block semantics in specs/015-cart-aware-conversation/contracts/storefront-chat-ui-model.md
- [X] T034 Run focused chat test suite and capture results in specs/015-cart-aware-conversation/quickstart.md
- [X] T035 Run lint and typecheck validation for touched surfaces via package.json scripts and record known unrelated blockers in specs/015-cart-aware-conversation/quickstart.md

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies.
- **Phase 2 (Foundational)**: Depends on Phase 1 completion; blocks all user stories.
- **Phase 3 (US1)**: Depends on Phase 2 completion.
- **Phase 4 (US2)**: Depends on Phase 2 completion; may build on US1 artifacts but remains independently testable.
- **Phase 5 (US3)**: Depends on Phase 2 completion; may integrate with US1/US2 behavior while remaining independently testable.
- **Phase 6 (Polish)**: Depends on completion of selected user stories.

### User Story Dependencies

- **US1 (P1)**: No dependency on other stories once foundational phase is complete.
- **US2 (P2)**: Can proceed after foundational phase; references US1 transport contracts but delivers independent value.
- **US3 (P3)**: Can proceed after foundational phase; validates continuity behavior independently.

### Within Each User Story

- Test tasks precede implementation tasks for the same story.
- Contract/schema updates precede route and widget integration.
- Stream behavior updates precede UI rendering refinements.
- Story checkpoint validation occurs before moving to the next priority story.

---

## Parallel Opportunities

- **Foundational**: T008 and T009 can run in parallel once T004-T007 are in place.
- **US1**: T010 and T011 can run in parallel; T015 can run after T012-T014 stabilize.
- **US2**: T016 and T017 can run in parallel; T022 and T023 can run in parallel after T018-T021.
- **US3**: T024 and T025 can run in parallel; T029 and T030 can run in parallel after T026-T028.
- **Polish**: T031, T032, and T033 can run in parallel.

---

## Parallel Example: User Story 2

```bash
# Parallel tests for US2
Task: "T016 [US2] Add unit coverage for actionable recommendation block mapping in tests/unit/storefront/chat-guidance-model.test.ts"
Task: "T017 [US2] Add integration coverage for structured actionable guidance emission in tests/integration/routes/storefront-chat-stream.test.ts"

# Parallel UI rendering updates for US2
Task: "T022 [US2] Update recommendation list presentation for actionable fields in storefront-widget/src/components/guidance/RecommendationList.tsx"
Task: "T023 [US2] Update comparison/size/fallback rendering alignment in storefront-widget/src/components/guidance/ComparisonTable.tsx"
```

---

## Implementation Strategy

### MVP First (US1)

1. Complete Setup (Phase 1).
2. Complete Foundational work (Phase 2).
3. Complete US1 (Phase 3).
4. Validate US1 independently with focused tests and manual cart audit flow.
5. Demo/deploy MVP behavior.

### Incremental Delivery

1. Deliver US1 cart-specific guidance.
2. Deliver US2 actionable recommendation categories.
3. Deliver US3 cart-change continuity and empty-cart resilience.
4. Execute Polish phase for docs and validation.

### Parallel Team Strategy

1. Team completes Phases 1 and 2 together.
2. After foundational completion:
   - Developer A: US1 route and prompt grounding.
   - Developer B: US2 guidance modeling and UI renderers.
   - Developer C: US3 session/cart continuity.
3. Rejoin for Phase 6 cross-cutting validation.

---

## Notes

- `[P]` tasks indicate parallel-safe execution.
- `[US1]`, `[US2]`, `[US3]` labels provide story traceability.
- Every task includes a concrete file path for immediate execution.
- Keep commits small per task or per logical batch of tasks.
