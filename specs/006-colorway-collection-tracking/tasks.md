# Tasks: Colorway & Collection Tracking

**Feature**: `006-colorway-collection-tracking`  
**Branch**: `006-size-fit-intelligence`  
**Input**: Design documents from `specs/006-colorway-collection-tracking/`  
**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/)

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no incomplete dependencies)
- **[Story]**: Which user story this task belongs to (US1–US3)
- Exact file paths included in every task

---

## Phase 1: Setup

**Purpose**: Add the database structures required for derived visual profiles and compatibility rules before any feature code is implemented.

- [X] T001 Add `ProductVisualProfile`, `ColorCompatibilityRule`, `VisualProfileSource`, `VisualReviewStatus`, and `ColorCompatibility` to `prisma/schema.prisma` per `specs/006-colorway-collection-tracking/data-model.md`
- [X] T002 Generate Prisma migration `add_colorway_collection_tracking` in `prisma/migrations/` and verify client regeneration from `prisma/schema.prisma`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared GraphQL, normalization, query helpers, and types required by all user stories.

**⚠️ CRITICAL**: No user story work can begin until Phase 1 and Phase 2 are complete.

- [X] T003 [P] Extend the product fragment in `app/lib/shopify/graphql.ts` and normalized collection metadata in `app/lib/knowledge-graph/normalization.ts` to carry collection `id`, `title`, and `handle`
- [X] T004 [P] Add Prisma query helpers for visual profiles and compatibility rules to `app/lib/db/queries.ts`: profile upsert/get/list helpers plus create/list/delete helpers for `ColorCompatibilityRule`
- [X] T005 [P] Define shared TypeScript types for visual profiles, admin rows, style reasons, and recommendation payloads in `app/lib/knowledge-graph/colorways.ts` and `app/lib/cart-intelligence/style-coherence.ts` per `specs/006-colorway-collection-tracking/contracts/`

**Checkpoint**: Schema, GraphQL inputs, shared queries, and shared types are ready; user stories can now proceed.

---

## Phase 3: User Story 1 — Maintain Visual Product Data (Priority: P1) 🎯 MVP

**Goal**: Merchants can rely on auto-generated visual profiles, review low-confidence products, and save per-product corrections that persist across re-syncs.

**Independent Test**: Run `npx vitest run tests/unit/knowledge-graph/colorways.test.ts` and `npx vitest run tests/integration/routes/knowledge-graph-colorways.test.ts` to verify profile derivation, override precedence, low-confidence review ordering, and save/reset override actions.

### Tests for User Story 1

- [X] T006 [P] [US1] Extend `tests/unit/knowledge-graph/colorways.test.ts` to cover deterministic palette fallback, token-based colorway normalization, collection summary mapping, confidence scoring, and override precedence in `app/lib/knowledge-graph/colorways.ts`
- [X] T007 [P] [US1] Add loader and action integration coverage for low-confidence profile review in `tests/integration/routes/knowledge-graph-colorways.test.ts` covering `save-visual-override` and `reset-visual-override` in `app/routes/app.knowledge-graph.tsx`

### Implementation for User Story 1

- [X] T008 [US1] Implement normalized palette extraction, colorway token parsing, confidence scoring, and effective profile resolution in `app/lib/knowledge-graph/colorways.ts`
- [X] T009 [US1] Extend sync processing in `app/lib/knowledge-graph/ingestion.ts` to build or refresh `ProductVisualProfile` rows from products, variants, tags, metafields, and collections without overwriting merchant overrides
- [X] T010 [P] [US1] Create the catalog rebuild command in `scripts/backfill-colorway-profiles.ts` using the shared profile derivation logic from `app/lib/knowledge-graph/colorways.ts` and product reads from `app/lib/db/queries.ts`
- [X] T011 [US1] Extend the loader and implement `save-visual-override` and `reset-visual-override` action intents with Zod validation in `app/routes/app.knowledge-graph.tsx`
- [X] T012 [US1] Build the Polaris `Colorways` review tab UI in `app/routes/app.knowledge-graph.tsx` to list low-confidence products, detected versus effective colorways, collection labels, and merchant correction controls

**Checkpoint**: Merchants can review and correct product visual profiles, and those corrections survive sync/backfill operations.

---

## Phase 4: User Story 2 — Suggest Visually Coherent Carts (Priority: P2)

**Goal**: The cart intelligence layer scores visual coherence and returns explainable collection-completion or swap suggestions without recommending unavailable options.

**Independent Test**: Run `npx vitest run tests/unit/cart-intelligence/style-coherence.test.ts` to verify cohesive carts suppress unnecessary suggestions, matching collections trigger add recommendations, clashing carts trigger swap recommendations, and unavailable variants are excluded.

### Tests for User Story 2

- [X] T013 [P] [US2] Add deterministic scorer tests in `tests/unit/cart-intelligence/style-coherence.test.ts` covering cohesive carts, collection-completion suggestions, swap suggestions, low-confidence mixed carts, and unavailable candidate exclusion for `app/lib/cart-intelligence/style-coherence.ts`

### Implementation for User Story 2

- [X] T014 [US2] Implement `scoreStyleCoherence()` and structured `StyleCoherenceResult` generation in `app/lib/cart-intelligence/style-coherence.ts` per `specs/006-colorway-collection-tracking/contracts/style-coherence.md`
- [X] T015 [US2] Extend collection and colorway evidence handling in `app/lib/knowledge-graph/relationships.ts` to use effective collection data from visual profiles and optional `COLORWAY` evidence when available
- [X] T016 [US2] Extend shopper-facing visual recommendation orchestration in `app/lib/cart-intelligence/recommendations.ts` to emit `collection_completion` and `swap` payloads matching `specs/006-colorway-collection-tracking/contracts/visual-recommendations.md`

**Checkpoint**: Shopper-facing visual recommendations are explainable, deterministic, and independently testable from the cart-intelligence layer.

---

## Phase 5: User Story 3 — Preserve Merchant Control Over Visual Merchandising (Priority: P3)

**Goal**: Merchants can define compatibility rules and control how colorway and collection overrides influence downstream cart suggestions.

**Independent Test**: Run `npx vitest run tests/integration/routes/knowledge-graph-colorways.test.ts` to verify compatibility-rule create/delete flows, Zod validation failures, and override precedence over auto-derived colorway matches.

### Tests for User Story 3

- [X] T017 [P] [US3] Extend `tests/integration/routes/knowledge-graph-colorways.test.ts` to cover `save-compatibility-rule`, `delete-compatibility-rule`, duplicate-rule rejection, and merchant override precedence over auto-derived matches in `app/routes/app.knowledge-graph.tsx`

### Implementation for User Story 3

- [X] T018 [P] [US3] Add `ColorCompatibilityRule` persistence helpers and rule-resolution helpers to `app/lib/db/queries.ts` and `app/lib/knowledge-graph/colorways.ts`
- [X] T019 [US3] Implement `save-compatibility-rule` and `delete-compatibility-rule` action intents with Zod validation and duplicate handling in `app/routes/app.knowledge-graph.tsx`
- [X] T020 [US3] Extend the Polaris `Colorways` tab UI in `app/routes/app.knowledge-graph.tsx` with compatibility-rule management, rationale entry, and precedence messaging for merchant overrides

**Checkpoint**: Merchant-defined compatibility behavior takes precedence where intended and remains independently manageable from the admin surface.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final validation, documentation alignment, and quality gates across all stories.

- [X] T021 [P] Update implementation notes and operator steps in `specs/006-colorway-collection-tracking/quickstart.md` to match the final migration, backfill command, and focused test suite
- [X] T022 Run `npx tsc --noEmit` and the focused Vitest suites for `tests/unit/knowledge-graph/colorways.test.ts`, `tests/unit/cart-intelligence/style-coherence.test.ts`, and `tests/integration/routes/knowledge-graph-colorways.test.ts`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies; starts immediately.
- **Foundational (Phase 2)**: Depends on Setup completion and blocks all user stories.
- **User Story 1 (Phase 3)**: Starts after Foundational and delivers the MVP data foundation.
- **User Story 2 (Phase 4)**: Starts after Foundational and depends on US1 visual profiles being available for realistic cart analysis.
- **User Story 3 (Phase 5)**: Starts after Foundational and builds on US1 admin review plus US2 rule consumption.
- **Polish (Phase 6)**: Depends on all desired user stories being complete.

### User Story Dependencies

- **US1 (P1)**: No dependency on other user stories; this is the MVP slice.
- **US2 (P2)**: Depends on US1 because effective visual profiles are the scorer input.
- **US3 (P3)**: Depends on US1 for the admin colorways surface and on US2 for recommendation precedence behavior.

### Within Each User Story

- Tests are listed first and should fail before implementation is considered done.
- Shared derivation logic comes before route/UI wiring.
- Route actions come before the final admin UI interactions that invoke them.
- Recommendation payload mapping comes after scorer behavior is stable.

## Dependency Graph

```text
T001 → T002 → T003, T004, T005
             ↓
       T003, T004, T005 complete
             ↓
       T006, T007, T008, T009, T010, T011, T012 (US1)
             ↓
                  US1 complete
             ↓
               T013, T014, T015, T016 (US2)
             ↓
                  US2 complete
             ↓
               T017, T018, T019, T020 (US3)
             ↓
               T021, T022 (Polish)
```

## Parallel Opportunities

- T003, T004, and T005 can run in parallel once the migration is prepared.
- T006 and T007 can run in parallel with T008 and T010 because they touch separate files.
- T013 can run in parallel with T015 because tests and relationship integration touch different files.
- T017 and T018 can run in parallel before T019 and T020 wire the admin route and UI.

## Parallel Example: User Story 1

```text
Developer A: T006 in tests/unit/knowledge-graph/colorways.test.ts
Developer B: T007 in tests/integration/routes/knowledge-graph-colorways.test.ts
Developer C: T010 in scripts/backfill-colorway-profiles.ts
```

## Parallel Example: User Story 2

```text
Developer A: T013 in tests/unit/cart-intelligence/style-coherence.test.ts
Developer B: T015 in app/lib/knowledge-graph/relationships.ts
```

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 and Phase 2.
2. Complete Phase 3 (US1).
3. Validate merchant review and override persistence independently.
4. Stop and demo the visual-profile workflow before moving to cart suggestions.

### Incremental Delivery

1. Deliver US1 to establish trustworthy visual data.
2. Add US2 to surface shopper-facing style suggestions.
3. Add US3 to give merchants final control over merchandising nuance.
4. Finish with Phase 6 validation and quickstart alignment.

### Suggested MVP Scope

Phases 1–3 (T001–T012) are the MVP. They deliver the highest-priority merchant value by generating visual profiles, exposing low-confidence review, and preserving merchant overrides for later recommendation work.