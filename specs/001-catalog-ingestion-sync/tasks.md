# Tasks: Catalog Ingestion & Sync

**Input**: Design documents from `/specs/001-catalog-ingestion-sync/`
**Prerequisites**: plan.md, spec.md

**Tests**: Automated tests are included because the constitution requires new business logic and webhook handlers to ship with corresponding tests.

**Organization**: Tasks are grouped by user story to enable independent implementation and validation.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Prepare the repository for catalog-sync work without yet implementing business behavior.

- [X] T001 Update Shopify app configuration for catalog sync in shopify.app.toml and app/shopify.server.ts
- [X] T002 [P] Create feature module entry points in app/lib/knowledge-graph/ingestion.ts, app/lib/knowledge-graph/normalization.ts, app/lib/knowledge-graph/embeddings.ts, app/lib/knowledge-graph/colorways.ts, app/lib/shopify/graphql.ts, and app/lib/shopify/webhooks.ts
- [X] T003 [P] Create admin sync-status component scaffolding in app/components/admin/SyncStatusCard.tsx and app/components/admin/SyncFailureTable.tsx
- [X] T004 [P] Add test directories and shared test utilities for ingestion and webhook scenarios in tests/unit/knowledge-graph/, tests/integration/routes/, and tests/fixtures/shopify/

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Establish the shared database, query, and webhook infrastructure that all user stories depend on.

**⚠️ CRITICAL**: No user story work should begin until this phase is complete.

- [X] T005 Replace the current SQLite-only Prisma schema with PostgreSQL session storage plus Product, ProductVariant, SyncJob, and WebhookEvent models in prisma/schema.prisma
- [X] T006 [P] Implement Prisma query helpers for catalog-sync entities in app/lib/db/queries.ts
- [X] T007 [P] Add Shopify Admin GraphQL product, collection, and metafield query documents in app/lib/shopify/graphql.ts
- [X] T008 [P] Implement webhook verification, topic registration, and event-id persistence helpers in app/lib/shopify/webhooks.ts
- [X] T009 [P] Implement product normalization helpers for namespace filtering, single-variant products, large variant lists in app/lib/knowledge-graph/normalization.ts
- [X] T010 [P] Implement shared sync-status, retry-policy, and progress-tracking helpers in app/lib/knowledge-graph/sync-status.ts
- [X] T011 Create the shared catalog-sync orchestration surface in app/lib/knowledge-graph/ingestion.ts

**Checkpoint**: Database models, query helpers, GraphQL access, and webhook infrastructure are ready for story implementation.

---

## Phase 3: User Story 1 - Initial Full Catalog Sync on App Install (Priority: P1) 🎯 MVP

**Goal**: Import every active and published product into CartMind immediately after installation.

**Independent Test**: Install the app on a development store with a seeded catalog and verify that a full sync creates one Product record per active/published Shopify product, with variants, allowed metafields, and SyncJob progress recorded.

### Tests for User Story 1

- [X] T012 [P] [US1] Add unit tests for active/published filtering and `custom.*` / `cartmind.*` metafield normalization in tests/unit/knowledge-graph/normalization.test.ts
- [X] T013 [P] [US1] Add integration tests for full-sync pagination, deduping, and sync-job progress tracking in tests/integration/routes/catalog-sync.test.ts

### Implementation for User Story 1

- [X] T014 [US1] Implement full-catalog pagination, rate-limit backoff, and shop-scoped deduping in app/lib/knowledge-graph/ingestion.ts
- [X] T015 [P] [US1] Implement product and variant upsert flows for full-sync batches in app/lib/db/queries.ts
- [X] T016 [P] [US1] Implement product payload normalization for active/published filtering and `custom.*` / `cartmind.*` metafield extraction in app/lib/knowledge-graph/normalization.ts
- [X] T017 [US1] Trigger the initial SyncJob after app install or auth completion in app/shopify.server.ts
- [X] T018 [US1] Persist SyncJob lifecycle, product counters, and per-product failures during full sync in app/lib/knowledge-graph/ingestion.ts
- [X] T019 [US1] Handle partial product failures without aborting the full run in app/lib/knowledge-graph/ingestion.ts and app/lib/db/queries.ts

**Checkpoint**: A newly installed shop receives a complete initial catalog import that can be validated without webhook traffic.

---

## Phase 4: User Story 2 - Real-Time Product Updates via Webhooks (Priority: P1)

**Goal**: Keep the local catalog accurate when Shopify products are created, updated, or deleted.

**Independent Test**: Create, update, and delete products in Shopify Admin, then verify that CartMind reflects each change within the expected window while duplicate webhook deliveries do not create duplicate writes.

### Tests for User Story 2

- [X] T020 [P] [US2] Add integration tests for webhook HMAC verification and duplicate-event suppression in tests/integration/routes/product-webhooks.test.ts
- [X] T021 [P] [US2] Add integration tests for create, update, delete, and update-before-sync reconciliation flows in tests/integration/routes/product-webhooks.test.ts

### Implementation for User Story 2

- [X] T022 [P] [US2] Add webhook route handlers for product create, update, and delete topics in app/routes/webhooks.products.create.tsx, app/routes/webhooks.products.update.tsx, and app/routes/webhooks.products.delete.tsx
- [X] T023 [US2] Implement asynchronous webhook dispatch with immediate HTTP 200 responses in app/routes/webhooks.products.create.tsx, app/routes/webhooks.products.update.tsx, and app/routes/webhooks.products.delete.tsx
- [X] T024 [P] [US2] Implement idempotent webhook-event recording and duplicate suppression in app/lib/shopify/webhooks.ts and app/lib/db/queries.ts
- [X] T025 [P] [US2] Implement create and update reconciliation, including update-before-sync upsert-on-miss handling, in app/lib/knowledge-graph/ingestion.ts
- [X] T026 [US2] Implement soft-delete or inactivation for `PRODUCTS_DELETE` events in app/lib/knowledge-graph/ingestion.ts and app/lib/db/queries.ts
- [X] T027 [US2] Register product webhook subscriptions during Shopify app setup in app/shopify.server.ts

**Checkpoint**: Product changes flow in from Shopify reliably, safely, and without double-processing.

---

## Phase 5: User Story 3 - Attribute Extraction & Embedding Generation (Priority: P2)

**Goal**: Enrich ingested products with normalized attributes, dominant colors, and embeddings needed by downstream intelligence features.

**Independent Test**: Run ingestion on a representative product set and verify that products with images receive dominant colors, products with valid text receive embeddings, and embedding-service failures retry up to the specified limit before surfacing as permanent failures.

### Tests for User Story 3

- [X] T028 [P] [US3] Add unit tests for retry scheduling and permanent-failure thresholds in tests/unit/knowledge-graph/embeddings.test.ts
- [X] T029 [P] [US3] Add unit tests for dominant-color extraction fallback behavior in tests/unit/knowledge-graph/colorways.test.ts

### Implementation for User Story 3

- [X] T030 [P] [US3] Implement embedding generation and 3-attempt retry scheduling in app/lib/knowledge-graph/embeddings.ts
- [X] T031 [P] [US3] Implement dominant-color extraction with missing-image fallback handling in app/lib/knowledge-graph/colorways.ts
- [X] T032 [US3] Integrate embedding and colorway enrichment into the sync pipeline in app/lib/knowledge-graph/ingestion.ts
- [X] T033 [US3] Normalize variant size values and product attribute fields needed by downstream classifiers in app/lib/knowledge-graph/normalization.ts
- [X] T034 [US3] Persist permanent-failure state and retry metadata for enrichment failures in app/lib/db/queries.ts and app/lib/knowledge-graph/sync-status.ts

**Checkpoint**: Synced products are enriched and failure handling is visible without requiring the sync pipeline to be rerun manually.

---

## Phase 6: User Story 4 - Merchant Visibility into Sync Status (Priority: P3)

**Goal**: Let merchants see sync progress, last-run status, and failed-product details from the admin dashboard.

**Independent Test**: Open the admin dashboard during and after a sync, then verify that counts, progress, last sync time, and failed-product details match the underlying SyncJob data.

### Tests for User Story 4

- [x] T035 [P] [US4] Add loader tests for sync summary and failure data in tests/integration/routes/app-index-sync-status.test.ts
- [x] T036 [P] [US4] Add component tests for sync-status and failure-state rendering in tests/unit/components/admin/sync-status.test.tsx

### Implementation for User Story 4

- [x] T037 [P] [US4] Add sync-status and failed-product loaders to app/routes/app._index.tsx
- [x] T038 [P] [US4] Implement a Polaris sync-status summary card in app/components/admin/SyncStatusCard.tsx
- [x] T039 [P] [US4] Implement a Polaris failed-product table with retry-state details in app/components/admin/SyncFailureTable.tsx
- [x] T040 [US4] Wire dashboard actions for manual re-sync requests with the single-active-job guard in app/routes/app._index.tsx and app/lib/knowledge-graph/ingestion.ts
- [x] T041 [US4] Surface SyncJob progress and permanent-failure details from app/lib/db/queries.ts into app/routes/app._index.tsx

**Checkpoint**: Merchants can trust the ingestion pipeline because they can inspect status and errors directly in the admin UI.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Final cleanup and delivery hardening across all stories.

- [x] T042 [P] Document catalog-sync setup, required environment variables, and operational behavior in README.md
- [x] T043 Harden logging and error messages across app/lib/knowledge-graph/ingestion.ts, app/lib/shopify/webhooks.ts, and app/routes/webhooks.products.create.tsx
- [x] T044 [P] Reconcile admin dashboard copy and empty states for sync status in app/routes/app._index.tsx and app/components/admin/SyncStatusCard.tsx
- [x] T045 Validate the final catalog-sync slice against prisma/schema.prisma, app/lib/**, app/routes/**, and tests/** using `npm run lint` and `npm run typecheck`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1: Setup**: No dependencies.
- **Phase 2: Foundational**: Depends on Phase 1 and blocks all user stories.
- **Phase 3: US1**: Depends on Phase 2.
- **Phase 4: US2**: Depends on Phase 2.
- **Phase 5: US3**: Depends on Phase 2 and reuses the sync pipeline from US1.
- **Phase 6: US4**: Depends on Phase 2 and relies on SyncJob/query infrastructure created earlier.
- **Phase 7: Polish**: Depends on the user stories the team intends to ship.

### User Story Dependencies

- **US1 (P1)**: First MVP slice; no dependency on other user stories after foundational work.
- **US2 (P1)**: Can start after foundational work, but benefits from the shared ingestion pipeline created for US1.
- **US3 (P2)**: Depends on the ingestion pipeline being available to attach enrichment work.
- **US4 (P3)**: Depends on SyncJob data being persisted by US1-US3.

### Suggested Delivery Order

1. Complete Phase 1 and Phase 2.
2. Deliver US1 as the MVP.
3. Add US2 to keep the catalog fresh after the initial import.
4. Add US3 for enrichment and retry handling.
5. Add US4 for merchant-facing visibility.
6. Finish with Phase 7 polish.

---

## Parallel Opportunities

- T002, T003, and T004 can run in parallel once T001 is defined.
- T006 through T010 can run in parallel after T005 establishes the Prisma models.
- In US1, T012 and T013 can run in parallel before T014/T018 integration.
- In US2, T020 and T021 can run in parallel before T022 through T026 integration.
- In US3, T028 and T029 can run in parallel before T030 through T034 integration.
- In US4, T035, T036, and T037 can run in parallel before T038 through T041 integration.
- T042 and T044 can run in parallel during polish.

---

## Parallel Example: User Story 1

```text
Task: T012 [US1] Add unit tests for normalization in tests/unit/knowledge-graph/normalization.test.ts
Task: T013 [US1] Add integration tests for full sync in tests/integration/routes/catalog-sync.test.ts
Task: T015 [US1] Implement product and variant upsert flows in app/lib/db/queries.ts
Task: T016 [US1] Implement product payload normalization in app/lib/knowledge-graph/normalization.ts
```

## Parallel Example: User Story 2

```text
Task: T020 [US2] Add webhook verification and idempotency tests in tests/integration/routes/product-webhooks.test.ts
Task: T021 [US2] Add webhook reconciliation tests in tests/integration/routes/product-webhooks.test.ts
Task: T022 [US2] Add webhook route handlers in app/routes/webhooks.products.create.tsx, app/routes/webhooks.products.update.tsx, and app/routes/webhooks.products.delete.tsx
Task: T024 [US2] Implement idempotent webhook-event recording in app/lib/shopify/webhooks.ts and app/lib/db/queries.ts
```

## Parallel Example: User Story 3

```text
Task: T028 [US3] Add retry-policy tests in tests/unit/knowledge-graph/embeddings.test.ts
Task: T029 [US3] Add colorway fallback tests in tests/unit/knowledge-graph/colorways.test.ts
Task: T030 [US3] Implement embedding generation in app/lib/knowledge-graph/embeddings.ts
Task: T031 [US3] Implement dominant-color extraction in app/lib/knowledge-graph/colorways.ts
```

## Parallel Example: User Story 4

```text
Task: T035 [US4] Add loader tests in tests/integration/routes/app-index-sync-status.test.ts
Task: T036 [US4] Add component tests in tests/unit/components/admin/sync-status.test.tsx
Task: T037 [US4] Add sync-status loaders to app/routes/app._index.tsx
Task: T038 [US4] Implement SyncStatusCard in app/components/admin/SyncStatusCard.tsx
Task: T039 [US4] Implement SyncFailureTable in app/components/admin/SyncFailureTable.tsx
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Setup and Foundational phases.
2. Deliver US1 with its automated tests and validate a full install-time sync on a development store.
3. Stop and verify the data model, SyncJob tracking, and duplicate protection before expanding scope.

### Incremental Delivery

1. Add US2 so catalog freshness is maintained after the initial import.
2. Add US3 so the synced catalog becomes usable for downstream intelligence features.
3. Add US4 last to expose the operational view to merchants without blocking the backend slices.

### Team Strategy

1. One engineer can own Prisma and query infrastructure through Phase 2.
2. After Phase 2, backend work can split across US1/US2/US3 while UI work starts on US4 once SyncJob queries stabilize.
3. Reserve the final pass for lint/typecheck validation and admin UX cleanup.
