# Contract: Kit Preview Cache Behavior

## Purpose
Define deterministic reuse semantics for composed kit previews.

## Cache Key Inputs
- normalized cart snapshot signature
- selected layout profile identifier
- layout template version
- output format (png/webp)

## Reuse Rules
- If all key inputs are unchanged and a valid asset exists, service returns reused asset.
- Any cart line mutation (add/remove/quantity/variant change) invalidates previous signature.
- Template version changes invalidate reuse for prior versions.
- forceRegenerate=true bypasses reuse and creates a new asset.

## Returned Metadata
- reused: boolean (true when cached asset reused)
- layoutId: string
- templateVersion: string
- generationMs: number | null (null acceptable for pure reuse path)

## Invalidation Triggers
- cart signature delta
- layout profile change
- template version bump
- explicit regenerate request
- asset storage miss for a lookup record

## Service-Level Expectations
- unchanged-cart reuse requests should complete faster than first-generation requests.
- cache misses must still return deterministic output for identical normalized inputs.
