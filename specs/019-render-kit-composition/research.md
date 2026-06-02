# Research: Kit Composition Renderer

## Decision 1: Compose previews server-side with Sharp on Node runtime
- Decision: Implement composition in a server route running on Node runtime and keep image processing out of Edge runtime.
- Rationale: Sharp relies on native binaries and cannot run in edge isolates; server-side composition centralizes deterministic output and avoids exposing composition logic to storefront clients.
- Alternatives considered:
  - Client-side canvas composition in the widget: rejected due to inconsistent browser rendering, slower mobile devices, and CORS/image-taint complexity.
  - Edge runtime image pipeline: rejected because Sharp is incompatible with Edge runtime.

## Decision 2: Normalize cart input before composition
- Decision: Introduce a canonical cart snapshot payload containing variant image URL, quantity, inferred discipline, and stable ordering keys.
- Rationale: Deterministic inputs are required to produce stable hash keys and equivalent output for unchanged carts.
- Alternatives considered:
  - Compose directly from raw Storefront cart payload: rejected because field variability and ordering differences reduce cache hit rate and increase edge-case handling.

## Decision 3: Select layout by discipline with deterministic fallback
- Decision: Use discipline-specific layout templates first; fallback to a mixed-discipline neutral layout when discipline is ambiguous or mixed.
- Rationale: This preserves domain relevance while guaranteeing output for every valid cart snapshot.
- Alternatives considered:
  - Single universal layout for all carts: rejected because it weakens visual context and fails the feature requirement for discipline-appropriate composition.

## Decision 4: Cache by cart-composition hash and template version
- Decision: Generate a cache key from normalized cart signature + layout profile + template version and reuse existing composed assets on cache hits.
- Rationale: Repeat requests for unchanged carts should be near-instant and cost-efficient.
- Alternatives considered:
  - Time-based cache only: rejected due to stale collisions and lower deterministic reuse.
  - No cache: rejected due to repeated CPU-heavy composition and slower UX.

## Decision 5: Partial composition with omission reporting
- Decision: Skip invalid/unsupported items during composition and return structured omission metadata to the caller.
- Rationale: A degraded-but-usable preview is better than hard failure for common catalog hygiene problems (missing images, unsupported types).
- Alternatives considered:
  - Fail entire request on first invalid item: rejected because it increases shopper-visible failures and blocks value delivery.

## Decision 6: Revalidate source image availability on generation path
- Decision: Validate image fetchability during composition and record per-item failure reasons in output metadata.
- Rationale: Source assets can become unavailable or blocked; this supports robust fallback messaging and operational debugging.
- Alternatives considered:
  - Assume all URLs are valid: rejected due to high failure risk with external CDN assets.

## Decision 7: Keep contracts API-first and technology-agnostic
- Decision: Define contract documents around request/response shape, cache behavior, and composition result semantics without leaking implementation internals.
- Rationale: The feature spec requires business-facing clarity and testability, while implementation details can evolve.
- Alternatives considered:
  - Put all contract details in code comments only: rejected because it weakens cross-team alignment and test planning.
