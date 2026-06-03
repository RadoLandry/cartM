# Contract: Storefront Widget Integration

## Scope

Defines the contract between Shopify theme surfaces, the CartMind storefront widget, and backend storefront guidance endpoints. This contract covers cart drawer/cart page mounting, cart state synchronization, guidance payloads, and graceful fallback behavior.

## Mount configuration

Entity: `StorefrontWidgetMountConfig`

- `shop`: string, required Shopify shop domain.
- `surface`: `cart_drawer | cart_page`, required.
- `placementId`: string, required stable placement identifier.
- `appBaseUrl`: string URL, required for backend endpoints.
- `bootstrapPath`: string, required app-proxy bootstrap path.
- `recommendationsPath`: string, required storefront guidance path.
- `cart`: object, required initial cart snapshot:
  - `cartId`: string optional.
  - `currencyCode`: string, 3-letter currency code.
  - `items`: array of cart lines.
- `labels`: object optional:
  - `launcherLabel`: string optional.
  - `panelTitle`: string optional.
  - `fallbackMessage`: string optional.
- `features`: object optional:
  - `showRecommendations`: boolean.
  - `showKitCompleteness`: boolean.
  - `showSizeWarnings`: boolean.
  - `showChatEntry`: boolean.

## Cart line

Entity: `StorefrontCartLine`

- `lineId`: string optional.
- `productId`: string required.
- `productTitle`: string optional.
- `variantId`: string optional.
- `variantTitle`: string optional.
- `quantity`: integer required, minimum 1.

## Guidance request

Endpoint role: Widget requests a refreshed guidance payload for the current cart snapshot.

Request: `StorefrontGuidanceRequest`

- `shop`: string required.
- `surface`: `cart_drawer | cart_page` required.
- `placementId`: string required.
- `sessionId`: string required opaque browser/session key.
- `cart`: current cart snapshot required.
- `syncSource`: `initial_config | cart_js | fetch_intercept | mutation_observer | fallback_poll` required.
- `requestedAt`: datetime required.

Response: `StorefrontGuidanceResponse`

- `ok`: boolean required.
- `payload`: `StorefrontGuidancePayload` when `ok` is true.
- `error`: sanitized error category when `ok` is false.
- `retryAfterMs`: integer optional.

## Guidance payload

Entity: `StorefrontGuidancePayload`

- `payloadId`: string required.
- `generatedAt`: datetime required.
- `cartId`: string optional.
- `recommendations`: array of recommendation cards, default empty.
- `kitCompleteness`: object optional:
  - `discipline`: string optional.
  - `score`: number from 0 to 1.
  - `missingCount`: integer minimum 0.
  - `summary`: string required.
- `sizeWarnings`: array of warning cards, default empty.
- `chatEntry`: object optional:
  - `available`: boolean.
  - `bootstrapPath`: string optional.
  - `reasonUnavailable`: string optional.
- `fallbackNotice`: object optional:
  - `title`: string.
  - `message`: string.

## Widget obligations

- Create no more than one active CartMind root per surface placement.
- Mount outside AJAX-replaced cart content when a drawer surface is detected.
- Read `/cart.js` or an equivalent validated cart snapshot after detected cart mutations.
- Intercept same-origin cart mutation requests only to trigger synchronization; do not alter their request or response semantics.
- Use bounded polling only while the drawer is open or the cart page is active.
- Keep all CartMind styles scoped to the widget host.
- Do not mutate third-party app containers or theme-owned body scroll classes.
- Do not inject visible UI into temporary cart notification popups.

## Backend obligations

- Validate every guidance request at the route boundary.
- Return only shopper-safe guidance fields required by the widget.
- Support empty carts and unknown products without throwing.
- Return degraded payloads or explicit retryable failures without blocking the original cart experience.
- Emit integration health events for render, sync, guidance impression, and fallback outcomes.

## Error handling

- `invalid_request`: Widget submitted malformed or unsupported payload.
- `guidance_unavailable`: Recommendation service could not return current guidance.
- `cart_snapshot_stale`: Cart snapshot is too old or missing required identifiers.
- `rate_limited`: Widget should retry after `retryAfterMs`.
- `unknown`: Widget should show no blocking UI and preserve original cart behavior.

## Compatibility requirements

- Existing cart drawer open/close controls remain the source of truth.
- Existing subtotal, checkout CTA, quantity controls, and third-party sections remain usable.
- Drawer and page breakpoints are not changed by CartMind.
- Widget failure is a graceful no-op for the merchant's original cart flow.
