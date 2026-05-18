<!--
SYNC IMPACT REPORT
==================
Version change: [TEMPLATE] → 1.0.0 (initial ratification)
Added sections:
  - Core Principles (I–V): Shopify-First, Security-By-Design, Performance,
    Type Safety & Code Quality, Test-Driven Quality Gates
  - Shopify Platform Standards
  - Development Workflow
  - Governance
Templates requiring updates:
  ✅ plan-template.md — Constitution Check gates updated in this document's
     governance section; template itself has no outdated references
  ✅ spec-template.md — Scope/requirements sections align with new principles;
     no mandatory sections added or removed
  ✅ tasks-template.md — Task categories align with security, performance, and
     Shopify-compliance task types
Deferred TODOs: none
-->

# CartMind Constitution

## Core Principles

### I. Shopify-First Development (NON-NEGOTIABLE)

CartMind MUST be built entirely on Shopify's sanctioned patterns and tooling.
Every feature MUST use the Shopify App React Router template conventions, Polaris
design system components, and App Bridge for embedded UI. Admin API access MUST
go exclusively through `shopify.authenticate.admin(request)` — never via raw
fetch or custom OAuth flows. Webhook handlers MUST validate HMAC signatures using
the Shopify SDK before processing any payload. All user-facing UI MUST render
inside the Shopify Admin iframe using AppBridge; direct browser navigation outside
the embedded context is forbidden. Extensions (Theme App Extensions, App Blocks)
MUST follow Shopify's extension model and MUST NOT inject arbitrary JavaScript
into storefronts.

**Rationale**: Violating Shopify's patterns risks app review rejection, merchant
trust loss, and breaking changes when the platform updates. Compliance is not
optional.

### II. Security-By-Design (NON-NEGOTIABLE)

All data entering the system at network boundaries MUST be validated and sanitized.
Session tokens MUST be managed exclusively by `@shopify/shopify-app-react-router`
— custom session handling is forbidden. Prisma queries MUST use parameterised
inputs only; raw SQL strings that incorporate user data are forbidden. The app
MUST NOT store sensitive merchant data (API keys, payment info) outside encrypted
Shopify-managed storage. All webhook payloads MUST be verified with HMAC before
any processing. Environment secrets MUST be loaded from environment variables
only — never hard-coded or committed to source control. Dependency versions MUST
be pinned and audited regularly (`npm audit`). Any external API call (e.g., AI
inference) MUST use HTTPS only and validate response schemas.

**Rationale**: Shopify requires apps to pass security review. A breach compromises
merchants and their customers, violating GDPR/CCPA and risking delisting.

### III. Performance-Oriented Implementation

Every GraphQL query to the Shopify Admin API MUST request only the fields required
for the operation (no over-fetching). Queries MUST paginate using Shopify's cursor-
based pagination; fetching all records in a single call is forbidden for collections
larger than 250 items. Server-side loaders MUST cache Admin API responses where
data freshness allows (minimum: per-request deduplication). AI inference calls
MUST be non-blocking — use background jobs or streaming; never block the cart render
on an AI response. React components MUST be code-split by route; no synchronous
imports of heavy dependencies in the critical path. Target p95 cart load time
MUST be ≤ 300 ms for the shopper-facing widget.

**Rationale**: Shopify enforces API rate limits (GraphQL cost budget). Slow apps
hurt conversion and can trigger plan throttling.

### IV. Type Safety & Code Quality

TypeScript strict mode (`"strict": true`) MUST be enabled at all times; `any`
casts are forbidden without an explicit suppression comment explaining why. All
Shopify GraphQL responses MUST be typed using generated types from the Shopify
Admin API schema (via `@shopify/api-codegen-preset`). Prisma client types MUST be
used for all database interactions — no raw query results cast to `unknown`. ESLint
with `@shopify/eslint-plugin` MUST run in CI and MUST NOT report errors on merged
code. Code MUST NOT contain `console.log` statements in production paths; use a
structured logger instead.

**Rationale**: Type safety prevents an entire class of runtime bugs. Shopify's
own codegen tooling exists precisely to keep API contract alignment automatic.

### V. Test-Driven Quality Gates

New business logic MUST have unit tests written before or alongside implementation
(Red-Green-Refactor). Shopify webhook handlers MUST have integration tests that
replay real webhook payloads including HMAC validation. The AI recommendation
engine MUST have deterministic unit tests (mocked AI responses) covering at least:
correct kit suggestions, size-conflict detection, and empty-cart edge cases.
Acceptance criteria from each user story in `spec.md` MUST map to at least one
automated test. No PR that reduces overall test coverage below the current baseline
MAY be merged.

**Rationale**: CartMind's AI logic is non-trivial; regressions in recommendation
quality directly hurt merchant revenue and the product's value proposition.

## Shopify Platform Standards

**Stack**: TypeScript · React Router v7 · Shopify App React Router SDK · Polaris
v13 · Prisma ORM · SQLite (dev) / PostgreSQL (prod) · Vite.

**Admin API**: GraphQL only (REST is deprecated for new functionality). MUST stay
within the API version declared in `shopify.app.toml`. Version bumps require an
explicit migration entry in `CHANGELOG.md`.

**Extensions**: Theme App Extensions for storefront widget (App Block). App Bridge
for all embedded admin pages. No legacy ScriptTag injections.

**Deployment**: Shopify CLI (`shopify app deploy`) is the only sanctioned
deployment path. CI MUST run `shopify app build` and the full test suite before
any deploy. Zero-downtime deploys MUST be validated against a staging store before
production.

**Compliance**: App MUST implement the mandatory webhooks: `app/uninstalled`,
`app/scopes_update`, `customers/data_request`, `customers/redact`,
`shop/redact` (GDPR). Handlers MUST respond within 5 seconds.

## Development Workflow

1. **Branch** — every feature starts from a `speckit.git.feature` branch.
2. **Specify** — `spec.md` must exist and be approved before implementation begins.
3. **Plan** — `plan.md` must pass the Constitution Check gates (Principles I–V).
4. **Tasks** — `tasks.md` is generated from `plan.md`; no ad-hoc implementation.
5. **PR** — every PR requires: green CI (lint + typecheck + tests), Constitution
   Check sign-off in the PR description, and at least one reviewer.
6. **Deploy** — staging validation required before production; rollback plan noted.

**Constitution Check Gates** (referenced in plan-template.md):
- [ ] All new GraphQL queries are field-minimal (Principle III)
- [ ] All external inputs are validated at the boundary (Principle II)
- [ ] Webhook handlers include HMAC verification (Principles I & II)
- [ ] TypeScript strict mode passes with no new `any` escapes (Principle IV)
- [ ] New business logic has corresponding tests (Principle V)
- [ ] Polaris components used for all admin UI (Principle I)

## Governance

This constitution supersedes all other documented practices. Amendments require:
1. A PR updating this file with a version bump (see semantic versioning below).
2. Sync Impact Report (HTML comment at top of file) listing changed principles
   and affected templates.
3. Approval from the project lead before merge.

**Versioning policy**:
- MAJOR: Removal or fundamental redefinition of a principle.
- MINOR: New principle or material expansion of guidance.
- PATCH: Clarifications, wording, typo corrections.

Compliance review MUST occur at the start of each feature's planning phase via the
Constitution Check gates above. Any PR failing a gate MUST document the exception
and obtain explicit approval.

**Version**: 1.0.0 | **Ratified**: 2026-05-18 | **Last Amended**: 2026-05-18
