# Phase 0 Research: Analytics Dashboard

## Decision 1: Canonical Analytics Event Taxonomy with Idempotent Ingestion

- Decision: Use a canonical event taxonomy with stable event types and an idempotency key per event (`shop_id + source + source_event_id`) to prevent double counting.
- Rationale: Dashboard trust depends on metric consistency. Retry behavior from webhooks/background jobs can otherwise inflate counts.
- Alternatives considered:
  - Derive all metrics from raw logs without deduplication: rejected due to duplicate-event inflation risk.
  - Source-specific metric builders without a canonical taxonomy: rejected due to drift across modules and harder reconciliation.

## Decision 2: Period Comparison Uses Previous Equal-Length Baseline by Default

- Decision: Default baseline to the immediately preceding period with equal duration; allow explicit merchant override.
- Rationale: This yields intuitive trend comparisons while preserving flexibility.
- Alternatives considered:
  - Fixed calendar baseline (for example previous month only): rejected because custom ranges become hard to compare.
  - Same-weekday baseline only: rejected as too specialized for default behavior.

## Decision 3: Attribution Model Starts with Explainable Rules, Not Opaque Scoring

- Decision: Use deterministic attribution rules for funnel reporting:
  - recommendation influenced: recommendation click followed by cart modification/purchase within attribution window,
  - chat influenced: confirmed chat-driven cart action before purchase,
  - bundle influenced: bundle completion event tied to purchase line items.
- Rationale: Merchant-facing analytics must be auditable and explainable.
- Alternatives considered:
  - Probabilistic multi-touch model: rejected for initial release due to explainability and validation overhead.
  - Last-touch only for all channels: rejected because it under-represents recommendation exposure value.

## Decision 4: Hybrid KPI Read Path (On-Demand Query + Daily Snapshot)

- Decision: Support same-day visibility via on-demand aggregation for recent windows and maintain daily KPI snapshots for historical speed and consistency.
- Rationale: Balances freshness (SC-002) and query performance at scale.
- Alternatives considered:
  - Snapshot-only nightly jobs: rejected because same-day updates would lag.
  - Pure on-demand for all ranges: rejected due to higher latency/cost for long ranges.

## Decision 5: Export Uses Synchronous Small-Range and Asynchronous Large-Range Modes

- Decision: Exports for standard ranges (up to 90 days) run synchronously; larger or heavy exports use queued async generation with completion status.
- Rationale: Preserves responsive UX while supporting large reporting demands.
- Alternatives considered:
  - Fully synchronous exports only: rejected due to timeout risk.
  - Fully asynchronous exports only: rejected because common exports would feel unnecessarily slow.

## Decision 6: Analytics Definitions Are First-Class Artifacts

- Decision: Store and serve metric-definition metadata (name, formula, exclusions, caveats) alongside KPI payloads.
- Rationale: FR-008 requires merchant-readable, auditable calculations.
- Alternatives considered:
  - Static UI-only descriptions: rejected because backend and UI can drift.
  - Documentation-only definitions outside runtime payloads: rejected for weak in-product transparency.

## Resolved Clarifications

- Export format for v1: CSV as required portable default; JSON may be added later without changing KPI semantics.
- Funnel stage minimum set: exposure -> interaction -> cart change -> purchase completion.
- Freshness expectation: same reporting day for eligible events; documented as SLO, not immediate real-time guarantee.
