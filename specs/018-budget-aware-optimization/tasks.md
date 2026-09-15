# Tasks: Budget-Aware Optimization

**Input**: Design documents from /specs/018-budget-aware-optimization/
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Included, because the plan and constitution require deterministic integration and unit validation for new business logic.

**Organization**: Tasks are grouped by user story so each story can be implemented and tested independently.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Prepare feature-level scaffolding and test harness placeholders.

- [x] T001 Create budget optimization task execution baseline in specs/018-budget-aware-optimization/tasks.md
- [x] T002 [P] Add budget optimization test file scaffold in tests/integration/routes/storefront-chat-budget-optimization.test.ts
- [x] T003 [P] Add budget optimization unit test scaffold in tests/unit/ai/budget-optimization-ranking.test.ts
- [x] T004 [P] Add storefront state unit test scaffold in tests/unit/storefront/budget-optimization-state.test.ts

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core contracts, schemas, context lifecycle, and route plumbing required before any user story.

**CRITICAL**: No user story work should begin until this phase is complete.

- [x] T005 Add BudgetOptimization request/result/candidate schemas and stream part unions in app/lib/ai/schemas.ts
- [x] T006 Implement budget optimization context lifecycle store and transition helpers in app/lib/ai/storefront-chat.ts
- [x] T007 Implement budget intent parsing and optimization action proposal builder in app/lib/ai/tools.ts
- [x] T008 Create optimization candidate/ranking module with constraint-aware scoring in app/lib/cart-intelligence/budget-optimization.ts
- [x] T009 Extend cart helper to resolve optimization candidate snapshots and price/availability freshness in app/lib/shopify/cart.ts
- [x] T010 Extend chat SSE route for budget-optimization.proposed/result/error emissions in app/routes/api.ai.chat.tsx
- [x] T011 Extend confirmation route for budget_optimization_select payload validation and action dispatch in app/routes/api.ai.chat.actions.confirm.tsx
- [x] T012 Add optimization-related prompt guidance for deterministic tool usage in app/lib/ai/prompts.ts

**Checkpoint**: Foundation ready for independent user story implementation.

---

## Phase 3: User Story 1 - Rebalance Cart to Budget (Priority: P1) 🎯 MVP

**Goal**: Shopper receives a ranked optimization proposal that reaches the target budget when possible.

**Independent Test**: Submit an over-budget cart + target budget and verify returned projected subtotal is <= target or includes explicit non-attainable reason.

### Tests for User Story 1

- [x] T013 [P] [US1] Add integration test for over-budget proposal generation and projected subtotal calculation in tests/integration/routes/storefront-chat-budget-optimization.test.ts
- [x] T014 [P] [US1] Add unit tests for candidate ranking and projected subtotal math in tests/unit/ai/budget-optimization-ranking.test.ts

### Implementation for User Story 1

- [x] T015 [US1] Implement proposal assembly with baseline subtotal, target, projected subtotal, and gap fields in app/lib/cart-intelligence/budget-optimization.ts
- [x] T016 [US1] Implement optimization result normalization and stream payload mapping in app/lib/ai/storefront-chat.ts
- [x] T017 [US1] Render budget optimization card with totals and ranked candidates in storefront-widget/src/components/guidance/BudgetOptimizationCard.tsx
- [x] T018 [US1] Integrate optimization result rendering in storefront chat reducer flow in storefront-widget/src/hooks/useStorefrontChat.ts
- [x] T019 [US1] Wire optimization card into chat surface component composition in storefront-widget/src/CartMindChat.tsx

**Checkpoint**: User Story 1 independently functional.

---

## Phase 4: User Story 2 - Protect Safety-Critical Items (Priority: P1)

**Goal**: Optimization preserves safety-critical items by default and returns explicit constraint-blocked outcomes when needed.

**Independent Test**: Use a cart with safety-critical + optional items under strict budget and verify optional/cosmetic changes are prioritized and blocked outcome appears when safety would be violated.

### Tests for User Story 2

- [x] T020 [P] [US2] Add integration test for safety-critical preservation and constraint_blocked responses in tests/integration/routes/storefront-chat-budget-optimization.test.ts
- [x] T021 [P] [US2] Add unit tests for safety-first ranking and critical-removal exclusion logic in tests/unit/ai/budget-optimization-ranking.test.ts

### Implementation for User Story 2

- [x] T022 [US2] Add safetyCriticalImpact guardrails and exclusion rules to candidate filtering in app/lib/cart-intelligence/budget-optimization.ts
- [x] T023 [US2] Add explicit CONSTRAINT_BLOCKED and NO_ELIGIBLE_CANDIDATES mapping in app/lib/ai/storefront-chat.ts
- [x] T024 [US2] Enforce safety/minimum-kit constraints at confirmation execution path in app/routes/api.ai.chat.actions.confirm.tsx
- [x] T025 [US2] Extend confirmation response payloads with constraint failure recovery guidance in app/routes/api.ai.chat.actions.confirm.tsx
- [x] T026 [US2] Surface safety-critical badges and blocked-state messaging in storefront-widget/src/components/guidance/BudgetOptimizationCard.tsx

**Checkpoint**: User Stories 1 and 2 independently functional.

---

## Phase 5: User Story 3 - Explain Trade-Offs Clearly (Priority: P2)

**Goal**: Shopper sees itemized trade-offs and can accept/reject candidates with recomputed plan and remaining gap.

**Independent Test**: Reject one proposed candidate and verify recalculated projection and remaining budget gap are returned and displayed.

### Tests for User Story 3

- [x] T027 [P] [US3] Add integration test for partial accept/reject and recomputed proposal flow in tests/integration/routes/storefront-chat-budget-optimization.test.ts
- [x] T028 [P] [US3] Add storefront state unit tests for candidate-level decision handling in tests/unit/storefront/budget-optimization-state.test.ts

### Implementation for User Story 3

- [x] T029 [US3] Add itemized rationale, savings delta, and trade-off text formatting for each candidate in app/lib/ai/storefront-chat.ts
- [x] T030 [US3] Implement candidate-level decision payload parsing and recomputation trigger in app/routes/api.ai.chat.actions.confirm.tsx
- [x] T031 [US3] Implement apply/decline candidate handlers and local timeline updates in storefront-widget/src/hooks/useStorefrontChat.ts
- [x] T032 [US3] Add remaining-gap and recalculated-total rendering states in storefront-widget/src/components/guidance/BudgetOptimizationCard.tsx
- [x] T033 [US3] Update session chat state model for optimization decision history in storefront-widget/src/hooks/useChatSessionState.ts

**Checkpoint**: All user stories independently functional.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Finalize contracts, quickstart verification, and quality checks across stories.

- [x] T034 [P] Align stream contract with implemented payload fields in specs/018-budget-aware-optimization/contracts/storefront-budget-optimization-stream.md
- [x] T035 [P] Align follow-up action contract with implemented statuses/errors in specs/018-budget-aware-optimization/contracts/storefront-budget-optimization-action.md
- [x] T036 [P] Align data-source contract with final queried fields and failure mappings in specs/018-budget-aware-optimization/contracts/storefront-budget-optimization-data-source.md
- [x] T037 Update manual verification notes and acceptance mapping with final behavior in specs/018-budget-aware-optimization/quickstart.md
- [x] T038 Record focused test run results and quickstart validation completion in specs/018-budget-aware-optimization/quickstart.md

---

## Dependencies & Execution Order

### Phase Dependencies

- Setup (Phase 1): no dependencies.
- Foundational (Phase 2): depends on Setup and blocks all user stories.
- User Stories (Phase 3+): depend on Foundational completion.
- Polish (Phase 6): depends on all targeted stories being complete.

### User Story Dependencies

- US1 (P1): starts after Foundational, no dependency on other stories.
- US2 (P1): starts after Foundational, independently testable, reuses shared optimization pipeline.
- US3 (P2): starts after Foundational, independently testable, reuses proposal and confirmation lifecycle.

### Within Each User Story

- Write tests first, verify fail state, then implement.
- Implement server-side normalization/validation before widget rendering.
- Complete route confirmation handling before client-side apply/decline controls.
- Validate independent story checkpoint before moving to lower-priority scope.

## Parallel Opportunities

- Setup: T002, T003, T004 can run in parallel.
- Foundational: T005, T006, T008, T012 can run in parallel, then merge through T007/T009/T010/T011.
- US1: T013 and T014 parallel; T017 and T018 parallel after T016.
- US2: T020 and T021 parallel; T024 and T026 parallel after T022/T023.
- US3: T027 and T028 parallel; T031 and T032 parallel after T030.
- Polish: T034, T035, T036 parallel.

## Parallel Example: User Story 1

- Task: T013 [US1] Add integration test for over-budget proposal generation and projected subtotal calculation in tests/integration/routes/storefront-chat-budget-optimization.test.ts
- Task: T014 [US1] Add unit tests for candidate ranking and projected subtotal math in tests/unit/ai/budget-optimization-ranking.test.ts

- Task: T017 [US1] Render budget optimization card with totals and ranked candidates in storefront-widget/src/components/guidance/BudgetOptimizationCard.tsx
- Task: T018 [US1] Integrate optimization result rendering in storefront chat reducer flow in storefront-widget/src/hooks/useStorefrontChat.ts

## Parallel Example: User Story 2

- Task: T020 [US2] Add integration test for safety-critical preservation and constraint_blocked responses in tests/integration/routes/storefront-chat-budget-optimization.test.ts
- Task: T021 [US2] Add unit tests for safety-first ranking and critical-removal exclusion logic in tests/unit/ai/budget-optimization-ranking.test.ts

## Parallel Example: User Story 3

- Task: T027 [US3] Add integration test for partial accept/reject and recomputed proposal flow in tests/integration/routes/storefront-chat-budget-optimization.test.ts
- Task: T028 [US3] Add storefront state unit tests for candidate-level decision handling in tests/unit/storefront/budget-optimization-state.test.ts

## Implementation Strategy

### MVP First (US1)

1. Complete Phase 1 and Phase 2.
2. Complete Phase 3 (US1).
3. Validate projected totals and recommendation ranking on over-budget carts.
4. Demo/deploy MVP slice.

### Incremental Delivery

1. Deliver US1 for budget rebalance proposals.
2. Deliver US2 for safety-preserving constraints and blocked outcomes.
3. Deliver US3 for explicit trade-off explanations and partial decision recomputation.
4. Finish Phase 6 polish and contract/quickstart alignment.

### Parallel Team Strategy

1. Team finishes Setup + Foundational together.
2. After foundational checkpoint:
- Developer A: US1
- Developer B: US2
- Developer C: US3
3. Rejoin for polish, final validation, and release readiness.

## Notes

- [P] tasks target separate files and no incomplete dependencies.
- [USx] labels provide traceability from tasks to user stories.
- Each task uses a concrete repository path and can be executed directly.
- Confirmation and idempotency safeguards must remain intact for every optimization decision flow.
