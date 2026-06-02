# Implementation Plan: Bundle Rule Manager

**Branch**: `022-bundle-rule-manager` | **Date**: 2026-06-02 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/022-bundle-rule-manager/spec.md`

## Summary

Deliver a merchant-facing Bundle Rule Manager that supports safe bundle rule authoring, deterministic preview and overlap resolution, and lifecycle governance (draft, active, paused, archived) while exposing stable outputs for cart intelligence and downstream discount/cart-transform consumers.

## Technical Context

**Language/Version**: TypeScript 5.x, React 19, React Router 7.x  
**Primary Dependencies**: `@shopify/shopify-app-react-router`, `@shopify/polaris`, `@shopify/app-bridge-react`, Prisma 6.x, Zod 3.x  
**Storage**: PostgreSQL via Prisma (`BundleRule`, rule requirements, lifecycle metadata, audit trails)  
**Testing**: Vitest unit/integration tests for matcher logic, validation, route actions, and preview behavior  
**Target Platform**: Shopify embedded admin app on Vercel serverless runtime  
**Project Type**: Shopify embedded web application feature (admin UI + backend services)  
**Performance Goals**: Rule preview responses <= 200ms p95 for carts up to 20 lines; deterministic overlap resolution under 50ms compute time  
**Constraints**: Polaris/App Bridge compliance for admin surfaces; deterministic non-LLM rule evaluation; Shopify Function compatibility requires compact projected outputs; no breaking changes to existing cart recommendation APIs  
**Scale/Scope**: Up to ~10k products per merchant, O(10^2) active bundle rules, multi-rule overlap handling in a single cart context

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
- Bundle management uses app-owned persisted configuration and deterministic computation; no runtime AI inference is introduced in bundle evaluation paths.
- Route actions are boundary-validated before persistence changes and before preview execution.
- Existing webhook/HMAC responsibilities remain unchanged; this feature does not introduce new webhook entry points.

## Project Structure

### Documentation (this feature)

```text
specs/022-bundle-rule-manager/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── bundle-rule-manager-admin-contract.md
│   ├── bundle-rule-evaluation-contract.md
│   └── bundle-rule-projection-contract.md
└── tasks.md
```

### Source Code (repository root)

```text
app/
├── routes/
│   └── app.bundles.tsx
├── lib/
│   ├── cart-intelligence/
│   │   ├── bundles.ts
│   │   └── recommendations.ts
│   ├── knowledge-graph/
│   │   └── relationships.ts
│   └── db/
│       └── queries.ts
prisma/
└── schema.prisma
tests/
├── integration/
│   └── routes/
└── unit/
    └── cart-intelligence/
```

**Structure Decision**: Extend the existing Shopify embedded app architecture in place. `app/routes/app.bundles.tsx` remains the merchant-facing control surface, deterministic evaluation logic lives in `app/lib/cart-intelligence/bundles.ts`, persistence and query paths are centralized in `app/lib/db/queries.ts`, and schema state/lifecycle support is modeled via Prisma.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| None | N/A | N/A |

## Phase 0: Research Output

Research findings are documented in [research.md](./research.md):

1. Bundle rules should be persisted as first-class relational configuration, not opaque blobs.
2. Rule evaluation must be deterministic with explicit overlap policy and tie-breaking.
3. Preview must execute the same decision logic used for active evaluation.
4. Lifecycle governance requires auditable transitions and safe rollback semantics.
5. Downstream discount/cart-transform consumers need compact projected rule payloads.

## Phase 1: Design Output

- Data model: [data-model.md](./data-model.md)
- Contracts:
  - [contracts/bundle-rule-manager-admin-contract.md](./contracts/bundle-rule-manager-admin-contract.md)
  - [contracts/bundle-rule-evaluation-contract.md](./contracts/bundle-rule-evaluation-contract.md)
  - [contracts/bundle-rule-projection-contract.md](./contracts/bundle-rule-projection-contract.md)
- Quickstart: [quickstart.md](./quickstart.md)

## Post-Design Constitution Check

- [x] Design scopes data access to minimum required fields across rule CRUD, preview, and projection workflows. Principle III: PASS.
- [x] All mutation and preview boundaries specify explicit schema validation and actionable errors. Principle II: PASS.
- [x] No webhook changes are introduced; existing HMAC-verified handlers remain intact. Principles I & II: PASS.
- [x] Planned interfaces remain strictly typed through route payloads, service contracts, and persistence models. Principle IV: PASS.
- [x] Unit and integration tests are explicitly planned for evaluation logic, overlap cases, and admin workflows. Principle V: PASS.
- [x] Merchant-facing management surfaces remain Polaris/App Bridge compliant. Principle I: PASS.

**Post-Design Gate Result**: PASS
