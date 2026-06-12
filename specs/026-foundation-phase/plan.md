# Implementation Plan: Foundation Phase

**Branch**: `026-foundation-phase` | **Date**: 2026-06-10 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/026-foundation-phase/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Deliver a production-ready Phase 0 baseline for CartMind: installable Shopify embedded app shell, subscription-gated access, persistent data readiness, authenticated storefront proxy channel, and validated AI response path. The implementation approach is to harden and verify existing platform foundations with explicit health checks, integration tests, and release validation steps so Phase 1 product intelligence can start without infrastructure churn.

## Technical Context

**Language/Version**: TypeScript 5.9, Node.js >= 20.19  
**Primary Dependencies**: React Router 7, @shopify/shopify-app-react-router, @shopify/polaris, @shopify/app-bridge-react, Prisma 6, Vercel AI SDK 6, Zod 4  
**Storage**: Prisma-backed SQL database (dev SQLite, production PostgreSQL target), Shopify session storage via Prisma adapter  
**Testing**: Vitest 4 (unit/integration), existing lint + typecheck quality gates  
**Target Platform**: Shopify embedded admin app + Shopify storefront App Proxy + server-rendered backend routes  
**Project Type**: Web application (Shopify embedded SaaS app)  
**Performance Goals**: Foundation validation APIs respond within 5s for 95% of checks; preserve storefront proxy responsiveness suitable for cart experiences  
**Constraints**: Must follow Shopify embedded app model, HMAC verification on proxy/webhooks, billing-gated access, strict TypeScript and lint rules  
**Scale/Scope**: Phase 0 only; foundational setup and verification for one deployable merchant app baseline across dev/preview

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

*Read `.specify/memory/constitution.md` for the full principle definitions. The
standard gates for CartMind (Principles I–V) are:*

- [x] All new GraphQL queries are field-minimal — no over-fetching (Principle III)
- [x] All external inputs validated and sanitized at network boundaries (Principle II)
- [x] Webhook handlers include HMAC signature verification (Principles I & II)
- [x] TypeScript strict mode passes with no new unexcused `any` escapes (Principle IV)
- [x] New business logic has corresponding tests before/alongside implementation (Principle V)
- [x] All admin UI uses Polaris components and App Bridge (Principle I)
- [x] No secrets hard-coded or committed to source control (Principle II)

Initial gate review (pre-research): PASS, with implementation checks required in tasks for proxy validation, billing gate behavior, and foundation health observability.

## Project Structure

### Documentation (this feature)

```text
specs/026-foundation-phase/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
app/
├── routes/
│   ├── app._index.tsx
│   ├── app.billing.tsx
│   ├── api.ai.chat.tsx
│   └── webhooks.tsx
├── lib/
│   ├── ai/
│   ├── shopify/
│   └── db/
├── shopify.server.ts
└── db.server.ts

prisma/
├── schema.prisma
└── migrations/

extensions/
├── cart-drawer-block/
├── checkout-ui/
├── discount-function/
└── cart-transform/

tests/
├── integration/
├── unit/
└── helpers/
```

**Structure Decision**: Use the existing single web-application repository layout centered on `app/` routes and library modules, with foundation work focused on billing, auth/proxy security, data persistence setup, and validation test coverage.

## Phase 0: Research

Research outputs are documented in [research.md](./research.md) and resolve implementation choices for:
- Billing gate strategy and entitlement checks
- App Proxy authentication and signature validation
- Foundation health checks and observable diagnostics
- Validation pipeline and release gate commands

## Phase 1: Design & Contracts

Design outputs are documented in:
- [data-model.md](./data-model.md)
- [contracts/foundation-interfaces.md](./contracts/foundation-interfaces.md)
- [quickstart.md](./quickstart.md)

These artifacts define the Phase 0 entities, API contracts, and operator workflow required to execute and validate the foundation increment.

## Post-Design Constitution Check

- [x] All new GraphQL queries are field-minimal — no over-fetching (Principle III)
- [x] All external inputs validated and sanitized at network boundaries (Principle II)
- [x] Webhook handlers include HMAC signature verification (Principles I & II)
- [x] TypeScript strict mode passes with no new unexcused `any` escapes (Principle IV)
- [x] New business logic has corresponding tests before/alongside implementation (Principle V)
- [x] All admin UI uses Polaris components and App Bridge (Principle I)
- [x] No secrets hard-coded or committed to source control (Principle II)

Gate result: PASS.

## Complexity Tracking

No constitution violations requiring justification.
