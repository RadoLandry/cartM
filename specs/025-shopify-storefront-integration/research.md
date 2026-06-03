# Research: Shopify Storefront Integration

## Decision: Mount CartMind through the existing theme extension with stable drawer/page lifecycle discovery

**Rationale**: The PRD requires CartMind to appear in custom AJAX cart drawers and standard cart pages while preserving existing theme behavior. The repo already has `extensions/cart-drawer-block/` and `storefront-widget/`, so the integration should extend that path. The widget should discover cart surfaces, create one CartMind host per surface, and keep the host outside zones that themes replace during cart refreshes. Standard cart pages can continue using the cart-page fallback placement.

**Alternatives considered**: Legacy ScriptTag injection was rejected because the constitution forbids legacy storefront injection and Shopify extension delivery is the sanctioned path. Rendering inside AJAX-replaced cart content was rejected because it would be destroyed on drawer refresh. A full iframe fallback was deferred because Shadow DOM isolation is sufficient for the initial supported-theme target and keeps UX more integrated.

## Decision: Synchronize cart state with fetch interception, mutation observation, and bounded fallback polling

**Rationale**: Custom Shopify themes often lack a shared cart event bus and may update cart drawers by replacing DOM fragments. The most reliable user-facing strategy is to refresh from `/cart.js` after observed drawer mutations, after known cart endpoint calls, and at a bounded interval while the drawer is open. This supports drawer quantity edits, removals, product-page add-to-cart notifications, and late drawer opens without relying on stale initial Liquid data.

**Alternatives considered**: Relying only on initial mount configuration was rejected because cart contents can change while the drawer is closed. Polling constantly was rejected because it wastes shopper/browser resources. Depending on theme-specific events was rejected because compatibility requires working across multiple theme implementations.

## Decision: Treat temporary cart notifications as synchronization triggers, not render targets

**Rationale**: The PRD explicitly says CartMind should not inject UI into temporary cart notification popups. Product-page add-to-cart flows still matter, so the widget should update internal state after add-to-cart calls and wait to render visible guidance in the drawer or cart page.

**Alternatives considered**: Showing CartMind in notifications was rejected because it would add a third surface, create layout risk in short-lived popups, and conflict with the spec's non-regression target. Ignoring notification-only flows was rejected because recommendations would be stale when the shopper later opens the drawer.

## Decision: Keep style and scroll behavior isolated from the merchant theme

**Rationale**: The storefront must coexist with existing theme CSS, drawer mechanics, body scroll locks, Fast Simon-style third-party sections, loyalty widgets, sizing widgets, and checkout controls. The widget should render inside a Shadow DOM, use unique `data-cartmind-*` attributes, and avoid modifying body classes or third-party containers. Chat scroll should be contained within CartMind's own panel.

**Alternatives considered**: Global CSS was rejected because it risks breaking merchant themes and third-party widgets. Reusing the theme's body scroll lock was rejected because cleanup could accidentally remove classes owned by the theme. Wrapping existing drawer sections was rejected because it changes visual hierarchy and event propagation.

## Decision: Use compact checkout guidance items and adapt to available checkout placements

**Rationale**: Checkout guidance must show only high-impact warnings, bundle offers, and kit nudges. Shopify checkout placement options vary by plan and configuration, so the experience should expose a compact prioritized guidance model and render it only where available. No-guidance carts should render nothing.

**Alternatives considered**: A full chat or recommendation UI at checkout was rejected because checkout must stay concise and extension bundles are tightly constrained. Hard-coding Shopify Plus-only placements was rejected because the spec requires graceful adaptation for merchants with fewer placement options.

## Decision: Precompute and project bundle outcomes for Shopify Function compatible paths

**Rationale**: Shopify Functions cannot use Node APIs, Prisma, `fetch`, or external services and must execute within a tight CPU budget. Bundle rules and match projections should therefore be compact, deterministic, and sufficient for discount/presentation decisions without recomputing the entire cart-intelligence graph in the function runtime.

**Alternatives considered**: Running full bundle detection inside the Function was rejected due to runtime and data access limits. Applying all bundle discounts through backend APIs was rejected because checkout discount application must happen in Shopify's sanctioned discount path. A single best-effort discount without projection versioning was rejected because overlapping rules and future schema changes require deterministic handling.

## Decision: Keep the theme extension loader thin and serve heavier widget output from app-hosted public assets

**Rationale**: Repository memory records that Shopify theme validation can reject large referenced block assets around a 10 KB threshold. The existing `build:storefront-widget` emits `public/storefront/cartmind-chat-app.js`, so the extension asset should remain a thin loader/config surface while the heavier widget bundle is built separately and monitored against the 50 KB initial and 100 KB total gzipped budgets.

**Alternatives considered**: Putting the full widget bundle in the theme extension asset was rejected because of validation and update-size risk. Inlining all CSS/logic in Liquid was rejected because it is hard to type, test, and isolate. Loading a broad component runtime was rejected because it threatens the storefront performance budget.

## Decision: Emit integration health events for render, sync, fallback, and guidance outcomes

**Rationale**: The spec requires tracking enough behavior to verify rendering, synchronization, guidance impressions, checkout guidance display, bundle qualification, and graceful fallback. A small event model enables compatibility monitoring and future analytics without persisting bulky browser state.

**Alternatives considered**: Relying only on local QA was rejected because theme compatibility regressions can be merchant-specific. Logging full cart payloads was rejected because health events need only diagnostic and aggregate attributes, not unnecessary shopper data.
