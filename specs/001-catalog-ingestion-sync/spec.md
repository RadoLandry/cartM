# Feature Specification: Catalog Ingestion & Sync

**Feature Branch**: `001-catalog-ingestion-sync`  
**Created**: 2026-05-18  
**Status**: Draft  
**Input**: User description: "Catalog Ingestion & Sync — ingest the merchant's Shopify product catalog and continuously sync changes via webhooks."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Initial Full Catalog Sync on App Install (Priority: P1)

When a merchant installs CartMind, all products in their Shopify store are pulled into the CartMind system so that recommendations and intelligence features can function immediately.

**Why this priority**: Without an initial catalog snapshot, every downstream feature (kit detection, size conflicts, bundle rules) has no data to operate on. This is the foundational prerequisite for the entire product.

**Independent Test**: Can be tested by installing CartMind on a Shopify dev store with 50+ products, then verifying that each product appears in the CartMind database with all expected attributes (title, description, variants, tags, collections, metafields) and that a vector embedding exists for each.

**Acceptance Scenarios**:

1. **Given** a merchant has just installed CartMind and no products exist in the CartMind database, **When** the post-install sync is triggered, **Then** every active, non-archived product in the Shopify store is imported including all variants, collections, tags, and metafields.
2. **Given** a Shopify store with 5,000+ products, **When** the full catalog sync runs, **Then** all products are imported without data loss, duplicates, or timeout errors.
3. **Given** a product with no description or images, **When** it is ingested, **Then** the product record is still created with available fields populated and missing fields set to safe defaults.
4. **Given** the sync encounters a Shopify API rate limit, **When** the limit is hit, **Then** the sync pauses, respects the retry-after header, then resumes from where it left off without re-importing already-synced products.

---

### User Story 2 - Real-Time Product Updates via Webhooks (Priority: P1)

When a merchant updates a product (price change, new variant, description edit, image update) in Shopify, CartMind reflects that change in near-real-time so recommendations remain accurate.

**Why this priority**: Stale product data leads to wrong recommendations and broken cart experiences. A merchant changing a product description or adding a new size variant must be reflected immediately.

**Independent Test**: Can be tested by updating a product title and variant price in the Shopify Admin, then verifying within 30 seconds that the CartMind database record reflects both changes, and that the product's vector embedding has been regenerated.

**Acceptance Scenarios**:

1. **Given** CartMind has received a `PRODUCTS_UPDATE` webhook, **When** the webhook is processed, **Then** the corresponding product record in CartMind is updated to match the current Shopify state within 30 seconds of the change.
2. **Given** a new product is created in Shopify, **When** the `PRODUCTS_CREATE` webhook fires, **Then** a new product record with embeddings is created in CartMind within 30 seconds.
3. **Given** a product is deleted or archived in Shopify, **When** the `PRODUCTS_DELETE` webhook fires, **Then** the CartMind record is marked inactive and excluded from all recommendations.
4. **Given** a webhook arrives while CartMind is under load, **When** the handler receives the payload, **Then** an HTTP 200 is returned immediately and the update is processed asynchronously within the same 30-second window.
5. **Given** a webhook is delivered with an invalid HMAC signature, **When** the handler verifies the signature, **Then** the request is rejected with HTTP 401 and no data is changed.

---

### User Story 3 - Attribute Extraction & Embedding Generation (Priority: P2)

Every ingested product has its attributes (discipline tags, category, size data, colors) extracted and a vector embedding generated so that semantic search and AI-powered features work accurately.

**Why this priority**: Raw product data is insufficient for recommendations. The intelligence layer requires normalized attributes and vector representations. This unlocks the taxonomy and relationship mapping capabilities that depend on this feature.

**Independent Test**: Can be tested independently by triggering ingestion on a sample product set and verifying that each product record has: non-empty `disciplineTags`, a `categoryTags` array, `dominantColors` populated (if product has images), and a 1536-dimension `embedding` vector.

**Acceptance Scenarios**:

1. **Given** a product is ingested, **When** attribute extraction runs, **Then** the product record contains discipline tags, category tags, and all size variants are normalized.
2. **Given** a product has images, **When** ingestion completes, **Then** dominant colors are extracted and stored on the product record.
3. **Given** a product text (title + description + tags) is available, **When** embedding generation runs, **Then** a 1536-dimension vector is stored and the `syncedAt` timestamp is updated.
4. **Given** the AI embedding service is temporarily unavailable, **When** ingestion runs, **Then** the product record is saved without an embedding and flagged for a background retry; the sync does not fail entirely.

---

### User Story 4 - Merchant Visibility into Sync Status (Priority: P3)

A merchant can view the current sync status — how many products have been imported, when the last sync ran, and whether any products failed to import — so they can trust that CartMind has an accurate picture of their catalog.

**Why this priority**: Operational transparency is important for merchant trust but not required for the core intelligence to function. A background sync that silently works is sufficient for MVP; a visible status UI is a quality-of-life addition.

**Independent Test**: Can be tested by navigating to the CartMind admin dashboard and verifying that a sync status indicator shows total products synced, last sync timestamp, and a count of any import errors.

**Acceptance Scenarios**:

1. **Given** the initial sync has completed, **When** the merchant views the CartMind admin dashboard, **Then** they see the total number of products synced, the time of the last sync, and the count of products that failed to import.
2. **Given** an ongoing sync is in progress, **When** the merchant views sync status, **Then** they see a progress indicator (e.g., "Syncing: 1,243 of 5,000 products").
3. **Given** one or more products failed to import, **When** the merchant views the error list, **Then** they see the product name, Shopify product ID, and the reason for failure.

---

### Edge Cases

- What happens when a product has no variants (single SKU, no options)?
- How does the system handle products with more than 100 variants (Shopify API limit per page)?
- What happens when a webhook fires for a product that does not yet exist in the CartMind database (race condition where `PRODUCTS_UPDATE` arrives before initial sync reaches that product)?
- ~~How does the system handle a Shopify metafield that uses a custom namespace CartMind doesn't recognize?~~ → **Resolved**: Only `custom.*` and `cartmind.*` metafields are ingested; all other namespaces are ignored.
- What happens when a product's primary image URL becomes a 404 after ingestion?
- ~~How does the system handle a full re-sync being triggered while an existing sync is still in progress?~~ → **Resolved**: New re-sync requests are rejected while a SyncJob is IN_PROGRESS (see FR-013).
- What happens when the embedding service returns a vector of unexpected dimensions?
- ~~How should duplicate webhook deliveries be handled?~~ → **Resolved**: Webhook processing is idempotent by unique webhook event ID (see FR-014).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: On app installation, the system MUST perform a full catalog sync, importing all ACTIVE and PUBLISHED products from the merchant's Shopify store. DRAFT products and archived products MUST be excluded from ingestion entirely and ignored during both full syncs and webhook-triggered updates.
- **FR-002**: The system MUST paginate through the product catalog using Shopify's GraphQL cursor-based pagination to handle catalogs of any size without timeout.
- **FR-003**: The system MUST register webhooks for `PRODUCTS_CREATE`, `PRODUCTS_UPDATE`, and `PRODUCTS_DELETE` events on install and verify them via HMAC signature on each delivery.
- **FR-004**: The system MUST process incoming product webhooks asynchronously — returning HTTP 200 immediately and completing the update in the background — to avoid Shopify webhook timeout (5-second limit).
- **FR-005**: For each ingested product, the system MUST extract and store: title, description, handle, vendor, product type, status, tags, all collections it belongs to, and all variants (with SKU, price, compare-at price, size option values, and inventory quantity). The system MUST ingest only Shopify metafields from the `custom.*` (merchant-defined) and `cartmind.*` (app-specific) namespaces; all other metafields MUST be ignored during ingestion and sync.
- **FR-006**: The system MUST generate a text embedding (1536 dimensions) for each product, derived from its title, description, and tags, and store it alongside the product record for semantic similarity queries.
- **FR-007**: The system MUST extract dominant colors from each product's primary image and store them on the product record; products with no images MUST still be stored without failing.
- **FR-008**: The system MUST detect and prevent duplicate product records when the same Shopify product ID is ingested more than once — subsequent syncs MUST update the existing record rather than creating a new one.
- **FR-009**: When a `PRODUCTS_DELETE` webhook is received, the system MUST mark the product as inactive and exclude it from all recommendation queries; the record MAY be retained for historical analytics purposes.
- **FR-010**: The system MUST track the sync status per shop (total products, synced count, failed count, last sync timestamp) and expose it through the admin dashboard.
- **FR-011**: If ingestion of a single product fails (e.g., embedding service unavailable), the system MUST log the failure, continue processing the remaining products, and schedule the failed product for automatic retry. The system MUST retry up to **3 times** over a **24-hour window** using increasing delays between attempts. After 3 failed attempts within 24 hours, the product MUST be marked as permanently failed, excluded from further automatic retries, and surfaced in the merchant-facing error list with the failure reason.
- **FR-012**: The system MUST respect Shopify's API rate limits during bulk sync by honoring `X-Shopify-Shop-Api-Call-Limit` and `Retry-After` headers and implementing exponential backoff.
- **FR-013**: The system MUST enforce a single active SyncJob per shop at a time. If a full re-sync is triggered while a SyncJob with status IN_PROGRESS already exists for that shop, the new request MUST be rejected with a clear error message indicating the sync is already running. No new SyncJob record is created.
- **FR-014**: The system MUST process Shopify webhook deliveries idempotently by tracking the unique webhook event ID included in each delivery. If a webhook with a previously processed event ID is received, the system MUST return HTTP 200 and skip all product mutation work for that duplicate delivery.

### Key Entities

- **Product**: Represents a Shopify product synced to CartMind. Only ACTIVE and PUBLISHED products are stored. Key attributes: Shopify product ID, title, description, handle, vendor, product type, status (ACTIVE | INACTIVE — where INACTIVE covers soft-deleted records from a `PRODUCTS_DELETE` event), discipline tags, category tags, dominant colors, collection membership, vector embedding, syncedAt timestamp, and only metafields from the `custom.*` and `cartmind.*` namespaces. DRAFT and archived products from Shopify are never ingested.
- **ProductVariant**: A purchasable option of a Product. Key attributes: Shopify variant ID, parent product ID, title, SKU, price, compare-at price, size value, size category (e.g., S/M/L or oz or waist inches), size numeric value, inventory quantity, image URL.
- **SyncJob**: Represents a full catalog sync operation. Key attributes: shop ID, status (PENDING | IN_PROGRESS | COMPLETED | FAILED), total product count, synced count, failed count, started at, completed at.
- **WebhookEvent**: Log of received webhook deliveries. Key attributes: shop ID, event type, Shopify topic, payload reference, processing status, received at.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A catalog of 5,000 products is fully ingested — with embeddings and color extraction — within 15 minutes of the sync being triggered.
- **SC-002**: Product changes made in Shopify Admin are reflected in the CartMind database within 30 seconds of the webhook delivery.
- **SC-003**: The system achieves a 99%+ successful ingestion rate across a catalog of 1,000 mixed products (with and without descriptions, images, and variants).
- **SC-004**: Zero duplicate product records exist after running a full sync twice on the same catalog.
- **SC-005**: Webhook delivery failures (invalid HMAC, missing payload) are rejected 100% of the time without modifying any data.
- **SC-006**: Merchants can view sync completion status and identify any failed products within the CartMind admin without contacting support.

## Clarifications

### Session 2026-05-18

- Q: Should DRAFT products (not yet published) be ingested during catalog sync? → A: Skip drafts entirely — only sync ACTIVE and PUBLISHED products; drafts are ignored until published.
- Q: When a merchant triggers a full re-sync while one is already in progress, what should happen? → A: Reject the new request — return an error indicating sync is already running; only one SyncJob may be IN_PROGRESS per shop at a time.
- Q: How long should the system retry a failed product ingestion before giving up? → A: Retry 3 times over 24 hours (with increasing delays), then mark permanently failed and surface in the admin error list.
- Q: Which Shopify metafields should be ingested? → A: Filter to known namespaces only: `custom.*` (merchant-defined) and `cartmind.*` (app-specific); all others are ignored.
- Q: How should duplicate webhook deliveries be handled? → A: Track processed webhook IDs and ignore duplicates (idempotent processing by event ID).

## Assumptions

- Products are ingested from the Shopify **Admin GraphQL API** using the shop's authenticated session token; Storefront API is not used for catalog ingestion.
- The Shopify API version used throughout is `2025-04` as pinned in `shopify.app.toml`.
- Vector embeddings are 1536-dimensional (compatible with OpenAI's `text-embedding-3-small` and `text-embedding-ada-002` models).
- The database has the `pgvector` extension enabled; embedding storage uses the `vector(1536)` column type via Prisma.
- Initial taxonomy classification (assigning discipline and category tags) is performed by a separate module that depends on this feature's output — ingestion only extracts raw attributes and embeddings, not higher-level classifications.
- Dominant color extraction from product images is a best-effort operation; products without accessible images will be ingested without color data and will not block the sync.
- The system is deployed on Vercel serverless infrastructure; long-running full syncs MUST use background task patterns (`waitUntil()` or job queue) rather than blocking HTTP responses.
- Webhook registration is idempotent — re-registering the same webhook topic on the same shop does not create duplicates (Shopify enforces this).
- The `PRODUCTS_DELETE` event does not carry full product data in its payload; the system uses only the Shopify product ID from the webhook to mark the corresponding record as inactive.
- Multi-location inventory tracking is out of scope for this feature; only total inventory quantity per variant is tracked.
