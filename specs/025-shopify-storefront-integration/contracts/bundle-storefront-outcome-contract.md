# Contract: Bundle Storefront Outcome

## Scope

Defines the compact bundle outcome projection used by storefront UI, checkout guidance, discount functions, and cart transform presentation paths. The projection is intentionally small and deterministic so Shopify Function runtimes can evaluate it without backend calls.

## Outcome projection

Entity: `BundleStorefrontOutcomeProjection`

- `shop`: string required.
- `cartToken`: string optional.
- `generatedAt`: datetime required.
- `projectionVersion`: integer required.
- `outcomes`: array of `BundleStorefrontOutcome`, default empty.
- `resolution`: object required:
  - `strategy`: `merchant_priority | best_savings | non_stackable_first`.
  - `selectedOutcomeIds`: array of strings.
  - `rejectedOutcomeIds`: array of strings.

## Bundle outcome

Entity: `BundleStorefrontOutcome`

- `outcomeId`: string required.
- `ruleId`: string required.
- `ruleVersion`: integer required.
- `status`: `qualified | partial | ineligible | expired | conflict` required.
- `priority`: integer required.
- `qualifiedLineIds`: array of strings, default empty.
- `missingRequirements`: array of requirement summaries, default empty:
  - `productId`: string optional.
  - `variantId`: string optional.
  - `quantityRequired`: integer minimum 1.
  - `quantityPresent`: integer minimum 0.
  - `label`: string optional.
- `discount`: object optional:
  - `type`: `percentage | fixed`.
  - `value`: number greater than 0.
  - `currencyCode`: string optional for fixed discounts.
  - `displayLabel`: string required.
- `presentation`: object optional:
  - `bundleTitle`: string required.
  - `componentSummary`: string required.
  - `savingsSummary`: string optional.
  - `lineMergeEligible`: boolean.
- `expiresAt`: datetime optional.

## Qualification rules

- `qualified` outcomes must include at least one qualified line and a valid discount.
- `partial` outcomes must not include a discount but may include missing requirements and a completion prompt.
- `ineligible`, `expired`, and `conflict` outcomes must not include a discount.
- Expired rules must always produce `expired` or be omitted.
- Overlapping rules must resolve through `resolution.selectedOutcomeIds` before discount application.

## Shopify Function constraints

Function-compatible projections must:

- Include only data available from function input queries, metafields, or precomputed compact projections.
- Avoid fields that require Node APIs, Prisma, fetch, clocks beyond runtime input, or external services.
- Use deterministic ordering for rules, requirements, and selected outcomes.
- Reject unsupported `projectionVersion` values.
- Default to no discount on malformed, missing, or unsupported projection data.

## Storefront and checkout obligations

- Storefront UI may render `partial` outcomes as completion prompts.
- Checkout guidance may render `qualified` or `partial` outcomes as concise offers or confirmations.
- Discount functions apply discounts only for selected `qualified` outcomes.
- Cart transform presentation may merge or label lines only when `presentation.lineMergeEligible` is true and selected by resolution.

## Error handling

- Malformed projection: reject all outcomes and apply no discount.
- Unknown rule version: ignore that outcome and continue with valid outcomes.
- Overlap conflict without resolution: apply no discount for conflicting outcomes.
- Missing required line IDs: downgrade outcome to ineligible or ignore in function path.

## Acceptance mapping

- Full bundle cart: selected qualified outcome with valid discount and presentation.
- Partial bundle cart: partial outcome with missing requirements and no discount.
- Overlapping bundle cart: deterministic selected outcome set.
- Expired rule cart: no qualified discount outcome.
