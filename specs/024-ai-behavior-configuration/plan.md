# Implementation Plan: AI Behavior Configuration

**Branch**: `024-ai-behavior-configuration` | **Date**: 2026-06-02 | **Spec**: `specs/024-ai-behavior-configuration/spec.md`
**Input**: Feature specification from `/specs/024-ai-behavior-configuration/spec.md`

## Summary

Deliver a merchant-facing AI Behavior Configuration surface that supports draft editing, preview testing, explicit publish, version history rollback, and audited change tracking. Implementation will centralize behavior policy in a typed configuration contract, inject published settings into chat prompt assembly/bootstrap payloads, and preserve safe fallback behavior to the last valid published configuration.

## Technical Context

**Language/Version**: TypeScript 5.x, React 19.x, React Router 7.x  
**Primary Dependencies**: `@shopify/shopify-app-react-router`, `@shopify/polaris`, `@shopify/app-bridge-react`, Prisma 6.x, Zod 3.x, Vitest  
**Storage**: PostgreSQL via Prisma (`Json` fields for behavior settings, starter prompts, preview traces, and audit snapshots)  
**Testing**: Vitest unit/integration, route action tests for config and preview/publish flows  
**Target Platform**: Shopify embedded admin app + existing server routes on Vercel  
**Project Type**: Web application (embedded Shopify admin + backend API routes)  
**Performance Goals**: Configuration read path added to storefront chat must add <= 50 ms p95; publish and rollback actions complete <= 2 s p95; preview first response <= 3 s p95  
**Constraints**: Polaris/App Bridge compliance for admin pages, strict TypeScript, bounded prompt size for custom guidance, no storefront outage on invalid draft, no secrets in stored config  
**Scale/Scope**: Multi-tenant per-shop configuration with version history; single active published version per shop; moderate admin write volume and high storefront read volume

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Pre-Research Gate Status:

- [x] All new GraphQL queries are field-minimal - no over-fetching (Principle III)
- [x] All external inputs validated and sanitized at network boundaries (Principle II)
- [x] Webhook handlers include HMAC signature verification (Principles I & II)
- [x] TypeScript strict mode passes with no new unexcused `any` escapes (Principle IV)
- [x] New business logic has corresponding tests before/alongside implementation (Principle V)
- [x] All admin UI uses Polaris components and App Bridge (Principle I)
- [x] No secrets hard-coded or committed to source control (Principle II)

Post-Design Re-Check (after Phase 1 artifacts):

- [x] Contracted endpoints limit payloads to required fields and avoid over-fetching patterns
- [x] All route/action payloads are validated with Zod schemas before persistence
- [x] No webhook path changes are required for this feature; existing HMAC boundaries remain intact
- [x] Planned data models and helpers remain strictly typed with no new `any` escapes
- [x] Unit and integration tests are explicitly mapped in quickstart for draft/preview/publish/rollback flows
- [x] Admin experience remains Polaris-first and embedded via App Bridge
- [x] No secret data is introduced into configuration payloads or planning artifacts

## Project Structure

### Documentation (this feature)

```text
specs/024-ai-behavior-configuration/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── ai-behavior-configuration.openapi.yaml
└── tasks.md
```

### Source Code (repository root)

```text
app/
├── routes/
│   ├── app.settings.tsx
│   ├── api.ai.behavior.config.tsx
│   └── api.ai.behavior.preview.tsx
├── components/
│   └── admin/
│       └── ai-behavior/
├── lib/
│   ├── ai/
│   │   ├── prompts.ts
│   │   ├── schemas.ts
│   │   └── storefront-chat.ts
│   └── db/
│       └── queries.ts

prisma/
└── schema.prisma

tests/
├── integration/
│   └── ai-behavior/
└── unit/
    └── ai/
```

**Structure Decision**: Use the existing embedded web app structure and extend current AI/db modules instead of introducing a new service boundary. Keep configuration UI and actions in `app/routes`, typed contracts in `app/lib/ai/schemas.ts`, prompt application in `app/lib/ai/prompts.ts`, and persistence/audit logic in `app/lib/db/queries.ts` backed by Prisma schema additions.

## Phase 0: Research Output

Research findings are documented in `specs/024-ai-behavior-configuration/research.md` and resolve the following planning topics:

1. Prompt policy composition strategy (tone, aggressiveness, safety priority, custom guidance).
2. Draft/publish/rollback persistence and audit model aligned with existing admin configuration patterns.
3. Preview endpoint and payload contract strategy aligned with current API validation patterns.
4. Fallback strategy that guarantees storefront continuity on invalid drafts or publish failures.

## Phase 1: Design & Contracts Output

1. Data model documented in `specs/024-ai-behavior-configuration/data-model.md`.
2. External interface contract documented in `specs/024-ai-behavior-configuration/contracts/ai-behavior-configuration.openapi.yaml`.
3. Developer/operator flow documented in `specs/024-ai-behavior-configuration/quickstart.md`.
4. Agent context updated in `.github/copilot-instructions.md` to point to this feature plan.

## Data Migration and Backfill Notes

- The `AIBehaviorDraft`, `AIBehaviorPublishedVersion`, `AIBehaviorAuditEntry`, and `AIBehaviorPreviewRun` tables are additive (new tables, no column changes to existing models), so the Prisma migration in `prisma/migrations/20260602135351_ai_behavior_configuration/` is safe to apply without downtime for existing shops.
- No backfill script is required: shops with no `AIBehaviorDraft`/`AIBehaviorPublishedVersion` rows are handled by `getActiveAIBehaviorConfigWithFallback` (`app/lib/db/queries.ts`), which falls back from `active` -> `draft` -> hard-coded `AI_BEHAVIOR_DEFAULTS` (`app/lib/ai/behavior-config.ts`) when no rows exist yet. This is exercised by `tests/integration/ai-behavior/fallback-runtime.test.ts`.
- A shop's first draft save (`saveAIBehaviorDraft`) upserts its `AIBehaviorDraft` row on demand; there is no need to pre-provision rows for existing installs before this feature ships.
- Rollback targets only ever reference `AIBehaviorPublishedVersion` rows created after this feature ships, so there is no historical version data to migrate from a prior format.

## Complexity Tracking

No constitution violations or exceptional complexity justifications identified at planning time.
