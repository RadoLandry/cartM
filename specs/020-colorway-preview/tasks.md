# Tasks: Colorway Preview

**Input**: Design documents from `/specs/020-colorway-preview/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/

**Tests**: No separate test tasks are included because the feature spec does not explicitly request TDD/test-first tasks.

**Organization**: Tasks are grouped by user story so each story remains independently implementable and testable.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no blocking dependency)
- **[Story]**: User story label ([US1], [US2], [US3])
- Every task includes an exact file path

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create feature scaffolding and shared module boundaries.

- [x] T001 Create colorway preview orchestrator scaffold in app/lib/visual/colorway-preview.ts
- [x] T002 [P] Create signature utility scaffold in app/lib/visual/colorway-signature.ts
- [x] T003 [P] Create shared contract/type definitions in app/lib/visual/colorway-preview.types.ts

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core request validation, normalization, and route wiring required before story work.

**CRITICAL**: No user story implementation starts until this phase is complete.

- [x] T004 Implement request payload validation and parsing in app/lib/visual/colorway-preview.types.ts
- [x] T005 [P] Implement cart line resolution helpers for selected/proposed variants in app/lib/shopify/cart.ts
- [x] T006 Implement deterministic normalization and preview signature generation in app/lib/visual/colorway-signature.ts
- [x] T007 [P] Implement shared response-state mapper (ok/partial/invalid/fallback/error) in app/lib/visual/colorway-preview.ts
- [x] T008 Wire route entry to orchestrator and runtime-safe error boundaries in app/routes/api.ai.kit-preview.tsx

**Checkpoint**: Foundation complete. User story phases can begin.

---

## Phase 3: User Story 1 - Compare Current vs Proposed Look (Priority: P1) MVP

**Goal**: Produce a side-by-side current vs proposed colorway comparison with clear changed-item context.

**Independent Test**: Request a valid swap for a cart line and verify both current/proposed visuals plus changed-item labeling are returned.

### Implementation for User Story 1

- [x] T009 [P] [US1] Implement current/proposed comparison composition pipeline in app/lib/visual/compositor.ts
- [x] T010 [P] [US1] Implement changed-item highlight builder in app/lib/visual/colorway-preview.ts
- [x] T011 [US1] Implement successful comparison assembly (comparison + change + context) in app/lib/visual/colorway-preview.ts
- [x] T012 [US1] Return side-by-side comparison payload from endpoint in app/routes/api.ai.kit-preview.tsx
- [x] T013 [P] [US1] Add storefront hook support for comparison payload consumption in storefront-widget/src/hooks/useStorefrontChat.ts
- [x] T014 [US1] Render current/proposed card with changed-label indicator in storefront-widget/src/components/chat/ColorwayPreviewCard.tsx

**Checkpoint**: US1 delivers complete MVP comparison flow.

---

## Phase 4: User Story 2 - Preserve Trust During Partial Data Gaps (Priority: P2)

**Goal**: Keep previews useful and explicit when data is incomplete or invalid.

**Independent Test**: Trigger preview with missing media or invalid swap and verify partial/invalid behavior is explicit and non-breaking.

### Implementation for User Story 2

- [ ] T015 [P] [US2] Implement omission reason classification for missing/unsupported/fetch-failed assets in app/lib/visual/colorway-preview.ts
- [ ] T016 [P] [US2] Implement fallback layout strategy for mixed-discipline and non-composable carts in app/lib/visual/templates.ts
- [ ] T017 [US2] Add invalid-request guards (same variant, unavailable variant, missing line) in app/routes/api.ai.kit-preview.tsx
- [ ] T018 [US2] Map partial/invalid/fallback response states to endpoint contract fields in app/lib/visual/colorway-preview.ts
- [ ] T019 [US2] Render shopper-safe partial and invalid state messaging in storefront-widget/src/components/chat/ColorwayPreviewCard.tsx

**Checkpoint**: US2 adds resilient degraded behavior without breaking US1.

---

## Phase 5: User Story 3 - Fast Iteration on Alternate Swaps (Priority: P3)

**Goal**: Speed up repeat preview interactions through deterministic reuse.

**Independent Test**: Repeat identical preview requests and confirm reuse path and faster response behavior.

### Implementation for User Story 3

- [ ] T020 [P] [US3] Implement preview reuse lookup/store adapter in app/lib/visual/colorway-preview-cache.ts
- [ ] T021 [P] [US3] Extend signature inputs with selected line + proposed variant + template version in app/lib/visual/colorway-signature.ts
- [ ] T022 [US3] Implement reuse-first orchestration (lookup before compose) in app/lib/visual/colorway-preview.ts
- [ ] T023 [US3] Add forceRegenerate and reused metadata response handling in app/routes/api.ai.kit-preview.tsx
- [ ] T024 [US3] Surface reused state in storefront preview consumption flow in storefront-widget/src/hooks/useStorefrontChat.ts

**Checkpoint**: US3 completes iterative performance optimization with deterministic reuse.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final alignment, hardening, and scenario validation across all stories.

- [ ] T025 [P] Align quickstart validation steps with implemented payload fields in specs/020-colorway-preview/quickstart.md
- [ ] T026 [P] Run and document end-to-end scenario validation notes in specs/020-colorway-preview/quickstart.md
- [ ] T027 Harden route logging to capture preview outcome analytics without sensitive payload leakage in app/routes/api.ai.kit-preview.tsx
- [ ] T028 Validate implementation notes and contract consistency in specs/020-colorway-preview/contracts/colorway-preview-endpoint.md

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: Can start immediately.
- **Phase 2 (Foundational)**: Depends on Phase 1 and blocks all user stories.
- **Phase 3 (US1)**: Starts after Phase 2; establishes MVP.
- **Phase 4 (US2)**: Starts after Phase 2; can run in parallel with US3 after US1 contract surface is stable.
- **Phase 5 (US3)**: Starts after Phase 2; depends on orchestration introduced in US1.
- **Phase 6 (Polish)**: Starts after target user stories are complete.

### User Story Dependencies

- **US1 (P1)**: No dependency on other user stories; required MVP slice.
- **US2 (P2)**: Depends on US1 comparison payload shape for degraded-state mapping.
- **US3 (P3)**: Depends on US1 composition flow and Phase 2 signature utilities.

### Within Each User Story

- Core data and helper tasks first.
- Orchestration and endpoint mapping second.
- Storefront display/hook updates after backend response is stable.

### Parallel Opportunities

- **Setup**: T002 and T003 can run in parallel after T001 starts scaffolding.
- **Foundational**: T005 and T007 can run in parallel after T004 boundaries are clear.
- **US1**: T009, T010, and T013 can run in parallel.
- **US2**: T015 and T016 can run in parallel.
- **US3**: T020 and T021 can run in parallel.
- **Polish**: T025 and T026 can run in parallel.

---

## Parallel Example: User Story 1

```bash
Task: "T009 [US1] Implement current/proposed comparison composition pipeline in app/lib/visual/compositor.ts"
Task: "T010 [US1] Implement changed-item highlight builder in app/lib/visual/colorway-preview.ts"
Task: "T013 [US1] Add storefront hook support for comparison payload consumption in storefront-widget/src/hooks/useStorefrontChat.ts"
```

## Parallel Example: User Story 2

```bash
Task: "T015 [US2] Implement omission reason classification in app/lib/visual/colorway-preview.ts"
Task: "T016 [US2] Implement fallback layout strategy in app/lib/visual/templates.ts"
```

## Parallel Example: User Story 3

```bash
Task: "T020 [US3] Implement preview reuse lookup/store adapter in app/lib/visual/colorway-preview-cache.ts"
Task: "T021 [US3] Extend signature inputs in app/lib/visual/colorway-signature.ts"
```

---

## Implementation Strategy

### MVP First (US1 only)

1. Complete Phase 1 and Phase 2.
2. Complete Phase 3 (US1).
3. Validate side-by-side preview behavior with a valid swap.
4. Demo/deploy MVP if stable.

### Incremental Delivery

1. Deliver US1 for core comparison value.
2. Add US2 for resilience and trust under imperfect catalog data.
3. Add US3 for fast iterative experimentation.
4. Finish with Phase 6 hardening and documentation sync.

### Parallel Team Strategy

1. Team aligns on Phase 1/2 foundations.
2. After foundations:
   - Developer A: US1 composition and endpoint payload
   - Developer B: US2 degraded-state/fallback behavior
   - Developer C: US3 reuse and signature optimization
3. Rejoin for Phase 6 polish and validation.

---

## Notes

- [P] tasks are parallelizable when dependencies are met.
- [USx] labels preserve traceability back to spec priorities.
- Keep preview flow read-only; no cart mutation side effects.
- Validate each story independently before moving to next priority.
