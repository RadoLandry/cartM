# Tasks: Chat Interface (Storefront Widget)

**Input**: Design documents from `/specs/014-storefront-chat-widget/`  
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Include unit and integration tests because the plan explicitly requires Vitest coverage for bootstrap validation, streaming-route behavior, chat session state, and structured guidance rendering.

**Organization**: Tasks are grouped by user story so each story can be implemented and validated independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this belongs to (e.g. `US1`, `US2`)
- Every task includes an exact file path

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create the scaffolding needed for the storefront widget package, extension delivery, and focused test fixtures.

- [X] T001 Create storefront chat fixture builders for bootstrap, stream payloads, and widget state in tests/helpers/storefront-chat-fixtures.ts
- [X] T002 Add storefront chat dependencies and widget package manifest in package.json and storefront-widget/package.json
- [X] T003 [P] Add widget build configuration and extension asset entry points in storefront-widget/vite.config.ts and extensions/cart-drawer-block/assets/cartmind-chat.js

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core shared infrastructure that MUST be complete before any user story can be implemented.

**⚠️ CRITICAL**: No user story work should begin until this phase is complete.

- [X] T004 Add shared storefront chat schemas and typed guidance contracts in app/lib/ai/schemas.ts
- [X] T005 Add cart-chat prompt scaffolding and server orchestration base in app/lib/ai/prompts.ts and app/lib/ai/storefront-chat.ts
- [X] T006 [P] Add Shopify app-proxy signature and signed stream-token helpers in app/lib/shopify/app-proxy.ts
- [X] T007 [P] Create route test scaffolds for bootstrap and stream contracts in tests/integration/routes/storefront-chat-bootstrap.test.ts and tests/integration/routes/storefront-chat-stream.test.ts
- [X] T008 [P] Create storefront state and guidance-model test scaffolds in tests/unit/storefront/chat-session-state.test.ts and tests/unit/storefront/chat-guidance-model.test.ts
- [X] T009 Add bootstrap and streaming route shells in app/routes/api.app-proxy.chat-bootstrap.tsx and app/routes/api.ai.chat.tsx
- [X] T010 Add storefront transport hooks and chat shell scaffolding in storefront-widget/src/hooks/useStorefrontChat.ts, storefront-widget/src/hooks/useChatSessionState.ts, storefront-widget/src/components/ChatPanel.tsx, storefront-widget/src/components/ChatMessageList.tsx, and storefront-widget/src/components/ChatComposer.tsx

**Checkpoint**: Foundation ready. User stories can now proceed independently.

---

## Phase 3: User Story 1 - Ask For Help Without Leaving the Cart (Priority: P1) 🎯 MVP

**Goal**: Let shoppers open chat inside the cart, bootstrap a secure session, submit a question, and see the conversation continue without leaving the cart.

**Independent Test**: Open the cart drawer or cart page, launch the chat panel, send a shopper question, and verify that bootstrap, submit, in-progress state, and same-session reopen behavior all work without redirecting away from the cart.

### Tests for User Story 1

- [X] T011 [P] [US1] Add bootstrap route validation and token issuance tests in tests/integration/routes/storefront-chat-bootstrap.test.ts
- [X] T012 [P] [US1] Add session open, close, and reopen continuity tests in tests/unit/storefront/chat-session-state.test.ts

### Implementation for User Story 1

- [X] T013 [US1] Implement bootstrap request validation and token issuance in app/lib/shopify/app-proxy.ts and app/routes/api.app-proxy.chat-bootstrap.tsx
- [X] T014 [US1] Implement chat session reducer and same-session persistence in storefront-widget/src/hooks/useChatSessionState.ts
- [X] T015 [US1] Implement the open, collapse, and submit shell in storefront-widget/src/components/ChatPanel.tsx and storefront-widget/src/components/ChatComposer.tsx
- [X] T016 [US1] Implement message thread rendering and shopper submit flow in storefront-widget/src/components/ChatMessageList.tsx and storefront-widget/src/hooks/useStorefrontChat.ts
- [X] T017 [US1] Mount the chat entry point in cart drawer and cart page surfaces via storefront-widget/src/CartMindChat.tsx and extensions/cart-drawer-block/blocks/ai-cart.liquid

**Checkpoint**: User Story 1 should now provide an independently testable in-cart chat entry point and shopper message flow.

---

## Phase 4: User Story 2 - Receive Clear, Structured Shopping Guidance (Priority: P1)

**Goal**: Stream assistant replies that can include typed recommendation, comparison, size, and fallback guidance blocks inside the conversation thread.

**Independent Test**: Submit chat prompts that should return recommendation, comparison, and sizing help, then verify that the stream completes and the thread renders structured guidance inline with the assistant message.

### Tests for User Story 2

- [X] T018 [P] [US2] Add streaming route tests for text deltas, message completion, and typed guidance blocks in tests/integration/routes/storefront-chat-stream.test.ts
- [X] T019 [P] [US2] Add guidance-model tests for recommendation, comparison, size, and fallback rendering in tests/unit/storefront/chat-guidance-model.test.ts

### Implementation for User Story 2

- [X] T020 [US2] Implement typed guidance block schemas and prompt contracts in app/lib/ai/schemas.ts and app/lib/ai/prompts.ts
- [X] T021 [US2] Implement cart-aware chat orchestration and guidance block shaping in app/lib/ai/storefront-chat.ts and app/lib/cart-intelligence/recommendations.ts
- [X] T022 [US2] Implement authenticated streaming chat responses in app/routes/api.ai.chat.tsx
- [X] T023 [P] [US2] Create structured guidance renderers in storefront-widget/src/components/guidance/RecommendationList.tsx, storefront-widget/src/components/guidance/ComparisonTable.tsx, storefront-widget/src/components/guidance/SizeSummary.tsx, and storefront-widget/src/components/guidance/FallbackNotice.tsx
- [X] T024 [US2] Wire streamed assistant parts and structured guidance blocks into the thread UI in storefront-widget/src/hooks/useStorefrontChat.ts and storefront-widget/src/components/ChatMessageList.tsx

**Checkpoint**: User Story 2 should now provide independently testable structured shopping guidance within the chat thread.

---

## Phase 5: User Story 3 - Keep the Cart Usable While Chat Is Open (Priority: P2)

**Goal**: Keep the chat unobtrusive across cart drawer and cart page layouts, including mobile, retry, and reopen flows.

**Independent Test**: Open, collapse, close, reopen, and retry chat interactions on desktop and narrow viewport cart surfaces, then verify that the cart remains usable and the shopper can continue checkout without losing recent context.

### Tests for User Story 3

- [X] T025 [P] [US3] Extend session-state tests for close/reopen continuity, duplicate submit guards, and retry flows in tests/unit/storefront/chat-session-state.test.ts
- [X] T026 [P] [US3] Extend streaming route tests for expired tokens and recoverable chat failures in tests/integration/routes/storefront-chat-stream.test.ts

### Implementation for User Story 3

- [X] T027 [US3] Implement responsive panel layout and non-blocking cart overlay behavior in storefront-widget/src/components/ChatPanel.tsx and storefront-widget/src/styles/chat.css
- [X] T028 [US3] Implement retry, expired-session recovery, and duplicate-request suppression in storefront-widget/src/hooks/useStorefrontChat.ts and storefront-widget/src/hooks/useChatSessionState.ts
- [X] T029 [US3] Preserve cart-surface usability and re-entry behavior in storefront-widget/src/CartMindChat.tsx and extensions/cart-drawer-block/blocks/ai-cart.liquid

**Checkpoint**: User Story 3 should now provide independently testable responsive, recoverable, and unobtrusive chat behavior.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Finalize build output wiring, documentation, and end-to-end validation across the implemented stories.

- [X] T030 [P] Finalize theme asset build output wiring in storefront-widget/vite.config.ts and extensions/cart-drawer-block/assets/cartmind-chat.js
- [X] T031 [P] Update validation notes and final examples in specs/014-storefront-chat-widget/quickstart.md and specs/014-storefront-chat-widget/contracts/storefront-chat-stream.md
- [X] T032 Run storefront chat validation scenarios in tests/integration/routes/storefront-chat-bootstrap.test.ts, tests/integration/routes/storefront-chat-stream.test.ts, tests/unit/storefront/chat-session-state.test.ts, and tests/unit/storefront/chat-guidance-model.test.ts

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies.
- **Foundational (Phase 2)**: Depends on Setup completion and blocks all user stories.
- **User Stories (Phases 3-5)**: All depend on Foundational completion.
- **Polish (Phase 6)**: Depends on all desired user stories being complete.

### User Story Dependencies

- **User Story 1 (P1)**: Starts after Foundational and is the MVP slice for secure bootstrap plus in-cart message flow.
- **User Story 2 (P1)**: Starts after Foundational and builds typed structured guidance on top of the chat transport while remaining independently testable.
- **User Story 3 (P2)**: Starts after Foundational and adds responsive shell, retry behavior, and non-blocking cart usability.

### Recommended Delivery Order

- **MVP**: Phase 1 → Phase 2 → Phase 3 (US1)
- **Next**: Phase 4 (US2)
- **Then**: Phase 5 (US3)
- **Finally**: Phase 6 (Polish)

### Within Each User Story

- Tests should be written before or alongside implementation and must fail before the story is considered complete.
- Route validation and token/session plumbing should land before UI flows that depend on them.
- Server-side guidance shaping should precede client-side rich rendering for the same story.
- Each story should be validated independently before moving to the next priority.

---

## Parallel Opportunities

- `T003` can run in parallel with `T001` and `T002` after the feature directory is in place.
- `T006`, `T007`, and `T008` can run in parallel during the Foundational phase.
- `T011` and `T012` can run in parallel for US1.
- `T018` and `T019` can run in parallel for US2.
- `T023` can run in parallel with `T022` once the guidance contracts are stable.
- `T025` and `T026` can run in parallel for US3.
- `T030` and `T031` can run in parallel during Polish.

---

## Parallel Example: User Story 1

```bash
# Launch the US1 test tasks together:
Task: "Add bootstrap route validation and token issuance tests in tests/integration/routes/storefront-chat-bootstrap.test.ts"
Task: "Add session open, close, and reopen continuity tests in tests/unit/storefront/chat-session-state.test.ts"
```

## Parallel Example: User Story 2

```bash
# Launch the US2 test and renderer tasks together:
Task: "Add streaming route tests for text deltas, message completion, and typed guidance blocks in tests/integration/routes/storefront-chat-stream.test.ts"
Task: "Add guidance-model tests for recommendation, comparison, size, and fallback rendering in tests/unit/storefront/chat-guidance-model.test.ts"
Task: "Create structured guidance renderers in storefront-widget/src/components/guidance/RecommendationList.tsx, storefront-widget/src/components/guidance/ComparisonTable.tsx, storefront-widget/src/components/guidance/SizeSummary.tsx, and storefront-widget/src/components/guidance/FallbackNotice.tsx"
```

## Parallel Example: User Story 3

```bash
# Launch the US3 test tasks together:
Task: "Extend session-state tests for close/reopen continuity, duplicate submit guards, and retry flows in tests/unit/storefront/chat-session-state.test.ts"
Task: "Extend streaming route tests for expired tokens and recoverable chat failures in tests/integration/routes/storefront-chat-stream.test.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup.
2. Complete Phase 2: Foundational.
3. Complete Phase 3: User Story 1.
4. Validate the in-cart chat entry point independently before expanding scope.

### Incremental Delivery

1. Deliver US1 for secure chat bootstrap and in-cart messaging.
2. Add US2 for structured shopping guidance.
3. Add US3 for responsive, unobtrusive, and recoverable chat behavior.
4. Finish with polish and quickstart validation.

### Parallel Team Strategy

1. One developer handles route security and chat orchestration in app/lib/shopify/app-proxy.ts, app/lib/ai/storefront-chat.ts, and the new route files.
2. One developer handles storefront widget state and thread UI in storefront-widget/src/hooks/ and storefront-widget/src/components/.
3. One developer handles theme delivery and validation in storefront-widget/vite.config.ts, extensions/cart-drawer-block/, and the focused Vitest suites.
4. Merge by story checkpoint rather than by file ownership alone.

---

## Notes

- All tasks follow the required checklist format.
- Story labels appear only in user story phases.
- `[P]` is used only for tasks that can run in parallel without depending on the same incomplete slice.
- Each user story includes an independent validation target aligned with the specification and quickstart.