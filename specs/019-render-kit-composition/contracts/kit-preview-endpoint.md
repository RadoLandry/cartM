# Contract: Kit Preview Endpoint

## Purpose
Define the external contract for requesting a composed kit preview from current cart state.

## Endpoint
- Method: POST
- Path: /api/ai/kit-preview

## Request Body
- cartId: string (required)
- sessionId: string (required)
- shopDomain: string (required)
- surface: enum (cart_drawer, cart_page, chat) (required)
- viewportHint: enum (mobile, desktop, unknown) (optional)
- forceRegenerate: boolean (optional, default false)

## Response Body
- status: enum (ok, partial, fallback, error)
- preview:
  - assetUrl: string | null
  - mimeType: string | null
  - width: number | null
  - height: number | null
  - reused: boolean
- context:
  - inferredDiscipline: string | null
  - layoutId: string
  - templateVersion: string
- omissions: array of
  - lineId: string
  - reasonCode: enum (missing_image, unsupported_type, fetch_failed, invalid_variant)
  - reasonDetail: string | null
- diagnostics:
  - requestId: string
  - generationMs: number | null

## Error Semantics
- 400: invalid request payload
- 401/403: unauthorized or invalid session context
- 404: cart not found or inaccessible
- 422: composition not possible with provided context
- 500: internal processing failure

## Behavioral Guarantees
- For unchanged cart signature and template version, response may reuse existing preview.
- If at least one eligible item can be rendered, service should prefer partial success over hard failure.
- Response must include omission details when items are excluded.
