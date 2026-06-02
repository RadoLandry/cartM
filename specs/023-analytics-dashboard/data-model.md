# Data Model: Analytics Dashboard

## Entity: AnalyticsEvent

- Purpose: Immutable normalized event record powering KPI and funnel analytics.
- Key fields:
  - `id` (UUID)
  - `shopId` (string)
  - `eventType` (enum)
  - `occurredAt` (datetime)
  - `receivedAt` (datetime)
  - `source` (enum: WEBHOOK, CHAT_TOOL, APP_ROUTE, JOB)
  - `sourceEventId` (string, nullable)
  - `idempotencyKey` (string, unique per shop)
  - `sessionId` (string, nullable)
  - `customerId` (string, nullable)
  - `customerType` (enum: ANONYMOUS, LOGGED_IN)
  - `payload` (json)
- Validation rules:
  - `eventType`, `occurredAt`, and `shopId` are required.
  - `idempotencyKey` must be unique within `shopId`.
  - `occurredAt <= receivedAt + tolerated_clock_skew`.

## Entity: KpiDefinition

- Purpose: Canonical metric metadata for transparency and consistency.
- Key fields:
  - `key` (string, unique)
  - `displayName` (string)
  - `description` (string)
  - `formula` (string)
  - `numeratorDefinition` (string)
  - `denominatorDefinition` (string, nullable)
  - `caveats` (json array)
  - `isRate` (boolean)
- Validation rules:
  - `key` must match approved KPI naming convention.
  - Rate KPIs require denominator definition.

## Entity: KpiSnapshot

- Purpose: Pre-aggregated KPI values for period and segment.
- Key fields:
  - `id` (UUID)
  - `shopId` (string)
  - `periodStart` (date)
  - `periodEnd` (date)
  - `granularity` (enum: DAY, WEEK, MONTH)
  - `segment` (json: includes customerType and optional filters)
  - `kpiKey` (string, FK to KpiDefinition)
  - `value` (decimal)
  - `sampleSize` (integer)
  - `computedAt` (datetime)
  - `dataFreshUntil` (datetime)
- Validation rules:
  - `periodStart <= periodEnd`.
  - `value` cannot be negative for count-based KPIs.

## Entity: AttributionRecord

- Purpose: Explainable linkage between upstream interactions and downstream outcomes.
- Key fields:
  - `id` (UUID)
  - `shopId` (string)
  - `sessionId` (string, nullable)
  - `customerId` (string, nullable)
  - `attributionType` (enum: RECOMMENDATION, CHAT, BUNDLE)
  - `sourceEventId` (UUID, FK AnalyticsEvent)
  - `outcomeEventId` (UUID, FK AnalyticsEvent)
  - `attributionWindowMinutes` (integer)
  - `confidence` (decimal)
  - `createdAt` (datetime)
- Validation rules:
  - `outcomeEventId.occurredAt >= sourceEventId.occurredAt`.
  - `confidence` between 0 and 1.

## Entity: ExportReport

- Purpose: Tracks analytics export requests and generated artifacts.
- Key fields:
  - `id` (UUID)
  - `shopId` (string)
  - `requestedBy` (string)
  - `format` (enum: CSV)
  - `periodStart` (date)
  - `periodEnd` (date)
  - `filters` (json)
  - `status` (enum: PENDING, RUNNING, READY, FAILED, EXPIRED)
  - `downloadUrl` (string, nullable)
  - `expiresAt` (datetime, nullable)
  - `errorCode` (string, nullable)
  - `createdAt` (datetime)
  - `completedAt` (datetime, nullable)
- Validation rules:
  - `downloadUrl` required when status is READY.
  - `errorCode` required when status is FAILED.

## Relationships

- `KpiSnapshot.kpiKey -> KpiDefinition.key` (many-to-one).
- `AttributionRecord.sourceEventId -> AnalyticsEvent.id` (many-to-one).
- `AttributionRecord.outcomeEventId -> AnalyticsEvent.id` (many-to-one).
- `ExportReport` references KPI snapshots/events through period+filter queries (logical relationship).

## State Transitions

### ExportReport

- `PENDING -> RUNNING`: export worker begins processing.
- `RUNNING -> READY`: artifact generated and URL issued.
- `RUNNING -> FAILED`: processing error or validation failure.
- `READY -> EXPIRED`: artifact TTL exceeded.

### KPI Freshness

- `STALE -> FRESH`: new events processed and aggregation refreshed.
- `FRESH -> STALE`: freshness window elapsed without recomputation.
