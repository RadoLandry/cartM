# Quickstart: Analytics Dashboard

## Purpose

Implement and validate the Analytics Dashboard feature for merchant admin users, including KPI cards, performance breakdowns, funnel analytics, and CSV export.

## Prerequisites

- App installs and runs in an embedded Shopify admin context.
- Database migration pipeline is operational.
- Existing analytics/event capture is available for recommendation, chat, bundle, and purchase events.

## 1) Prepare Data Model

1. Add/adjust schema for:
   - KPI snapshots,
   - attribution records,
   - export report tracking.
2. Run migrations and regenerate Prisma client.
3. Validate indexes for period and shop filters.

Expected outcome:
- Analytics entities can persist and query by shop/date range efficiently.

## 2) Implement Analytics Domain Logic

1. Build event normalization and idempotency enforcement.
2. Implement period comparison logic (current vs baseline).
3. Implement funnel and attribution computation.
4. Implement metric definition registry exposed to UI payloads.

Expected outcome:
- Deterministic KPI and funnel responses for a given period and filter set.

## 3) Implement Admin Experience

1. Build/extend analytics admin route using Polaris-first components.
2. Add filters for date range and customer type.
3. Add KPI cards, recommendation/bundle/chat sections, and funnel view.
4. Add empty and partial-data states.

Expected outcome:
- Merchant can interpret dashboard metrics without external documentation.

## 4) Implement Export Flow

1. Add export request endpoint/action.
2. Support synchronous generation for standard ranges.
3. Add async export fallback for large ranges.
4. Expose status and downloadable artifact URL when ready.

Expected outcome:
- Merchant can export selected period analytics in CSV format.

## 5) Validate with Tests

1. Unit tests:
   - aggregation math,
   - baseline comparisons,
   - attribution windows,
   - invalid/empty data handling.
2. Integration tests:
   - route payload contracts,
   - filter behavior,
   - export status transitions.
3. Reconciliation checks:
   - sampled dashboard metrics remain within allowed variance of source events.

Expected outcome:
- Feature acceptance scenarios in spec are mapped to automated tests.

## 6) Verify Against Success Criteria

1. Confirm core KPI visibility for selected periods.
2. Confirm same-day metric freshness behavior.
3. Confirm metric-definition transparency in UI responses.
4. Confirm export completion behavior for standard monthly windows.

Expected outcome:
- Feature is ready for task breakdown and implementation sequencing.

## Quick Validation Checklist

- Dashboard loader returns required contract keys:
   - period, baseline, metrics, recommendationPerformance, bundlePerformance, chatPerformance, funnel, metricDefinitions.
- Route payload includes loadDurationMs for basic loader timing instrumentation.
- Export request endpoint accepts valid date range and CSV format:
   - POST /api/analytics/export returns 202 with exportId and status.
- Export status endpoint returns report state:
   - GET /api/analytics/export/:exportId returns status, downloadUrl, expiresAt, errorCode.
- Synchronous export path returns READY with a download URL for standard windows.
- Asynchronous fallback path returns RUNNING for large windows and preserves status transitions.
- Reconciliation sample checks stay within 5 percent variance versus source event samples.
- Integration tests pass:
   - export-flow.test.ts
   - analytics-contract.test.ts
   - reconciliation.test.ts
