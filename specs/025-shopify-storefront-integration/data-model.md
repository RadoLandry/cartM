# Data Model: Shopify Storefront Integration

## Overview

The storefront integration feature coordinates shopper-facing cart surfaces, checkout guidance, bundle outcomes, and operational health tracking. It reuses existing cart-intelligence outputs and storefront chat/session schemas where possible, while adding compact integration state and projection models for theme, checkout, and Shopify Function consumers.

## Entities

### StorefrontIntegrationPlacement

Represents a merchant-enabled place where CartMind may appear.

**Fields**
- `placementId`: Stable identifier for the placement.
- `shop`: Shopify shop domain.
- `surface`: `cart_drawer | cart_page | checkout`.
- `status`: `enabled | disabled | unavailable`.
- `strategy`: `app_embed | app_block | checkout_extension | function_projection`.
- `priority`: Number used when multiple placements can display guidance.
- `settings`: Compact presentation settings such as labels, disabled guidance types, and fallback behavior.
- `updatedAt`: Last merchant or deployment change timestamp.

**Validation rules**
- `shop`, `placementId`, and `surface` are required.
- `status` must be `unavailable` when Shopify plan or theme configuration cannot support the placement.
- Settings must not include secrets or unvalidated HTML.

### CartSurfaceState

Represents the current observable state of a shopper's cart drawer or cart page.

**Fields**
- `surface`: `cart_drawer | cart_page`.
- `isOpen`: Whether the drawer/page surface is currently visible to the shopper.
- `cartToken`: Optional token returned by the storefront cart payload.
- `currencyCode`: Three-letter cart currency code.
- `items`: Current cart lines with line key, product ID, variant ID, title, and quantity.
- `lastObservedAt`: Timestamp for the most recent surface or cart mutation observation.
- `syncSource`: `initial_config | cart_js | fetch_intercept | mutation_observer | fallback_poll`.
- `syncStatus`: `fresh | refreshing | stale | failed`.

**Validation rules**
- Empty carts are valid and should produce either empty or general guidance.
- Cart lines with missing product identifiers must be discarded from guidance payloads rather than causing render failure.
- A cart drawer must not be considered fresh after DOM replacement until `/cart.js` or an equivalent verified snapshot has been read.

### CartMindWidgetInstance

Represents one rendered CartMind host tied to one storefront cart surface.

**Fields**
- `instanceId`: Stable browser-local identifier.
- `placementId`: Related `StorefrontIntegrationPlacement`.
- `surface`: `cart_drawer | cart_page`.
- `mountStatus`: `not_mounted | mounting | mounted | hidden | failed`.
- `shadowRootAttached`: Boolean indicating style isolation status.
- `guidanceStatus`: `idle | loading | ready | degraded | unavailable`.
- `lastCartState`: Latest `CartSurfaceState` snapshot used by the widget.
- `failureReason`: Optional sanitized error category.

**Validation rules**
- Only one mounted widget instance is allowed per placement/surface pair.
- A failed widget instance must leave the original cart controls usable.
- Widget cleanup must not remove theme-owned body classes or third-party DOM nodes.

### StorefrontGuidancePayload

Represents the cart-aware guidance the widget can render.

**Fields**
- `payloadId`: Stable ID for the generated payload.
- `cartToken`: Optional cart token the payload was generated for.
- `generatedAt`: Timestamp of payload generation.
- `recommendations`: Ordered recommendation cards.
- `kitCompleteness`: Optional kit completeness summary.
- `sizeWarnings`: Ordered size warning summaries.
- `chatEntry`: Optional chat bootstrap labels and availability status.
- `fallbackNotice`: Optional degraded-state notice.

**Validation rules**
- Payloads must be tied to the cart snapshot they were generated from.
- Unknown guidance item types must be ignored or rendered as safe fallback notices.
- Guidance must not block checkout or core cart controls.

### CheckoutGuidanceItem

Represents a concise warning, offer, or nudge shown at checkout.

**Fields**
- `guidanceId`: Stable identifier.
- `type`: `size_warning | bundle_offer | kit_nudge`.
- `severity`: `info | warning | critical`.
- `priority`: Integer ordering value.
- `title`: Shopper-facing title.
- `message`: Short shopper-facing explanation.
- `relatedLineIds`: Cart or checkout line IDs referenced by the guidance.
- `action`: Optional action descriptor such as `review_cart`, `change_size`, or `add_item`.
- `expiresAt`: Optional timestamp after which stale guidance should be hidden.

**Validation rules**
- No-guidance carts must produce an empty item list.
- Critical size warnings sort ahead of commercial offers.
- Guidance referencing missing cart lines must be dropped.

### BundleStorefrontOutcome

Represents the shopper-visible result of bundle qualification.

**Fields**
- `outcomeId`: Stable identifier for the evaluated cart/rule combination.
- `shop`: Shopify shop domain.
- `cartToken`: Optional cart token.
- `ruleId`: Merchant bundle rule identifier.
- `status`: `qualified | partial | ineligible | expired | conflict`.
- `qualifiedLineIds`: Cart lines that satisfy the rule.
- `missingRequirements`: Optional remaining products/quantities for partial bundles.
- `discount`: Optional discount type, value, and display label.
- `presentation`: Optional shopper-facing bundle label, component summary, and savings summary.
- `priority`: Rule priority used to resolve overlaps.
- `projectionVersion`: Integer contract version for downstream consumers.

**Validation rules**
- Discounts are present only when `status` is `qualified`.
- Expired or inactive rules cannot produce qualified outcomes.
- Overlapping rules must resolve deterministically by merchant priority and configured stacking rules.
- Function-compatible projections must contain only fields available to the Shopify Function runtime.

### IntegrationHealthEvent

Represents a compact operational event used to verify integration quality.

**Fields**
- `eventId`: Stable identifier.
- `shop`: Shopify shop domain.
- `sessionId`: Optional shopper-session or browser-session key.
- `eventType`: `widget_rendered | widget_failed | cart_sync_started | cart_sync_completed | cart_sync_failed | guidance_impressed | checkout_guidance_rendered | bundle_outcome_evaluated | fallback_used`.
- `surface`: `cart_drawer | cart_page | checkout | function`.
- `cartToken`: Optional hashed or opaque cart token reference.
- `details`: Sanitized compact metadata.
- `createdAt`: Event timestamp.

**Validation rules**
- Details must not include raw secrets, access tokens, or unnecessary customer PII.
- Event payloads must stay bounded for high-traffic storefront use.
- Duplicate retries should be deduplicable by `eventId` or idempotency key.

## Relationships

- One `StorefrontIntegrationPlacement` can have many `CartMindWidgetInstance` lifetimes across shopper sessions.
- One `CartMindWidgetInstance` observes many `CartSurfaceState` snapshots.
- One `CartSurfaceState` can produce one current `StorefrontGuidancePayload`.
- One cart can produce many `CheckoutGuidanceItem` records, ordered by severity and priority.
- One cart can produce many `BundleStorefrontOutcome` records, but only eligible outcomes become discount or presentation actions.
- Each major state change may emit an `IntegrationHealthEvent`.

## State Transitions

### Widget lifecycle

1. `not_mounted` to `mounting` when a supported cart surface is discovered.
2. `mounting` to `mounted` when the Shadow DOM host and widget root render successfully.
3. `mounted` to `hidden` when the drawer closes or the placement is not currently visible.
4. `mounted` to `failed` when configuration, asset loading, or render validation fails.
5. `failed` remains a graceful no-op state until the next page load or explicit remount attempt.

### Cart synchronization lifecycle

1. `stale` to `refreshing` after a mutation, fetch intercept, or fallback poll trigger.
2. `refreshing` to `fresh` after a valid cart snapshot is read.
3. `refreshing` to `failed` when the cart snapshot cannot be read.
4. `failed` to `refreshing` on the next bounded retry.

### Checkout guidance lifecycle

1. `candidate` guidance is generated from cart analysis.
2. Invalid or line-missing candidates are dropped.
3. Remaining guidance is prioritized by severity and type.
4. Rendered guidance emits an impression event.
5. Expired or resolved guidance is hidden on subsequent checkout renders.

### Bundle outcome lifecycle

1. Active rules are projected for storefront/function consumers.
2. Cart evaluation produces `qualified`, `partial`, `ineligible`, `expired`, or `conflict` outcomes.
3. Qualified outcomes are resolved for overlap and stacking.
4. Winning outcomes become discount/presentation payloads.
5. Non-winning or invalid outcomes remain diagnostic/analytics-only.
