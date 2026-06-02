# Contract: Colorway Preview Endpoint

## Purpose
Define the external contract for requesting a side-by-side current vs proposed colorway comparison.

## Endpoint
- Method: POST
- Path: /api/ai/kit-preview

## Request Body
- cartId: string (required)
- sessionId: string (required)
- shopDomain: string (required)
- selectedLineId: string (required)
- proposedVariantId: string (required)
- surface: enum (cart_drawer, cart_page, chat) (required)
- viewportHint: enum (mobile, desktop, unknown) (optional)
- forceRegenerate: boolean (optional, default false)

## Response Body
- status: enum (ok, partial, invalid, fallback, error)
- comparison:
  - currentAssetUrl: string | null
  - proposedAssetUrl: string | null
  - comparisonAssetUrl: string | null
  - mimeType: string | null
  - width: number | null
  - height: number | null
  - reused: boolean
- change:
  - selectedLineId: string
  - fromVariantId: string
  - toVariantId: string
  - changedLabel: string
- context:
  - inferredDiscipline: string | null
  - layoutId: string
  - templateVersion: string
- omissions: array of
  - lineId: string
  - scope: enum (current, proposed, both)
  - reasonCode: enum (missing_image, unsupported_type, fetch_failed, invalid_variant)
  - reasonDetail: string | null
- diagnostics:
  - requestId: string
  - generationMs: number | null

## Error Semantics
- 400: invalid request payload
- 401/403: unauthorized or invalid session context
- 404: cart or selected line not found
- 422: invalid swap target (unavailable variant or no-op swap)
- 500: internal processing failure

## Behavioral Guarantees
- Endpoint must not mutate cart state.
- Identical normalized comparison requests may reuse an existing asset.
- Partial results are preferred over hard failure when at least one renderable item remains.
- Invalid requests return actionable reason messaging without composition side effects.
