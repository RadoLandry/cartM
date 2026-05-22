# Tasks: Size & Fit Intelligence

**Feature**: `005-size-fit-intelligence`  
**Branch**: `005-size-fit-intelligence`  
**Input**: Design documents from `specs/005-size-fit-intelligence/`  
**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/)

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no incomplete dependencies)
- **[Story]**: Which user story this task belongs to (US1–US5)
- Exact file paths included in every task

---

## Phase 1: Setup

**Purpose**: Extend the Prisma schema with the three new models and generate the migration. No user story work can start until these tasks are complete.

- [X] T001 Add `SizeChart`, `CrossSizeMapping`, `SizeReturnRecord` models and `SizeChartSource`, `SizeConflictSeverity` enums to `prisma/schema.prisma` per `data-model.md`
- [X] T002 Generate Prisma migration `add_size_fit_intelligence` and verify client regenerates cleanly (`npx prisma migrate dev --name add_size_fit_intelligence`)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared query helpers, TypeScript interfaces, and seed data that every user story phase requires. All tasks in this phase are independent of each other.

**⚠️ CRITICAL**: No user story work can begin until Phase 1 and Phase 2 are complete.

- [X] T003 [P] Add `SizeChart` and `CrossSizeMapping` Prisma query helpers to `app/lib/db/queries.ts`: `getSizeChartForCategory(shop, categoryTag, sizeSystem)`, `getCrossSizeMappingsForPair(shop, catA, catB)`, `upsertSizeChart(data)`, `saveSizeChartOverride(id, breakpoints)`, `resetSizeChartOverride(id)`, `createCrossSizeMapping(data)`, `deleteCrossSizeMapping(id)`
- [X] T004 [P] Define all shared TypeScript interfaces in `app/lib/knowledge-graph/sizing.ts`: `SizeBreakpoint`, `SizeRecommendationRequest`, `SizeRecommendationResult`, `CartItemForConflict`, `SizeConflictRequest`, `SizeConflictResult`, `SizeConflict` per `contracts/size-recommendation.md` and `contracts/size-conflict-detection.md`
- [X] T005 [P] Create `scripts/seed-size-charts.ts` seeding boxing gloves oz chart (8–12oz youth, 14oz light, 16oz standard, 18oz heavy), apparel S/M/L/XL clothing chart (chest cm breakpoints), shorts waist chart (inch breakpoints), and standard adult cross-size mappings (`clothing ↔ clothing`, `shorts_waist ↔ clothing`, adult vs child ERROR pairs)

**Checkpoint**: Migration applied, query helpers available, interfaces defined, seed data ready — user story phases can now proceed in parallel

---

## Phase 3: User Story 1 — Customer Receives Size Recommendation (Priority: P1) 🎯 MVP

**Goal**: `getSizeRecommendation()` returns a size label and rationale given customer body attributes or a known size from their profile. Works independently of all other user stories.

**Independent Test**: Run `npx vitest run tests/unit/knowledge-graph/sizing.test.ts` — all four resolution paths (profile hit, chart lookup, boundary case, no chart → null) pass.

- [X] T006 [US1] Implement `getSizeRecommendation(request: SizeRecommendationRequest): Promise<SizeRecommendationResult>` in `app/lib/knowledge-graph/sizing.ts` — step 1: return `knownSizes[categoryTag]` with `source:"profile"` if present; step 2: load `SizeChart` via `getSizeChartForCategory`, apply `overrideBreakpoints` when non-null, binary-search breakpoints for matching customer attribute; step 3: return `{ recommended: null, source: "none" }` when neither is available; return larger size at boundary with `confidence:"medium"`
- [X] T007 [P] [US1] Write unit tests for `getSizeRecommendation()` in `tests/unit/knowledge-graph/sizing.test.ts` covering: profile hit returns `confidence:"high"` and `source:"profile"`; chart lookup returns correct size label; boundary falls to larger size with `confidence:"medium"`; missing chart returns `null` with `source:"none"`; `overrideBreakpoints` takes precedence over `breakpoints`

**Checkpoint**: `getSizeRecommendation()` fully functional and tested independently

---

## Phase 4: User Story 2 — Cart Size Conflict Warning (Priority: P1)

**Goal**: `detectSizeConflicts()` returns a typed list of conflicts with severity (WARNING/ERROR) for any set of cart items. Independent of User Story 1 — touches only different files.

**Independent Test**: Run `npx vitest run tests/unit/knowledge-graph/size-conflicts.test.ts` — medium rashguard + XL shorts → WARNING; child headgear + adult gloves → ERROR; compatible sizes → empty array; single item → empty array; unmapped category pair → empty array.

- [X] T008 [P] [US2] Implement `detectSizeConflicts(request: SizeConflictRequest): Promise<SizeConflictResult>` in `app/lib/cart-intelligence/size-conflicts.ts` — iterate all distinct pairs of cart items with different `categoryTag`; load `CrossSizeMapping` via `getCrossSizeMappingsForPair`; emit `ERROR` if `isChildProduct` differs between items; emit `WARNING` if `targetSize` in mapping ≠ actual cart item size; return empty `conflicts` array for single-item or empty carts; do not emit conflict for unmapped category pairs
- [X] T009 [P] [US2] Write unit tests for `detectSizeConflicts()` in `tests/unit/knowledge-graph/size-conflicts.test.ts` covering: `isChildProduct` mismatch → ERROR with `hasErrors:true`; mapped size mismatch → WARNING with `hasWarnings:true`; all compatible sizes → empty array; single-item cart → empty array; pair with no `CrossSizeMapping` row → empty array; `suggestedCorrection` message is present on WARNING conflict

**Checkpoint**: Both US1 and US2 fully functional and independently testable — US3/US4 can now start

---

## Phase 5: User Story 3 — Merchant Configures Size Charts (Priority: P2)

**Goal**: The Size Charts tab in the knowledge-graph admin route lets merchants view, override, reset, and manage cross-size mappings. Depends on Phase 3 completing first so override effects on recommendations can be manually verified.

**Independent Test**: Run `npx vitest run tests/integration/routes/knowledge-graph-sizing.test.ts` — all four action intents create/update/delete correctly; loader returns `sizeCharts`, `crossSizeMappings`, `categoryTags`; saving override survives a subsequent `upsertSizeChart` call.

- [X] T010 [US3] Extend the loader in `app/routes/app.knowledge-graph.tsx` to return `sizeCharts` (all `SizeChart` rows for shop), `crossSizeMappings` (all `CrossSizeMapping` rows for shop), and `categoryTags` (distinct `sizeCategory` values from `ProductVariant` for the shop) per `contracts/merchant-size-chart-admin.md`
- [X] T011 [P] [US3] Implement `save-size-chart-override` action intent in `app/routes/app.knowledge-graph.tsx` — parse with Zod (non-empty `sizeChartId` string, non-empty `overrideBreakpoints` array with required `label`, `attributeType`, `min`, `max`); call `saveSizeChartOverride()`; return `{ ok: true }`
- [X] T012 [P] [US3] Implement `reset-size-chart-override` action intent in `app/routes/app.knowledge-graph.tsx` — parse with Zod (`sizeChartId` string); call `resetSizeChartOverride()`; return `{ ok: true }`
- [X] T013 [P] [US3] Implement `create-cross-size-mapping` action intent in `app/routes/app.knowledge-graph.tsx` — parse with Zod (all five fields required, `sourceCategoryTag ≠ targetCategoryTag`); call `createCrossSizeMapping()`; return `{ ok: true }` or `{ error: "duplicate" }` on unique constraint violation
- [X] T014 [P] [US3] Implement `delete-cross-size-mapping` action intent in `app/routes/app.knowledge-graph.tsx` — parse with Zod (`mappingId` string); call `deleteCrossSizeMapping()`; return `{ ok: true }`
- [X] T015 [US3] Build Polaris Size Charts tab UI in `app/routes/app.knowledge-graph.tsx`: `DataTable` listing size charts with category, sizeSystem, source badge, breakpoint count, "Override" and "Reset" actions; second `DataTable` for cross-size mappings with source/target/size/severity columns and "Delete" action; "Add mapping" `Modal` with `Select` and `TextField` inputs; all actions use Remix `useFetcher` with Polaris `Toast` for feedback
- [X] T016 [P] [US3] Write integration tests for all four admin action intents in `tests/integration/routes/knowledge-graph-sizing.test.ts` — authenticated request for each intent; verify DB state after each action; verify Zod rejects invalid inputs with 400; verify `reset` after `save` returns null `overrideBreakpoints`

**Checkpoint**: Merchant can fully manage size charts and cross-size mappings via the admin UI

---

## Phase 6: User Story 4 — Size Profile Persists Across Sessions (Priority: P2)

**Goal**: `getSizeRecommendation()` can pull from a persisted size profile for logged-in customers, eliminating re-entry of measurements on return visits.

**Independent Test**: Unit test confirms `knownSizes` input (step 1 of the resolution algorithm) returns `source:"profile"` and `confidence:"high"` — the profile-first path already exists in T006; this phase wires real persistence to it.

- [X] T017 [US4] Add `getSizeProfileForSession(shop, shopifyCustomerId?: string, sessionId?: string): Promise<Record<string, string>>` and `updateSizeProfile(shop, shopifyCustomerId?: string, sessionId?: string, updates: Record<string, string>): Promise<void>` helpers to `app/lib/db/queries.ts` — reads/writes `sizeProfile` JSON on `CustomerProfile` row when `shopifyCustomerId` is present; falls back to a session-scoped cookie key (via React Router session) for anonymous users
- [X] T018 [US4] Extend `getSizeRecommendation()` caller sites to supply `knownSizes` from `getSizeProfileForSession()` and call `updateSizeProfile()` when a recommendation is confirmed by the user — update the function signature in `app/lib/knowledge-graph/sizing.ts` if needed and wire to the helpers from T017
- [X] T019 [P] [US4] Add unit tests for profile-first resolution in `tests/unit/knowledge-graph/sizing.test.ts`: populated `knownSizes` returns `source:"profile"` regardless of chart presence; empty `knownSizes` falls through to chart lookup as per existing tests

**Checkpoint**: Returning logged-in customers receive pre-populated recommendations; anonymous users retain sizes within a session

---

## Phase 7: User Story 5 — Return Data Improves Recommendations (Priority: P3)

**Goal**: Processing batches of `SizeReturnRecord` rows statistically adjusts `SizeChart.breakpoints` for categories with sufficient return signal.

**Independent Test**: Run `npx vitest run tests/unit/knowledge-graph/sizing.test.ts` — fixture with 10+ "too_small" return records for `clothing/M` shifts the M breakpoint max down; fixture with 5 records (below threshold) leaves chart unchanged; category with `overrideBreakpoints` present is skipped.

- [X] T020 [P] [US5] Add `SizeReturnRecord` query helpers to `app/lib/db/queries.ts`: `insertSizeReturnRecord(data)` and `getUnprocessedReturnsByCategoryForShop(shop): Promise<Map<string, SizeReturnRecord[]>>`
- [X] T021 [P] [US5] Implement `adjustSizeChartFromReturns(shop: string, minSamples = 10): Promise<void>` in `app/lib/knowledge-graph/sizing.ts` — call `getUnprocessedReturnsByCategoryForShop()`; for each category with count ≥ `minSamples`, calculate direction (too_small/too_large ratio) and shift breakpoint boundaries by one step; skip categories where `overrideBreakpoints` is non-null; mark processed records (`processedForAdjustment = true`) in a single transaction
- [X] T022 [US5] Create `scripts/run-size-chart-adjustment.ts` accepting `--shop <domain>` flag; call `adjustSizeChartFromReturns()`; print summary of adjusted categories and skipped categories to stdout
- [X] T023 [P] [US5] Write unit tests for `adjustSizeChartFromReturns()` in `tests/unit/knowledge-graph/sizing.test.ts`: ≥ `minSamples` "too_small" returns → breakpoints shift larger; < `minSamples` → no change; `overrideBreakpoints` present → skipped; processed records are marked after run

**Checkpoint**: Return-data adjustment pipeline complete and independently testable

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Wire exports, verify strict TypeScript, and ensure downstream consumers can use the new functions.

- [X] T024 [P] Re-export `detectSizeConflicts` from `app/lib/knowledge-graph/sizing.ts` (or create a barrel export) so the cart intelligence orchestrator (`app/lib/cart-intelligence/recommendations.ts`) can import it from the knowledge-graph module per the PRD module interface
- [X] T025 Run `npx tsc --noEmit` across the workspace and fix any strict-mode type errors introduced in new files (`sizing.ts`, `size-conflicts.ts`, `queries.ts`, migration types)

---

## Dependency Graph

```
T001 → T002 → T003, T004, T005 (all parallel)
             ↓
     T003, T004, T005 complete
             ↓
     T006, T007 (US1, parallel pair)    T008, T009 (US2, parallel pair)
             ↓                                   ↓
     US1 + US2 complete
             ↓
     T010–T016 (US3)    T017–T019 (US4)   ← both can start after US1 done
             ↓                   ↓
     US3 + US4 complete
             ↓
     T020–T023 (US5)
             ↓
     T024, T025 (Polish, parallel)
```

## Parallel Execution Examples

**US1 + US2 together** (both P1, independent files, same foundation):
```
Developer A: T006, T007 (sizing.ts recommendation logic + tests)
Developer B: T008, T009 (size-conflicts.ts conflict detection + tests)
```

**US3 actions in parallel** (all hit different intent branches in the same route):
```
Developer A: T011 (save-override action) + T012 (reset action)
Developer B: T013 (create-mapping action) + T014 (delete action)
Developer C: T015 (Polaris tab UI) + T016 (integration tests)
```

**US4 + US5 in parallel** (fully independent feature slices after US1 is done):
```
Developer A: T017, T018, T019 (profile persistence)
Developer B: T020, T021, T022, T023 (return data pipeline)
```

## Implementation Strategy

**Suggested MVP scope**: Phases 1–4 (T001–T009) — delivers both P1 user stories: size recommendations and cart conflict warnings. The database, query helpers, seed data, core functions, and unit tests are all in place. US3, US4, and US5 are independent enhancements that do not block the P1 value.

**Incremental delivery order**:
1. Phases 1–2: Database foundation (T001–T005)
2. Phase 3: `getSizeRecommendation()` — primary customer value (T006–T007)
3. Phase 4: `detectSizeConflicts()` — highest return-rate impact (T008–T009)
4. Phase 5: Merchant admin for overrides — unlocks brand-specific accuracy (T010–T016)
5. Phase 6: Session persistence — eliminates friction for returning customers (T017–T019)
6. Phase 7: Return data feedback loop — self-improving recommendations (T020–T023)
7. Phase 8: Polish and exports (T024–T025)
