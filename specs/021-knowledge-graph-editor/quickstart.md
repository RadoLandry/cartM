# Quickstart: Knowledge Graph Editor

## Goal
Validate the core governance workflow end-to-end: review queue triage, safe edits, bulk updates, conflict handling, auditability, and downstream propagation.

## Prerequisites
- Embedded Shopify admin app is running.
- Catalog ingestion has populated product intelligence records.
- Test users with admin permissions are available.

## Scenario 1: Review low-confidence classifications
1. Open the Knowledge Graph Editor route.
2. Filter by `reviewStatus = pending` and lowest confidence band.
3. Approve or override one product's discipline/category assignment.

Expected result:
- Item leaves pending queue.
- Override provenance is visible.

## Scenario 2: Edit product relationship rule
1. Select a product and open relationship rules.
2. Add or update one relationship with a valid type and weight.
3. Save changes.

Expected result:
- Rule is persisted with incremented revision.
- Change log entry is created.

## Scenario 3: Validate rule rejection behavior
1. Attempt to create an invalid relationship (same source/target or invalid weight).
2. Attempt to save.

Expected result:
- Save is rejected with structured field-level validation errors.
- No partial record mutation is applied.

## Scenario 4: Execute bulk operation safely
1. Select a filtered product subset.
2. Create a bulk update and inspect preview impact.
3. Confirm execution.

Expected result:
- Operation status transitions through previewed -> running -> completed/partial.
- Per-record outcomes are available.

## Scenario 5: Validate optimistic concurrency conflict
1. Open same mutable record in two sessions.
2. Save changes from session A, then attempt stale save from session B.

Expected result:
- Session B receives conflict response with current revision metadata.
- No silent overwrite occurs.

## Scenario 6: Confirm downstream propagation
1. Save a classification or relationship change.
2. Trigger a recommendation/conflict read path that depends on the changed data.

Expected result:
- Updated governance state is reflected within one minute.
- Trace identifiers link mutation and consumption versions.

## Validation Checklist
- Polaris/App Bridge admin compliance is preserved.
- All mutation boundaries enforce server-side validation.
- Audit trail is complete and operator-readable.
- Propagation delay remains within defined bound.
