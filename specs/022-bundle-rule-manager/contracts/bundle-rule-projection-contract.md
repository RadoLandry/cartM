# Contract: Bundle Rule Projection

## Scope
Defines compact rule projection emitted by backend for downstream consumers (cart display, checkout extensions, function-oriented paths).

## Projection entity

Entity: ActiveBundleRuleProjection
- shopId: string
- generatedAt: datetime
- rules: array of
  - id: string
  - priority: number
  - status: ACTIVE
  - minimumQualifiedItems: number
  - discountType: PERCENTAGE | FIXED
  - discountValue: number
  - requirements: array of
    - productId: string
    - variantId?: string
    - quantityRequired: number
    - requirementType: REQUIRED | OPTIONAL

## Projection guarantees

- Includes only ACTIVE rules.
- Excludes admin-only fields (description, actor IDs, verbose audit history).
- Uses stable field names and deterministic ordering.
- Is sufficient for read-only qualification display and downstream discount/cart-transform preparation.

## Versioning

- projectionVersion: integer (required)
- Any breaking field change increments projectionVersion.
- Consumers must reject unknown major projection versions.

## Error handling

If projection generation fails:
- Return explicit failure status.
- Preserve last known valid projection for read paths.
- Emit operational diagnostic event for merchant troubleshooting.
