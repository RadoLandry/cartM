# Quickstart: AI Behavior Configuration

## Purpose

Implement and validate merchant-controlled AI behavior settings with draft editing, preview, publish, rollback, and storefront-safe fallback.

## Prerequisites

- Embedded admin app authentication is operational.
- Storefront chat flow is already running with current prompt builder.
- Prisma migration workflow is operational.

## 1) Add Data Model and Persistence Helpers

1. Extend Prisma schema with draft, published version, audit, and preview run entities.
2. Add/extend typed query helpers in `app/lib/db/queries.ts` for:
   - get/update draft,
   - publish transition,
   - rollback transition,
   - audit insertion,
   - active version lookup for storefront runtime.
3. Run migrations and regenerate Prisma client.

Expected outcome:
- Behavior settings and lifecycle transitions are persisted per shop with full auditability.

## 2) Define and Enforce Validation Contracts

1. Add Zod schemas for configuration payloads and preview/publish/rollback requests in `app/lib/ai/schemas.ts`.
2. Enforce input validation in all new route actions/endpoints.
3. Add prompt-budget guards for custom guidance and starter list constraints.

Expected outcome:
- Invalid settings cannot be published and all route boundaries are typed and sanitized.

## 3) Implement Admin Configuration Route

1. Add `app/routes/app.settings.tsx` with Polaris-first UI controls:
   - tone selector,
   - aggressiveness control,
   - safety priority mode,
   - custom guidance editor,
   - conversation starters manager.
2. Add explicit actions for save draft, preview, publish, and rollback.
3. Render latest active version metadata and change history summary.

Expected outcome:
- Merchant admins can manage behavior settings safely in embedded admin.

## 4) Implement Preview and Runtime Integration

1. Add preview API route (`api.ai.behavior.preview.tsx`) returning structured status and scenario results.
2. Add configuration API route (`api.ai.behavior.config.tsx`) for retrieval and mutation workflows where needed.
3. Update `buildStorefrontChatSystemPrompt` to consume active published behavior profile.
4. Extend chat bootstrap response to include active conversation starters.
5. Ensure fallback always uses last valid published profile.

Expected outcome:
- Draft changes are testable before publication and storefront chat behavior updates immediately after publish.

## 5) Validate with Tests

1. Unit tests:
   - schema validation,
   - prompt composition with behavior settings,
   - policy precedence (safety-first vs aggressiveness),
   - fallback selection logic.
2. Integration tests:
   - draft save with concurrency token,
   - preview route statuses and payload shape,
   - publish transition (active/archive swap + audit log),
   - rollback transition.
3. Route/access tests:
   - unauthorized actor denied for mutation actions,
   - invalid payloads return 400 with structured errors.

Expected outcome:
- Acceptance scenarios from the spec are mapped to automated checks.

## 6) Verify Against Success Criteria

1. Time a first-time merchant behavior setup flow.
2. Measure propagation delay from publish to new storefront conversation.
3. Validate preview usefulness with representative scenario prompts.
4. Confirm rollback execution and storefront continuity after simulated failures.

Expected outcome:
- Feature is ready for `/speckit.tasks` decomposition and implementation sequencing.

## Quick Validation Checklist

- Draft fetch/save route returns typed payload and version token.
- Preview endpoint returns `READY` synchronously with structured scenario outputs (the current implementation always computes scenarios inline; `PreviewRunningResponse`/`RUNNING` is reserved for a future async runner and is not emitted today).
- Preview runner failures are caught, logged, and persisted as a `FAILED` preview run, returning a retryable `PREVIEW_RUNNER_FAILED` error instead of an unhandled 500; a preview-run persistence failure still returns the computed `READY` results (best-effort audit trail, not a request blocker).
- Publish and rollback are both served from `POST /api/ai/behavior/config` (rollback via `{ "intent": "rollback", "targetVersionId": ... }`, publish via any other body), not separate `/ai/behavior/publish` / `/ai/behavior/rollback` routes; see `contracts/ai-behavior-configuration.openapi.yaml`.
- Publish action creates a new active version and archives previous active version.
- Rollback action creates a new active snapshot based on selected historical version.
- Audit entries include actor, action type, and before/after snapshots.
- Chat bootstrap includes merchant-configured conversation starters.
- Prompt builder reflects active tone/aggressiveness/safety/guidance settings.
- Config read (loader) and publish/rollback (action) latency are instrumented against the plan budgets (<=50ms / <=2s p95) with a `console.warn` when exceeded; see `app/routes/api.ai.behavior.config.tsx`.
- Tests pass for draft/preview/publish/rollback/fallback paths, including API contract conformance against the Zod response schemas (`tests/integration/ai-behavior/api-contract.test.ts`).

## Validation Run Record

- Date: 2026-09-15.
- Command: `npx vitest run tests/integration/ai-behavior tests/unit/ai/behavior-policy-schema.test.ts tests/unit/ai/prompt-safety-precedence.test.ts tests/unit/ai/prompt-tone-profile.test.ts tests/unit/ai/prompt-aggressiveness.test.ts tests/unit/ai/conversation-starters.test.ts tests/unit/ai/audit-snapshots.test.ts`
- Result: 13 test files passed, 36 tests passed, 0 failed.
- Repo-wide `npx vitest run`: full suite passing (no regressions from AI behavior configuration US1-US3 + polish work).
- `npm run lint`: clean on all AI-behavior-related files (repo-wide lint has pre-existing unrelated failures documented outside this feature's scope).
- `npm run typecheck`: clean on all AI-behavior-related files after fixing a pre-existing Prisma field-casing bug in `app/lib/db/queries.ts` (`db.aiBehaviorDraft` etc. renamed to the Prisma-generated `db.aIBehaviorDraft` etc.).
