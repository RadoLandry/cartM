# Contract: Checkout Guidance

## Scope

Defines the compact guidance model consumed by Shopify checkout surfaces. Guidance is precomputed or resolved from existing cart analysis and rendered only when there are relevant size warnings, bundle offers, or kit completion nudges.

## Guidance feed

Entity: `CheckoutGuidanceFeed`

- `shop`: string required.
- `checkoutId`: string optional.
- `cartToken`: string optional.
- `generatedAt`: datetime required.
- `placement`: `purchase_checkout_block | information_step | shipping_step | payment_step | unknown`.
- `items`: array of `CheckoutGuidanceItem`, default empty.
- `projectionVersion`: integer required.

## Guidance item

Entity: `CheckoutGuidanceItem`

- `guidanceId`: string required.
- `type`: `size_warning | bundle_offer | kit_nudge` required.
- `severity`: `info | warning | critical` required.
- `priority`: integer required, lower numbers render first.
- `title`: string required, shopper-facing.
- `message`: string required, shopper-facing.
- `relatedLineIds`: array of strings, default empty.
- `action`: object optional:
  - `type`: `review_cart | change_size | add_item | acknowledge`.
  - `label`: string required when action exists.
  - `target`: string optional.
- `expiresAt`: datetime optional.

## Ordering rules

1. `critical` items render before `warning`, which render before `info`.
2. Within the same severity, lower `priority` values render first.
3. `size_warning` renders before commercial guidance when severity and priority are equal.
4. Expired items are not rendered.
5. Items referencing no longer present checkout lines are not rendered.

## Empty state

When no guidance applies, the feed returns `items: []`. Checkout UI must render nothing for an empty feed.

## Placement adaptation

- Non-Plus or limited-checkout stores use the broad checkout block placement when available.
- Plus stores may use more specific checkout step placements if configured.
- The same feed model is used for all placements; placement controls where the item is rendered, not the meaning of the item.
- If no supported checkout placement exists, the guidance feed may still be generated for analytics but must not block checkout.

## Validation and privacy

- All text must be merchant/shopper safe and pre-sanitized before reaching checkout UI.
- No custom HTML, CSS, script, or non-checkout UI component payload is allowed in guidance items.
- Guidance payloads must not include raw customer PII, secrets, or full product catalog details.
- Payload size must remain bounded for checkout runtime limits.

## Error handling

- If feed loading fails, render no CartMind checkout UI and allow checkout to continue.
- If a single item fails validation, drop that item and render the remaining valid items.
- If projection version is unsupported, render no guidance and emit an integration health event.

## Acceptance mapping

- Size conflict cart: feed includes at least one `size_warning` item.
- Bundle opportunity cart: feed includes at least one `bundle_offer` item.
- No-guidance cart: feed has an empty `items` array.
- Mixed warning/offer cart: warning appears before offer unless merchant policy explicitly changes severity or priority.
