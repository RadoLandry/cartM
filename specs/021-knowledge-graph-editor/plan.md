# Implementation Plan: Knowledge Graph Editor

**Branch**: `021-knowledge-graph-editor` | **Date**: 2026-06-02 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/021-knowledge-graph-editor/spec.md`

## Summary

Deliver a merchant-facing Knowledge Graph Editor that enables confident governance of product classifications, relationships, and size mappings with strong validation, auditable edits, and efficient bulk operations so downstream cart intelligence remains accurate and current.

## Technical Context

**Language/Version**: TypeScript 5.x, React 19, React Router 7.x  
**Primary Dependencies**: `@shopify/shopify-app-react-router`, `@shopify/polaris`, `@shopify/app-bridge-react`, Prisma 6.x, Zod 3.x  
**Storage**: PostgreSQL via Prisma (`Product`, `ProductRelationship`, size mapping tables, change logs, override metadata)  
**Testing**: Vitest unit/integration tests for validation logic, route handlers, and core editor workflows  
**Target Platform**: Embedded Shopify Admin app surfaces (desktop-first, responsive fallback)  
**Project Type**: Shopify embedded web application feature (admin UI + backend services)  
**Performance Goals**: Review/filter/search interactions <= 500ms p95 for 1k-product catalogs; save propagation <= 60s for downstream intelligence usage  
**Constraints**: Polaris/App Bridge compliance for admin UI; strict input validation at boundaries; no raw untyped DB mutation paths; no storefront-side behavior changes in this phase  
**Scale/Scope**: Primary scope is admin governance workflows for catalogs up to ~10k products with focused operations on flagged subsets

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] All new GraphQL queries are field-minimal — no over-fetching (Principle III)
- [x] All external inputs validated and sanitized at network boundaries (Principle II)
- [x] Webhook handlers include HMAC signature verification (Principles I & II)
- [x] TypeScript strict mode passes with no new unexcused `any` escapes (Principle IV)
- [x] New business logic has corresponding tests before/alongside implementation (Principle V)
- [x] All admin UI uses Polaris components and App Bridge (Principle I)
- [x] No secrets hard-coded or committed to source control (Principle II)

**Gate Result**: PASS

Notes:
- The feature is scoped to admin governance, so Polaris/App Bridge conformance is a primary non-negotiable gate.
- Existing webhook/HMAC behavior is not modified, but remains an invariant for affected product intelligence update flows.

## Project Structure

### Documentation (this feature)

```text
specs/021-knowledge-graph-editor/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── knowledge-graph-editor-api-contract.md
│   ├── knowledge-graph-editor-validation-contract.md
│   └── knowledge-graph-editor-propagation-contract.md
└── tasks.md
```

### Source Code (repository root)

```text
app/
├── routes/
│   └── app.knowledge-graph.tsx
├── components/
│   └── admin/
│       └── (knowledge graph editor views and controls)
├── lib/
│   ├── knowledge-graph/
│   │   ├── taxonomy.ts
│   │   ├── relationships.ts
│   │   └── sizing.ts
│   └── db/
│       └── queries.ts
prisma/
└── schema.prisma
tests/
├── integration/
│   └── knowledge-graph-editor/
└── unit/
    └── knowledge-graph-editor/
```

**Structure Decision**: Extend the existing admin route and knowledge-graph modules in-place so governance workflows remain aligned with current Shopify embedded app architecture and avoid introducing parallel service boundaries.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| None | N/A | N/A |

## Phase 0: Research Output

Research findings are documented in [research.md](./research.md):

1. Prioritize a review queue driven by confidence and impact.
2. Use explicit override precedence over auto-generated intelligence.
3. Enforce server-side validation before persisting edits.
4. Apply optimistic concurrency for conflicting admin edits.
5. Use confirmable bulk operations with preview and rollback-safe failure semantics.
6. Emit auditable change history with structured before/after payloads.
7. Ensure downstream recommendation modules consume latest approved data within bounded latency.

## Phase 1: Design Output

- Data model: [data-model.md](./data-model.md)
- Contracts:
  - [contracts/knowledge-graph-editor-api-contract.md](./contracts/knowledge-graph-editor-api-contract.md)
  - [contracts/knowledge-graph-editor-validation-contract.md](./contracts/knowledge-graph-editor-validation-contract.md)
  - [contracts/knowledge-graph-editor-propagation-contract.md](./contracts/knowledge-graph-editor-propagation-contract.md)
- Quickstart: [quickstart.md](./quickstart.md)

## Post-Design Constitution Check

- [x] Planned reads/writes are scoped to required product intelligence fields and avoid unnecessary payloads. Principle III: PASS.
- [x] All mutation boundaries specify input schema validation and rejection semantics for invalid or ambiguous edits. Principle II: PASS.
- [x] Webhook path remains unchanged and retains existing verified HMAC behavior. Principles I & II: PASS.
- [x] Design artifacts enforce typed contracts for request/response and persistence operations. Principle IV: PASS.
- [x] Unit/integration coverage is explicitly planned for review queue logic, validation failures, bulk workflows, and propagation. Principle V: PASS.
- [x] Admin interface design remains Polaris/App Bridge aligned for embedded Shopify UX compliance. Principle I: PASS.
- [x] No secrets or sensitive constants are introduced in planning artifacts. Principle II: PASS.

**Post-Design Gate Result**: PASS
