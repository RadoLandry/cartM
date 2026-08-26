# Tasks: Product Comparison

**Input**: Design documents from /specs/017-product-comparison/
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/, quickstart.md

**Tests**: Not explicitly requested in the feature spec, so no dedicated test-first tasks are included. Validation is covered through focused implementation checks and quickstart verification.

**Organization**: Tasks are grouped by user story so each story can be implemented and validated independently.

## Format: [ID] [P?] [Story] Description

- [P]: Can run in parallel (different files, no dependencies)
- [Story]: Which user story this task belongs to (US1, US2, US3)
- Every task includes an exact file path

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Prepare feature-level schemas and stream payload scaffolding for product comparison.

- [x] T001 Create task breakdown and execution notes in specs/017-product-comparison/tasks.md
- [x] T002 [P] Add product comparison request and result schemas in app/lib/ai/schemas.ts
- [x] T003 [P] Add comparison stream part types and parser guards in app/lib/ai/schemas.ts
- [x] T004 [P] Add comparison context state interfaces in storefront-widget/src/hooks/useChatSessionState.ts

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core comparison pipeline and validation boundaries required before user stories.

**CRITICAL**: No user story work begins until this phase is complete.

- [x] T005 Implement comparison data fetch helper with field-minimal Storefront query in app/lib/shopify/cart.ts
- [x] T006 Implement comparison payload normalization helpers in app/lib/ai/storefront-chat.ts
- [x] T007 Implement comparison tool entry point and context ID generation in app/lib/ai/tools.ts
- [x] T008 Extend chat route to emit comparison.proposed, comparison.result, and comparison.error stream parts in app/routes/api.ai.chat.tsx
- [x] T009 Extend confirmation route to accept comparison_select action type payload in app/routes/api.ai.chat.actions.confirm.tsx
- [x] T010 Add session-scope validation helpers for comparisonContextId in app/lib/ai/storefront-chat.ts

**Checkpoint**: Foundation ready - user story implementation can now begin.

---

## Phase 3: User Story 1 - Compare Relevant Products in Cart Context (Priority: P1) 🎯 MVP

**Goal**: Shoppers can request and view a structured side-by-side product comparison with recommendation rationale.

**Independent Test**: Ask chat to compare at least two valid products and verify comparison rows plus recommendation are rendered.

### Implementation for User Story 1

- [x] T011 [US1] Implement compareProducts tool request validation (2-5 unique products) in app/lib/ai/tools.ts
- [x] T012 [US1] Implement comparison dimension builder (price, availability, key specs, trade-offs) in app/lib/ai/storefront-chat.ts
- [x] T013 [US1] Implement recommendation selector and rationale formatter in app/lib/ai/storefront-chat.ts
- [x] T014 [US1] Emit generatedAt and freshness metadata in comparison.result payload from app/routes/api.ai.chat.tsx
- [x] T015 [US1] Render comparison result card/table with recommendation highlight in storefront-widget/src/components/guidance/
- [x] T016 [US1] Add comparison stream reducer handling in storefront-widget/src/hooks/useStorefrontChat.ts
- [x] T017 [US1] Persist and display latest comparison context in session state in storefront-widget/src/hooks/useChatSessionState.ts

**Checkpoint**: User Story 1 is independently functional and testable.

---

## Phase 4: User Story 2 - Convert Comparison into Action (Priority: P2)

**Goal**: Shoppers can choose recommended or alternative compared products and complete a confirmed follow-up action.

**Independent Test**: From a rendered comparison, choose recommended and alternative options, confirm action, and verify cart outcome acknowledgement.

### Implementation for User Story 2

- [x] T018 [US2] Implement comparison follow-up action proposal payload mapping in app/lib/ai/tools.ts
- [x] T019 [US2] Add comparison action intent handling in confirmation route decision branch in app/routes/api.ai.chat.actions.confirm.tsx
- [x] T020 [US2] Revalidate selected product availability and price at approval time in app/routes/api.ai.chat.actions.confirm.tsx
- [x] T021 [US2] Map approved comparison selections to cart mutation adapter calls in app/lib/shopify/cart.ts
- [x] T022 [US2] Return normalized executed and failed comparison action outcomes from app/routes/api.ai.chat.actions.confirm.tsx
- [x] T023 [US2] Render actionable buttons for recommended and alternative options in storefront-widget/src/components/guidance/
- [x] T024 [US2] Submit comparison_select approvals and declines from widget hook in storefront-widget/src/hooks/useStorefrontChat.ts
- [x] T025 [US2] Record follow-up action status transitions in session history in storefront-widget/src/hooks/useChatSessionState.ts

**Checkpoint**: User Stories 1 and 2 are independently functional.

---

## Phase 5: User Story 3 - Handle Unclear or Invalid Comparison Requests (Priority: P3)

**Goal**: Invalid or ambiguous comparison requests produce clear guidance and recoverable outcomes.

**Independent Test**: Send insufficient, duplicate, and unavailable-product comparison requests and verify clear corrective responses.

### Implementation for User Story 3

- [x] T026 [US3] Implement insufficient-products and duplicate-product validation errors in app/lib/ai/tools.ts
- [x] T027 [US3] Implement unresolved or unavailable product mapping to comparison.error codes in app/lib/ai/storefront-chat.ts
- [x] T028 [US3] Add retryable guidance and suggested next-step text generation in app/routes/api.ai.chat.tsx
- [x] T029 [US3] Add stale comparison state detection and recoverable failure response in app/routes/api.ai.chat.actions.confirm.tsx
- [x] T030 [US3] Render comparison error cards with recovery actions in storefront-widget/src/components/guidance/
- [x] T031 [US3] Update widget reducer for comparison.error rendering and dismissal in storefront-widget/src/hooks/useStorefrontChat.ts

**Checkpoint**: All user stories are independently functional.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final contract alignment, docs update, and end-to-end validation.

- [X] T032 [P] Align comparison stream contract examples with implemented payload fields in specs/017-product-comparison/contracts/storefront-product-comparison-stream.md
- [X] T033 [P] Align follow-up action contract status/error cases with final behavior in specs/017-product-comparison/contracts/storefront-product-comparison-followup-action.md
- [X] T034 [P] Align data-source contract with final queried attributes in specs/017-product-comparison/contracts/storefront-product-comparison-data-source.md
- [X] T035 Update manual verification and acceptance mapping with implementation notes in specs/017-product-comparison/quickstart.md
- [X] T036 Run quickstart validation scenarios and record completion notes in specs/017-product-comparison/quickstart.md

---

## Dependencies & Execution Order

### Phase Dependencies

- Phase 1: No dependencies, starts immediately.
- Phase 2: Depends on Phase 1 completion and blocks all user stories.
- Phase 3 to Phase 5: Depend on Phase 2 completion.
- Phase 6: Depends on completion of all targeted user stories.

### User Story Dependencies

- US1 (P1): Starts after Foundational phase, no dependency on other stories.
- US2 (P2): Starts after Foundational phase and can be implemented independently, but uses US1 comparison context output for end-to-end validation.
- US3 (P3): Starts after Foundational phase and can be implemented independently, while reusing common comparison schemas and route handlers.

### Within Each User Story

- Server-side validation and normalization before widget rendering.
- Stream payload emission before widget reducer integration.
- Follow-up action mapping and revalidation before UI outcome messaging.
- Complete each story checkpoint before moving to lower priority stories.

## Parallel Opportunities

- T002, T003, and T004 can run in parallel in Phase 1.
- T005 and T006 can run in parallel in Phase 2, then merge into T007 to T010.
- In US1, T015 and T016 can run in parallel after T014.
- In US2, T023 and T024 can run in parallel after T022.
- In US3, T030 and T031 can run in parallel after T029.
- T032, T033, and T034 can run in parallel in Phase 6.

## Parallel Example: User Story 1

- Task: T015 [US1] Render comparison result card/table with recommendation highlight in storefront-widget/src/components/guidance/
- Task: T016 [US1] Add comparison stream reducer handling in storefront-widget/src/hooks/useStorefrontChat.ts

## Parallel Example: User Story 2

- Task: T023 [US2] Render actionable buttons for recommended and alternative options in storefront-widget/src/components/guidance/
- Task: T024 [US2] Submit comparison_select approvals and declines from widget hook in storefront-widget/src/hooks/useStorefrontChat.ts

## Parallel Example: User Story 3

- Task: T030 [US3] Render comparison error cards with recovery actions in storefront-widget/src/components/guidance/
- Task: T031 [US3] Update widget reducer for comparison.error rendering and dismissal in storefront-widget/src/hooks/useStorefrontChat.ts

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 and Phase 2.
2. Complete Phase 3 (US1).
3. Validate structured comparison rendering with recommendation rationale.
4. Demo MVP and checkpoint.

### Incremental Delivery

1. Ship US1 for comparison generation and rendering.
2. Add US2 for conversion from comparison to confirmed cart action.
3. Add US3 for robust invalid-input and stale-state handling.
4. Run Phase 6 polish and contract alignment.

### Parallel Team Strategy

1. Team aligns on Phase 1 and Phase 2 foundations.
2. Assign one contributor per user story phase (US1, US2, US3) once foundation is complete.
3. Rejoin for Phase 6 documentation and end-to-end validation.

## Notes

- [P] tasks use separate files and can execute concurrently.
- [USx] labels map each task to one independently testable user story.
- All tasks reference concrete repository paths to remain immediately executable.
- Keep comparisonContextId scope checks and approval/idempotency safeguards intact across follow-up actions.
- Implementation note (2026-06-02): Phase 1 setup tasks T001-T004 completed; product comparison schemas, stream part variants, and session-level comparison context interfaces are in place.
- Implementation note (2026-06-02): Phase 2 foundational tasks T005-T010 completed; comparison fetch helper, normalized result builder, stream event emission, and comparison_select confirmation payload handling are now wired.
- Implementation note (2026-06-02): Phase 3 user story tasks T011-T017 completed; compare request validation, richer comparison dimensions/recommendation logic, comparison stream reducer handling, recommendation-highlighted comparison table rendering, and latest comparison context visibility are implemented.
- Implementation note (2026-06-02): Phase 4 user story tasks T018-T025 completed; comparison follow-up actions are now proposed, selectable (recommended or alternatives), validated at confirmation time, and executed through the cart mutation adapter with normalized status outcomes.
- Implementation note (2026-06-02): Phase 5 user story tasks T026-T031 completed; comparison validation errors, unresolved/unavailable mappings, retry guidance, stale-state recovery in confirmation, and widget-side comparison error rendering/dismissal are now implemented.
