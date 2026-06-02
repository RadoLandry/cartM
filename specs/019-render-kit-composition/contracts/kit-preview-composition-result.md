# Contract: Composition Result Semantics

## Purpose
Define output semantics for success, partial success, and fallback responses.

## Result States
- ok: full composition succeeded for all eligible items.
- partial: composition succeeded with one or more omitted items.
- fallback: no composed asset available; client receives deterministic fallback payload.
- error: unrecoverable processing error.

## Omission Reason Codes
- missing_image: item has no source image URL.
- unsupported_type: item category cannot be composed in current template.
- fetch_failed: source image could not be fetched or decoded.
- invalid_variant: variant reference invalid or incomplete.

## Fallback Payload Requirements
- status=fallback
- preview.assetUrl=null
- shopper-safe message key for UI presentation
- diagnostics.requestId present for traceability

## Determinism Requirements
- identical normalized inputs must yield equivalent layout placement semantics.
- omission reason codes must be stable for identical input failures.
- mixed-discipline carts must always map to the same fallback layout for identical item sets.
