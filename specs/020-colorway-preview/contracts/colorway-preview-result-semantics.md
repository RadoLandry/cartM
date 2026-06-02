# Contract: Colorway Preview Result Semantics

## Purpose
Define result states and shopper-visible semantics for current-vs-proposed colorway comparison.

## Result States
- ok: both current and proposed views generated successfully.
- partial: comparison generated with one or more omissions.
- invalid: request rejected due to invalid cart/swap input.
- fallback: no composable output available; deterministic fallback payload returned.
- error: unrecoverable processing failure.

## Omission Reason Codes
- missing_image: source image unavailable for one or more lines.
- unsupported_type: line type not supported by active template.
- fetch_failed: source image could not be fetched or decoded.
- invalid_variant: proposed variant invalid for selected line.

## Invalid State Requirements
- status=invalid
- comparison asset fields null
- stable reason key for shopper-safe messaging
- diagnostics.requestId present for support traceability

## Fallback Requirements
- status=fallback
- comparison asset fields null
- shopper-safe explanatory message key
- diagnostics.requestId present

## Determinism Requirements
- Identical normalized inputs must produce equivalent change metadata and layout placement semantics.
- Identical failure conditions must map to stable reason codes.
- For mixed-discipline carts, identical item sets must resolve to the same fallback layout strategy.
