# Tasks: Shopify Storefront Integration

**Input**: Design documents from `/specs/025-shopify-storefront-integration/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Included because the feature specification requires merchant/QA validation, non-regression coverage, checkout guidance verification, bundle edge-case validation, and the constitution requires user-story acceptance criteria to map to automated tests.

**Organization**: Tasks are grouped by user story so each story can be implemented and tested independently after shared foundations are complete.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Prepare extension, widget, and test locations for the storefront integration work.

- [X] T001 Create storefront integration helper module placeholder in app/lib/shopify/storefront-integration.ts
- [X] T002 [P] Create storefront integration component directory in storefront-widget/src/components/integration/.gitkeep
- [X] T003 [P] Create checkout UI extension source directory in extensions/checkout-ui/src/.gitkeep
- [X] T004 [P] Create Shopify Function source directories in extensions/discount-function/src/.gitkeep and extensions/cart-transform/src/.gitkeep
- [X] T005 [P] Create storefront integration fixture file in tests/helpers/storefront-integration-fixtures.ts

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared contracts, schemas, telemetry, fixtures, and thin-loader groundwork that all user stories depend on.

**CRITICAL**: No user story work can begin until this phase is complete.

- [X] T006 [P] Add storefront integration schemas for placements, cart surface state, guidance payloads, checkout guidance, and bundle outcomes in app/lib/ai/schemas.ts
- [X] T007 [P] Add integration health event model and emit helpers in app/lib/analytics/cart-events.ts
- [X] T008 [P] Add storefront integration fixture builders for cart drawer, cart page, checkout, and bundle scenarios in tests/helpers/storefront-integration-fixtures.ts
- [X] T009 Implement validated storefront guidance payload assembly helpers in app/lib/shopify/storefront-integration.ts
- [X] T010 Extend recommendation response mapping for storefront guidance cards, kit completeness, size warnings, and chat entry state in app/lib/cart-intelligence/recommendations.ts
- [X] T011 Update app-proxy bootstrap payload support for placement and guidance endpoint configuration in app/lib/shopify/app-proxy.ts
- [X] T012 Update thin theme extension loader contract to reference app-hosted widget assets in extensions/cart-drawer-block/assets/cartmind-chat.js
- [X] T013 Update extension mount configuration Liquid for app embed and cart-page fallback settings in extensions/cart-drawer-block/blocks/ai-cart.liquid
- [X] T014 Add shared storefront integration contract tests for schema validation and invalid payload rejection in tests/integration/routes/storefront-integration-bootstrap.test.ts

**Checkpoint**: Shared schemas, fixtures, mount configuration, and validation boundaries are ready for user story work.

---

## Phase 3: User Story 1 - Add CartMind to Storefront Cart Surfaces (Priority: P1) MVP

**Goal**: CartMind renders in cart drawer and cart page placements without disrupting existing cart controls, third-party sections, styling, or fallback behavior.

**Independent Test**: Enable the integration on a supported dev theme, open the cart drawer and cart page, confirm CartMind appears with guidance entry points, and verify original cart controls still work even when CartMind fails to load.

### Tests for User Story 1

- [X] T015 [P] [US1] Add widget mount lifecycle unit tests for one instance per surface and failure no-op behavior in tests/unit/storefront/cart-surface-lifecycle.test.ts
- [X] T016 [P] [US1] Add theme compatibility integration tests for cart drawer, cart page, third-party section preservation, and duplicate prevention in tests/integration/storefront/cartmind-theme-compatibility.test.ts
- [X] T017 [P] [US1] Add integration health event unit tests for widget_rendered, widget_failed, and fallback_used events in tests/unit/storefront/integration-health-events.test.ts

### Implementation for User Story 1

- [X] T018 [P] [US1] Implement cart surface shell components for recommendations, kit completeness, warnings, and chat entry in storefront-widget/src/components/integration/CartMindSurface.tsx
- [X] T019 [P] [US1] Implement guidance card and warning display components in storefront-widget/src/components/integration/GuidanceCards.tsx
- [X] T020 [US1] Extend widget entrypoint to discover cart drawer and cart page roots and prevent duplicate mounts in storefront-widget/src/index.tsx
- [X] T021 [US1] Implement drawer/page mount lifecycle hook with Shadow DOM host management and graceful failure states in storefront-widget/src/hooks/useCartSurfaceLifecycle.ts
- [X] T022 [US1] Integrate cart surface shell and chat entry with existing CartMind chat root in storefront-widget/src/CartMindChat.tsx
- [X] T023 [US1] Scope storefront integration layout, fallback, and chat-entry styles to the widget shadow root in storefront-widget/src/styles/chat.css
- [X] T024 [US1] Update theme extension locale labels for app embed and cart-page fallback placements in extensions/cart-drawer-block/locales/en.default.json

**Checkpoint**: User Story 1 is independently functional and testable as the MVP cart drawer/cart page integration.

---

## Phase 4: User Story 2 - Keep CartMind Synchronized with Cart Changes (Priority: P2)

**Goal**: CartMind refreshes guidance after cart mutations, AJAX drawer replacement, product-page add-to-cart notification flows, and fallback polling without rendering duplicates.

**Independent Test**: Change cart contents through drawer controls, product-page add-to-cart, and cart-page controls; verify CartMind updates within the expected window and no duplicate widgets appear.

### Tests for User Story 2

- [X] T025 [P] [US2] Add cart state synchronization unit tests for /cart.js refresh, stale snapshots, and malformed cart lines in tests/unit/storefront/cart-state-sync.test.ts
- [X] T026 [P] [US2] Add fetch interception, cart notification synchronization, and notification no-render target tests in tests/unit/storefront/cart-fetch-interception.test.ts
- [X] T027 [P] [US2] Add integration health event unit tests for cart_sync_started, cart_sync_completed, cart_sync_failed, and guidance_impressed in tests/unit/storefront/integration-health-events.test.ts

### Implementation for User Story 2

- [X] T028 [P] [US2] Implement cart snapshot normalization from /cart.js payloads in storefront-widget/src/hooks/useCartStateSync.ts
- [X] T029 [US2] Implement fetch interception for /cart/add.js, /cart/change.js, /cart/update.js, and /cart/clear.js without changing request semantics in storefront-widget/src/hooks/useCartStateSync.ts
- [X] T030 [US2] Implement MutationObserver refresh triggers for AJAX drawer replacement and drawer open/close class changes in storefront-widget/src/hooks/useCartSurfaceLifecycle.ts
- [X] T031 [US2] Implement bounded fallback polling while drawer or cart page surfaces are active in storefront-widget/src/hooks/useCartStateSync.ts
- [X] T032 [US2] Refresh storefront guidance payloads after cart sync using validated backend response handling in storefront-widget/src/CartMindChat.tsx
- [X] T033 [US2] Emit cart synchronization and guidance impression events through app/lib/analytics/cart-events.ts

**Checkpoint**: User Stories 1 and 2 both work independently, and CartMind guidance stays current after cart changes.

---

## Phase 5: User Story 3 - Surface Checkout Guidance and Offers (Priority: P3)

**Goal**: Checkout shows only relevant size warnings, bundle offers, and kit completion nudges while adapting to available checkout placements and rendering nothing for no-guidance carts.

**Independent Test**: Proceed to checkout with size-conflict, bundle-opportunity, mixed, and no-guidance carts; confirm the expected guidance appears or stays hidden without blocking checkout.

### Tests for User Story 3

- [X] T034 [P] [US3] Add checkout guidance contract tests for size warnings, bundle offers, no-guidance carts, invalid items, and priority ordering in tests/integration/routes/checkout-guidance-contract.test.ts
- [X] T035 [P] [US3] Add checkout guidance model unit tests for empty feeds, expired items, missing line IDs, and projection version rejection in tests/unit/storefront/checkout-guidance-model.test.ts
- [X] T036 [P] [US3] Add checkout extension render tests for warnings, offers, and hidden empty state in extensions/checkout-ui/src/Checkout.test.tsx

### Implementation for User Story 3

- [X] T037 [P] [US3] Implement checkout guidance feed builder from size conflicts, bundle outcomes, and kit nudges in app/lib/shopify/storefront-integration.ts
- [X] T038 [US3] Extend size conflict mapping to emit high-confidence checkout warning summaries in app/lib/cart-intelligence/size-conflicts.ts
- [X] T039 [US3] Create checkout UI extension configuration in extensions/checkout-ui/shopify.extension.toml
- [X] T040 [US3] Implement checkout guidance rendering with Shopify checkout UI extension primitives only in extensions/checkout-ui/src/Checkout.tsx
- [X] T041 [US3] Implement checkout guidance empty-state no-render behavior and placement adaptation in extensions/checkout-ui/src/Checkout.tsx
- [X] T042 [US3] Emit checkout_guidance_rendered integration health events in app/lib/analytics/cart-events.ts

**Checkpoint**: User Story 3 works independently for checkout guidance without requiring bundle discount implementation.

---

## Phase 6: User Story 4 - Apply and Present Bundle Outcomes (Priority: P4)

**Goal**: Eligible bundle discounts and presentation outcomes are deterministic, function-compatible, and understandable in cart/checkout flows.

**Independent Test**: Evaluate full, partial, overlapping, expired, malformed, and ineligible bundle carts; confirm discounts and presentation match active merchant rules and invalid outcomes apply no discount.

### Tests for User Story 4

- [X] T043 [P] [US4] Add bundle storefront outcome unit tests for full, partial, overlapping, expired, conflict, and malformed projections in tests/unit/cart-intelligence/bundle-storefront-outcomes.test.ts
- [X] T044 [P] [US4] Add discount function fixture tests for selected qualified outcomes and no-discount invalid projections in extensions/discount-function/src/run.test.js
- [X] T045 [P] [US4] Add cart transform function fixture tests for line merge eligibility and component presentation in extensions/cart-transform/src/run.test.js

### Implementation for User Story 4

- [X] T046 [P] [US4] Implement bundle storefront outcome projection and overlap resolution in app/lib/cart-intelligence/bundles.ts
- [X] T047 [US4] Implement bundle outcome storefront presentation mapping for completion prompts and savings summaries in app/lib/shopify/storefront-integration.ts
- [X] T048 [US4] Create discount function extension configuration and input query for compact bundle projection data in extensions/discount-function/shopify.extension.toml and extensions/discount-function/input.graphql
- [X] T049 [US4] Implement discount function selected-qualified-outcome logic with no external calls in extensions/discount-function/src/run.js
- [X] T050 [US4] Create cart transform extension configuration and input query for selected bundle presentation data in extensions/cart-transform/shopify.extension.toml and extensions/cart-transform/input.graphql
- [X] T051 [US4] Implement cart transform line merge and component summary logic with no external calls in extensions/cart-transform/src/run.js
- [X] T052 [US4] Emit bundle_outcome_evaluated integration health events in app/lib/analytics/cart-events.ts

**Checkpoint**: All user stories are independently functional, and bundle outcomes connect storefront prompts to checkout discounts/presentation.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Feature-wide validation, performance checks, documentation alignment, and final cleanup.

- [X] T053 [P] Add storefront bundle budget and p95 cart-load verification helper for public/storefront/cartmind-chat-app.js in scripts/check-storefront-performance-budget.ts
- [X] T054 Update package scripts for storefront bundle budget and p95 cart-load validation in package.json
- [X] T055 [P] Document manual storefront, checkout, and bundle validation results in specs/025-shopify-storefront-integration/quickstart.md
- [X] T056 Run focused automated validation commands from specs/025-shopify-storefront-integration/quickstart.md
- [X] T057 Run Shopify config validation for extension changes using shopify.app.toml, extensions/cart-drawer-block/shopify.extension.toml, extensions/checkout-ui/shopify.extension.toml, extensions/discount-function/shopify.extension.toml, and extensions/cart-transform/shopify.extension.toml
- [X] T058 Run final TypeScript and lint validation for changed files using package.json scripts

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately.
- **Foundational (Phase 2)**: Depends on Setup completion - blocks all user stories.
- **User Story 1 (Phase 3)**: Depends on Foundational; recommended MVP first.
- **User Story 2 (Phase 4)**: Depends on Foundational and integrates with US1 widget surfaces, but cart sync helpers can be developed independently against fixtures.
- **User Story 3 (Phase 5)**: Depends on Foundational; can proceed independently of US1/US2 after shared guidance models exist.
- **User Story 4 (Phase 6)**: Depends on Foundational and existing bundle rule data; can proceed independently of US1/US2 and feeds US3 bundle offers.
- **Polish (Phase 7)**: Depends on all desired user stories being complete.

### User Story Dependencies

- **US1 Add CartMind to Storefront Cart Surfaces**: Start after Foundational; no dependency on other stories.
- **US2 Keep CartMind Synchronized with Cart Changes**: Start after Foundational; integrates most naturally after US1 mount surfaces exist.
- **US3 Surface Checkout Guidance and Offers**: Start after Foundational; uses shared checkout guidance and cart-intelligence outputs.
- **US4 Apply and Present Bundle Outcomes**: Start after Foundational; uses bundle rules and projections, then feeds storefront/checkout presentations.

### Within Each User Story

- Write tests first and confirm they fail before implementation.
- Implement shared models and schema mapping before UI or extension rendering.
- Implement route/helper logic before widget, checkout, or function integration.
- Complete each checkpoint before moving to the next priority when working sequentially.

## Parallel Opportunities

- Setup tasks T002-T005 can run in parallel after T001.
- Foundational schema, analytics, and fixture tasks T006-T008 can run in parallel.
- US1 tests T015-T017 can run in parallel; US1 components T018-T019 can run in parallel before entrypoint integration.
- US2 tests T025-T027 can run in parallel; cart snapshot normalization T028 can begin before lifecycle wiring T030.
- US3 tests T034-T036 can run in parallel; checkout feed builder T037 can begin before extension rendering T040.
- US4 tests T043-T045 can run in parallel; discount and cart transform configuration/input/query work T048-T051 can split by extension.
- Polish tasks T053 and T055 can run in parallel after user story implementation.

## Parallel Example: User Story 1

```bash
Task: "T015 [P] [US1] Add widget mount lifecycle unit tests for one instance per surface and failure no-op behavior in tests/unit/storefront/cart-surface-lifecycle.test.ts"
Task: "T016 [P] [US1] Add theme compatibility integration tests for cart drawer, cart page, third-party section preservation, and duplicate prevention in tests/integration/storefront/cartmind-theme-compatibility.test.ts"
Task: "T017 [P] [US1] Add integration health event unit tests for widget_rendered, widget_failed, and fallback_used events in tests/unit/storefront/integration-health-events.test.ts"
Task: "T018 [P] [US1] Implement cart surface shell components for recommendations, kit completeness, warnings, and chat entry in storefront-widget/src/components/integration/CartMindSurface.tsx"
Task: "T019 [P] [US1] Implement guidance card and warning display components in storefront-widget/src/components/integration/GuidanceCards.tsx"
```

## Parallel Example: User Story 3

```bash
Task: "T034 [P] [US3] Add checkout guidance contract tests for size warnings, bundle offers, no-guidance carts, invalid items, and priority ordering in tests/integration/routes/checkout-guidance-contract.test.ts"
Task: "T035 [P] [US3] Add checkout guidance model unit tests for empty feeds, expired items, missing line IDs, and projection version rejection in tests/unit/storefront/checkout-guidance-model.test.ts"
Task: "T036 [P] [US3] Add checkout extension render tests for warnings, offers, and hidden empty state in extensions/checkout-ui/src/Checkout.test.tsx"
```

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup.
2. Complete Phase 2: Foundational.
3. Complete Phase 3: US1 cart drawer/cart page rendering.
4. Stop and validate US1 independently against cart drawer, cart page, duplicate prevention, third-party coexistence, and graceful failure scenarios.
5. Demo the MVP before adding cart synchronization, checkout guidance, or bundle outcomes.

### Incremental Delivery

1. Add US1 to render CartMind safely on cart surfaces.
2. Add US2 to keep CartMind synchronized with cart changes.
3. Add US3 to surface concise checkout warnings/offers/nudges.
4. Add US4 to apply and present bundle outcomes through Shopify-compatible paths.
5. Run Polish tasks and quickstart validation.

### Parallel Team Strategy

1. Team completes Setup and Foundational phases together.
2. One developer owns US1/US2 storefront widget lifecycle and synchronization.
3. One developer owns US3 checkout guidance feed and checkout extension rendering.
4. One developer owns US4 bundle projections and Shopify Function paths.
5. Integrate through shared schemas and fixtures before final validation.

## Notes

- Every task uses the required checklist format and includes concrete repository paths.
- [P] tasks are marked only when they touch different files or can be worked independently.
- Story labels map directly to the four user stories in spec.md.
- Theme extension assets should stay thin; heavier widget output belongs under public/storefront/.
- Shopify Function tasks must not introduce Node APIs, Prisma, fetch, or external network calls.
- Storefront performance validation must include the constitution target of p95 cart load time at or below 300 ms.
