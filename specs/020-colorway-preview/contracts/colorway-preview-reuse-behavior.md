# Contract: Colorway Preview Reuse Behavior

## Purpose
Define deterministic reuse semantics for side-by-side colorway comparison outputs.

## Reuse Key Inputs
- normalized cart snapshot signature
- selected line identifier
- proposed variant identifier
- selected layout profile identifier
- layout template version
- output format (png/webp)

## Reuse Rules
- If all key inputs are unchanged and asset exists, service returns reused comparison output.
- Any cart line mutation (add/remove/quantity/variant change) invalidates prior lookup.
- Changing selectedLineId or proposedVariantId invalidates prior lookup.
- Template version changes invalidate previous reuse records.
- forceRegenerate=true bypasses reuse path and generates fresh output.

## Returned Metadata
- reused: boolean
- layoutId: string
- templateVersion: string
- generationMs: number | null (null acceptable on pure reuse)

## Invalidation Triggers
- cart snapshot signature delta
- selected line or proposed variant delta
- layout profile change
- template version bump
- explicit regenerate request
- missing backing asset for lookup record

## Service-Level Expectations
- Reused comparison responses should be materially faster than first-generation responses.
- Cache misses must still produce deterministic comparison semantics for identical normalized requests.
