# Research: Knowledge Graph Editor

## Decision 1: Use a confidence-prioritized review queue
- Decision: Present and process product intelligence items in a queue ordered by confidence risk and business impact.
- Rationale: Merchants need to fix the highest-risk quality issues first to improve recommendation trust quickly.
- Alternatives considered:
  - Alphabetical/product-ID ordering: rejected because it delays correction of high-impact errors.
  - Category-only grouping without priority: rejected because critical issues can remain buried.

## Decision 2: Make merchant overrides authoritative with explicit provenance
- Decision: Persist merchant overrides as authoritative values with source metadata while retaining original auto-generated values for traceability.
- Rationale: Downstream systems need deterministic precedence, and operators need explainability.
- Alternatives considered:
  - Overwrite generated values in place: rejected due to audit and rollback limitations.

## Decision 3: Enforce strict server-side validation on all edit operations
- Decision: Validate relationship edits, size mappings, and bulk operations server-side before any persistence.
- Rationale: Prevents ambiguous intelligence states and protects downstream analysis integrity.
- Alternatives considered:
  - Client-only validation: rejected because it can be bypassed and creates inconsistent behavior.

## Decision 4: Use optimistic concurrency for simultaneous admin edits
- Decision: Require a version token/revision check for mutable records and reject stale writes with a conflict response.
- Rationale: Concurrent edits are expected in teams and must not silently overwrite valid changes.
- Alternatives considered:
  - Last-write-wins: rejected because it causes silent data loss and poor operator trust.

## Decision 5: Require bulk operation preview and explicit confirmation
- Decision: Bulk operations must provide pre-apply preview and require explicit confirmation, with per-record result reporting.
- Rationale: Bulk changes are powerful but risky; clear intent confirmation reduces accidental damage.
- Alternatives considered:
  - One-click bulk apply: rejected due to higher risk of irreversible mistakes.

## Decision 6: Capture structured, auditable change history
- Decision: Log actor, target, operation, timestamp, and before/after snapshots for all governance mutations.
- Rationale: Accountability and troubleshooting require reproducible change history.
- Alternatives considered:
  - Store only latest state: rejected because root-cause analysis becomes unreliable.

## Decision 7: Define bounded propagation expectations
- Decision: Define a contract that approved edits are reflected in downstream cart intelligence reads within one minute.
- Rationale: Merchant trust depends on visible and timely impact of their edits.
- Alternatives considered:
  - Eventual consistency without SLA: rejected because it is hard to operate and validate.
