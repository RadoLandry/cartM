# Phase 0 Research: AI Behavior Configuration

## Decision 1: Centralized Behavior Profile Composed into System Prompt

- Decision: Build a single per-shop published behavior profile that is composed into the storefront chat system prompt at generation time.
- Rationale: The current prompt assembly already has one prompt builder entrypoint (`buildStorefrontChatSystemPrompt`), making policy injection deterministic and testable.
- Alternatives considered:
  - Store behavior settings only in UI state: rejected because storefront routes need authoritative server-side behavior.
  - Inline prompt customization per request without persisted profile: rejected due to inconsistency and lack of auditability.

## Decision 2: Draft + Published Version Separation with Immutable History

- Decision: Keep editable draft state separate from the active published version and persist immutable published snapshots for rollback.
- Rationale: Feature requirements mandate explicit publish flow, rollback support, and safe fallback behavior.
- Alternatives considered:
  - In-place mutation of active config only: rejected because it cannot provide safe preview and rollback guarantees.
  - Full event-sourcing for every keystroke: rejected as unnecessary complexity for this scope.

## Decision 3: Snapshot-Based Audit Records on Publish/Rollback

- Decision: Capture before/after JSON snapshots with actor and timestamp for publication and rollback transitions.
- Rationale: Existing admin-managed domains in this repo already use structured audit records and change logs; snapshot diffs are easy to inspect and restore.
- Alternatives considered:
  - Free-form text changelog: rejected because it is not reliably machine-auditable.
  - Field-level relational history tables for each setting: rejected as over-modeled for a compact behavior profile.

## Decision 4: Preview Contract as Dedicated API with Schema Validation

- Decision: Implement preview via dedicated API contract with strict Zod validation and structured response status (`READY`/`RUNNING`/`ERROR`).
- Rationale: Existing API routes in the repo use strict request schema validation and explicit typed payloads; preview operations may need async status.
- Alternatives considered:
  - Preview computed only in page action response: rejected because it couples UI rendering and preview latency too tightly.
  - Unstructured preview text response: rejected because it reduces testability and policy-check visibility.

## Decision 5: Conversation Starters Served from Bootstrap

- Decision: Include configured conversation starters in the chat bootstrap payload so storefront UI receives active defaults at session init.
- Rationale: Bootstrap already distributes chat session metadata and limits; starters naturally belong to this payload and avoid extra round trips.
- Alternatives considered:
  - Hardcoded starters in storefront widget: rejected because merchants cannot tune behavior without deployment.
  - Separate fetch endpoint for starters: rejected because it increases client complexity and startup latency.

## Decision 6: Safety-First Fallback to Last Valid Published Profile

- Decision: If draft validation fails, preview fails, or publish fails, storefront chat continues with the most recent valid published profile and default safety constraints.
- Rationale: Requirements explicitly require no storefront interruption and no unsafe behavior after configuration errors.
- Alternatives considered:
  - Disable chat when config is invalid: rejected due to poor shopper experience and avoidable revenue impact.
  - Use draft profile as fallback: rejected because drafts can be incomplete or unvalidated.

## Resolved Clarifications

- Preview result persistence: keep short-lived preview run records for auditability and debugging, but do not make them part of active runtime reads.
- Aggressiveness representation: normalized bounded numeric scale (0-1) with UI labels (subtle to assertive).
- Policy precedence: safety constraints remain non-bypassable even when aggressiveness is high.
- Multi-admin edits: optimistic concurrency with explicit version token on draft saves.
