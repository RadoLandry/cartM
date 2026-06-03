# Implementation Plan: Shopify Storefront Integration

**Branch**: `025-shopify-storefront-integration` | **Date**: 2026-06-03 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/025-shopify-storefront-integration/spec.md`

## Summary

Deliver the storefront integration layer that makes CartMind reliable on Shopify cart surfaces and checkout: a theme app extension/App Embed driven storefront widget for cart drawer and cart page guidance, robust cart-state synchronization across custom AJAX drawers and add-to-cart notification flows, checkout guidance for warnings/offers/nudges, and Shopify Function compatible bundle discount/presentation outputs. Implementation extends the existing `storefront-widget/`, `extensions/cart-drawer-block/`, app-proxy bootstrap, cart-intelligence, bundle, analytics, and Shopify extension seams while preserving the merchant theme and third-party cart widgets.

## Technical Context

**Language/Version**: TypeScript 5.9, React 18.3 in the current app/widget, React Router 7.12, Node 20.19+ or 22.12+  
**Primary Dependencies**: `@shopify/shopify-app-react-router`, Shopify Theme App Extension tooling, Shopify Functions extensions, `@shopify/app-bridge-react`, Prisma 6.x, Zod 4.x, Vite 6.x, Vitest 4.x, existing `ai` 6.x storefront chat stack  
**Storage**: PostgreSQL via Prisma for existing shop/session, cart analytics, bundle rules, and generated integration health events; Shopify metafields/function input payloads for compact downstream bundle/checkout projections where required  
**Testing**: Vitest unit/integration tests for cart synchronization, app-proxy route contracts, checkout guidance models, bundle projection/function fixtures; Shopify theme validation; focused storefront compatibility/manual QA across cart drawer, cart page, checkout, and no-guidance carts  
**Target Platform**: Shopify online store theme extension assets in shopper browsers, Shopify checkout extension/function runtimes, and the existing React Router backend on Vercel/Node  
**Project Type**: Embedded Shopify app plus storefront widget bundle and Shopify extensions  
**Performance Goals**: Shopper-facing widget p95 cart load time remains at or below 300 ms; CartMind assistance visible or intentionally deferred within 1 second for 95% of cart openings; cart changes reflected within 2 seconds while drawer is open; add-to-cart next-open freshness within 5 seconds; storefront widget initial payload under 50 KB gzipped and total lazy footprint under 100 KB gzipped; no measurable cart drawer layout regression  
**Constraints**: Theme behavior and third-party widgets must not be modified; CartMind styles must remain isolated; no body scroll-lock changes; checkout UI must use Shopify checkout extension primitives only; Shopify Function paths cannot use Node APIs, Prisma, fetch, or external calls and must stay within the 10 ms CPU budget; all storefront/app-proxy inputs require validation; no legacy ScriptTag delivery  
**Scale/Scope**: One storefront integration capability covering cart drawer, cart page, checkout guidance, bundle discount/presentation outcomes, and integration health analytics for supported modern Shopify themes

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

**Gate Result**: PASS

Notes:
- Shopify Admin GraphQL access remains on existing backend/admin surfaces; storefront cart state is read from storefront cart payloads and compact backend projections, so no broad Admin API reads are planned for shopper critical paths.
- App-proxy/bootstrap requests, storefront widget payloads, checkout guidance payloads, analytics events, and bundle projection inputs will be validated with Zod or extension/runtime-specific schema checks before use.
- No new webhook handler is required by this plan; if implementation later adds cart/webhook preprocessing, it must use the existing Shopify SDK HMAC verification boundary.
- Storefront and extension code will stay strictly typed through shared schemas and discriminated models; Shopify Function code must avoid dynamic untyped payload handling.
- Test scope explicitly maps to the spec's acceptance scenarios, non-regression contract, and bundle edge cases.
- No new admin UI is introduced. Existing admin surfaces remain Polaris/App Bridge governed.

## Project Structure

### Documentation (this feature)

```text
specs/025-shopify-storefront-integration/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── storefront-widget-integration-contract.md
│   ├── checkout-guidance-contract.md
│   └── bundle-storefront-outcome-contract.md
└── tasks.md
```

### Source Code (repository root)

```text
app/
├── lib/
│   ├── ai/
│   │   └── schemas.ts                         -- extend shared storefront guidance schemas
│   ├── analytics/
│   │   └── cart-events.ts                     -- extend integration health and guidance impression events
│   ├── cart-intelligence/
│   │   ├── recommendations.ts                 -- reuse cart guidance payloads for widget and checkout nudges
│   │   ├── size-conflicts.ts                  -- source high-confidence checkout warnings
│   │   └── bundles.ts                         -- source bundle qualification outcomes
│   └── shopify/
│       ├── app-proxy.ts                       -- reuse/extend app-proxy bootstrap helpers
│       └── storefront-integration.ts          -- new integration payload/projection helpers
├── routes/
│   ├── api.app-proxy.chat-bootstrap.tsx       -- reuse authenticated app-proxy bootstrap path
│   ├── api.ai.chat.tsx                        -- existing direct streaming chat endpoint integration point
│   └── api.ai.recommendations.tsx             -- reuse/extend storefront guidance response shape
storefront-widget/
├── vite.config.ts                             -- keep library build and bundle budget checks
└── src/
    ├── index.tsx                              -- extend from static mount discovery to drawer/page lifecycle discovery
    ├── CartMindChat.tsx                       -- compose chat entry with synchronized cart snapshots
    ├── components/
    │   └── integration/                       -- cart surface shell, guidance cards, warnings, completeness UI
    ├── hooks/
    │   ├── useCartSurfaceLifecycle.ts         -- drawer open/close and mutation observation
    │   ├── useCartStateSync.ts                -- /cart.js refresh, fetch interception, fallback polling
    │   └── useStorefrontChat.ts               -- reuse chat transport with refreshed cart snapshots
    └── styles/
        └── chat.css                           -- shadow-root scoped styles only
extensions/
└── cart-drawer-block/
    ├── blocks/
    │   └── ai-cart.liquid                     -- app embed/cart-page fallback mount config
    ├── assets/
    │   └── ai-cart.js                         -- thin Shopify-hosted loader only
    └── locales/
        └── en.default.json                    -- merchant-facing extension labels
public/
└── storefront/
    └── cartmind-chat-app.js                   -- app-hosted widget bundle emitted by build:storefront-widget
tests/
├── integration/
│   ├── routes/
│   │   ├── storefront-integration-bootstrap.test.ts
│   │   └── checkout-guidance-contract.test.ts
│   └── storefront/
│       └── cartmind-theme-compatibility.test.ts
├── unit/
│   ├── storefront/
│   │   ├── cart-surface-lifecycle.test.ts
│   │   ├── cart-state-sync.test.ts
│   │   └── integration-health-events.test.ts
│   └── cart-intelligence/
│       └── bundle-storefront-outcomes.test.ts
└── helpers/
    └── storefront-integration-fixtures.ts
```

**Structure Decision**: Extend the existing React Router app, `storefront-widget/` bundle, and `extensions/cart-drawer-block/` theme extension rather than introducing a new app or service. Keep the Shopify theme extension asset as a thin loader and emit heavier widget code to `public/storefront/` to preserve Shopify theme validation limits already observed in this repo.

## Phase 0: Research Output

Research findings are documented in [research.md](./research.md) and resolve the following planning topics:

1. Storefront widget mounting strategy for AJAX cart drawers and standard cart pages.
2. Cart state synchronization strategy for drawer mutations, product-page add-to-cart flows, and fallback polling.
3. Checkout guidance delivery strategy across plan-dependent checkout placements.
4. Bundle discount/presentation strategy compatible with Shopify Function runtime limits.
5. Non-regression and third-party widget coexistence strategy.
6. Bundle budget and asset delivery strategy aligned with Shopify theme validation.
7. Analytics/integration health event strategy for render, sync, fallback, and guidance outcomes.

## Phase 1: Design & Contracts Output

1. Data model documented in [data-model.md](./data-model.md).
2. External/interface contracts documented in:
   - [contracts/storefront-widget-integration-contract.md](./contracts/storefront-widget-integration-contract.md)
   - [contracts/checkout-guidance-contract.md](./contracts/checkout-guidance-contract.md)
   - [contracts/bundle-storefront-outcome-contract.md](./contracts/bundle-storefront-outcome-contract.md)
3. Developer/operator flow documented in [quickstart.md](./quickstart.md).
4. Agent context updated in `.github/copilot-instructions.md` to point to this feature plan.

## Post-Design Constitution Check

- [x] Contracted storefront and checkout payloads are compact and avoid introducing new shopper-path Admin GraphQL over-fetching. Principle III: PASS.
- [x] All route, widget, checkout, analytics, and bundle projection inputs have explicit validation boundaries in the contracts and data model. Principle II: PASS.
- [x] No new webhook path is required; any future webhook preprocessing remains gated by existing Shopify SDK HMAC verification. Principles I & II: PASS.
- [x] Shared schemas, discriminated models, and Shopify Function payload contracts avoid unexcused `any` escapes. Principle IV: PASS.
- [x] Quickstart and contracts map focused Vitest and Shopify validation coverage to the user stories and edge cases. Principle V: PASS.
- [x] No new admin UI is introduced; existing embedded admin requirements remain Polaris/App Bridge compliant. Principle I: PASS.
- [x] No new secrets are stored in code or contracts; app URLs/tokens remain environment/runtime configured. Principle II: PASS.

**Post-Design Gate Result**: PASS

## Complexity Tracking

No constitution violations or exceptional complexity justifications identified at planning time.
