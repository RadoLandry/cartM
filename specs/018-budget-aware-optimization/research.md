# Research: Budget-Aware Optimization

## Decision 1: Represent budget optimization as a dedicated chat tool flow with structured proposal payloads

Decision: Implement budget-aware optimization through a first-class structured flow in storefront chat, returning a deterministic proposal object (candidate changes, projected totals, safety constraints) instead of free-form text-only recommendations.

Rationale: The feature requires explicit acceptance/rejection of individual changes, projected totals, and safe follow-up actions. Typed payloads are necessary for deterministic UI and confirmation handling.

Alternatives considered:
- Keep heuristic free-text response only: rejected because proposal application cannot be safely or consistently executed.
- Introduce a separate optimization endpoint disconnected from chat: rejected because it fragments session context and duplicates confirmation logic.

## Decision 2: Reuse existing action confirmation lifecycle for applying optimization changes

Decision: Reuse the existing confirmation-gated lifecycle used by cart tool actions and comparison follow-ups for each proposed optimization action.

Rationale: Existing `actionId` idempotency and terminal-state semantics already enforce safety and prevent duplicate cart mutations.

Alternatives considered:
- Immediate apply on click: rejected due to accidental mutation risk and weak auditability.
- Batch-apply without per-change context: rejected because shopper needs partial-accept behavior and transparent trade-offs.

## Decision 3: Preserve safety-critical kit items through explicit hard constraints in proposal ranking

Decision: Integrate safety-critical classification from existing recommendation/knowledge-graph signals into ranking so optional/cosmetic changes are always considered before safety-critical removals.

Rationale: The spec mandates that safety-critical items are preserved unless the shopper explicitly accepts degraded kit completeness.

Alternatives considered:
- Single global price-minimization objective: rejected because it can remove protective gear and violate domain safety expectations.
- Merchant-only hardcoded exclusion lists: rejected due to poor portability and maintenance overhead.

## Decision 4: Build optimization candidates from current cart + storefront availability snapshot

Decision: Build optimization proposals from current cart lines and in-stock alternatives resolved via existing Shopify storefront/cart helper paths, with revalidation at confirmation time.

Rationale: Price and availability can drift between proposal and apply; stale detection and fallback messaging are required for predictable shopper outcomes.

Alternatives considered:
- Use stale cached catalog only: rejected because projected totals would be unreliable.
- Query Admin API for shopper-facing proposal data: rejected because storefront chat should use shopper-safe storefront context.

## Decision 5: Add explicit impossible-budget outcomes

Decision: Return a structured “cannot reach budget safely” outcome when target cannot be met without violating safety/minimum-kit constraints.

Rationale: This directly satisfies FR-010 and prevents silent degradation to unsafe suggestions.

Alternatives considered:
- Force closest-under-budget regardless of constraints: rejected due to safety violations.
- Return empty proposal without reason: rejected because it is non-actionable and harms trust.

## Decision 6: Extend existing tests with deterministic proposal and replay scenarios

Decision: Add integration tests for chat stream + confirm flow and unit tests for ranking, safety guardrails, stale-state handling, and partial acceptance recomputation.

Rationale: Existing architecture already supports route-level and unit-level deterministic tests, aligning with Constitution Principle V.

Alternatives considered:
- Manual QA only: rejected by quality gates.
- E2E-only approach: rejected due to slower feedback and weaker coverage for ranking edge cases.
