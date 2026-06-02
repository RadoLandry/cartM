# Research: Colorway Preview

## Decision 1: Build colorway preview as side-by-side comparison output
- Decision: Return both current and proposed kit visuals in one comparison response.
- Rationale: The feature's primary value is confidence before commitment; direct side-by-side output maximizes decision clarity.
- Alternatives considered:
  - Return only proposed preview: rejected because shoppers lose baseline context.
  - Return only a changed-item crop: rejected because full-kit coherence is the core decision factor.

## Decision 2: Extend normalized signature with swap target
- Decision: Compute deterministic signature from normalized cart snapshot + selected line + proposed variant + template version.
- Rationale: Accurate reuse requires swap-specific identity, not cart identity alone.
- Alternatives considered:
  - Reuse cart-only signature: rejected because different swap proposals would collide.

## Decision 3: Validate swap eligibility before composition
- Decision: Reject requests where selected line is absent, proposed variant is invalid, or target equals current variant.
- Rationale: Early validation prevents wasted composition work and produces actionable shopper feedback.
- Alternatives considered:
  - Let composition discover invalid requests late: rejected due to inconsistent error behavior and extra latency.

## Decision 4: Reuse composed assets for repeated identical comparisons
- Decision: Lookup existing comparison asset first and return reuse metadata on hit.
- Rationale: Repeat experimentation is expected behavior and should feel instant.
- Alternatives considered:
  - Always regenerate both views: rejected because it is expensive and unnecessary for identical requests.

## Decision 5: Prefer partial success with omission reporting
- Decision: If at least one renderable item remains, return comparison with structured omissions and partial state.
- Rationale: Catalogs often contain media gaps; degraded utility is better than hard failure.
- Alternatives considered:
  - Fail request when any item is invalid: rejected because it harms conversion and resilience.

## Decision 6: Preserve non-mutating preview behavior
- Decision: Keep preview flow read-only and never apply cart changes during comparison generation.
- Rationale: Prevents accidental cart mutation and aligns with user expectation of preview-before-commit.
- Alternatives considered:
  - Auto-apply swap on preview generation: rejected because it violates requirement boundaries and user intent.

## Decision 7: Keep contracts implementation-agnostic and test-centered
- Decision: Define endpoint, reuse behavior, and result semantics as explicit contracts independent of implementation internals.
- Rationale: This keeps cross-team expectations stable and directly supports acceptance testing.
- Alternatives considered:
  - Implicit behavior documented only in code: rejected due to weaker traceability and planning quality.
