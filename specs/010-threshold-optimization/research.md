# Research: Threshold Optimization

## Decision 1: Persist merchant-managed threshold rules inside CartMind

- **Decision**: Store threshold rules as first-class Prisma-backed records in CartMind instead of trying to infer them from native Shopify shipping or discount configuration at request time.
- **Rationale**: The bundle manager already establishes the repository pattern for merchant-authored merchandising rules. Reusing that shape keeps CRUD, previews, and deterministic evaluation local to the app and avoids coupling recommendation behavior to Shopify configuration reads that are not guaranteed to express relevance policy.
- **Alternatives considered**:
  - Read Shopify native shipping or discount thresholds directly: rejected because the recommendation path would become dependent on external config formats and would still need separate relevance and suppression policy inside the app.
  - Hard-code a single free-shipping threshold: rejected because the spec requires merchant control and multiple threshold types.

## Decision 2: Evaluate only the nearest relevant unmet threshold

- **Decision**: During cart analysis, choose the nearest active threshold the cart has not yet achieved and suppress lower-priority threshold opportunities for the same evaluation.
- **Rationale**: The spec requires avoiding contradictory recommendation messages when more than one threshold is technically near. A single selected opportunity keeps the shopper message focused and matches the repository's current pattern of surfacing a primary bundle or primary recommendation context.
- **Alternatives considered**:
  - Return every threshold the cart is close to: rejected because it creates noisy, competing prompts.
  - Always choose the numerically closest threshold: rejected because merchant priority and rule status must still influence selection.

## Decision 3: Rank candidates by contextual relevance before price fit

- **Decision**: Score suggestion candidates using cart-context relevance first, then gap fitness, availability, and duplicate-safety.
- **Rationale**: The feature's primary trust constraint is to avoid filler items. Existing catalog signals such as discipline tags, category tags, complements, and current cart composition are already available and should dominate ranking before simple price proximity.
- **Alternatives considered**:
  - Rank by price closeness only: rejected because it would surface random cheap add-ons.
  - Rank only by relationship graph strength: rejected because the rule still needs to consider the threshold gap and practical ability to close it.

## Decision 4: Enforce a hard suppression path when relevance is weak

- **Decision**: Return no threshold recommendation when the cart is already qualified, outside the actionable window, lacks in-stock candidates, or only has low-relevance candidates.
- **Rationale**: The spec explicitly prioritizes restraint over generic upsell behavior. A deterministic suppression path is necessary to protect shopper trust and aligns with the requirement that the system stay quiet for low-relevance carts.
- **Alternatives considered**:
  - Always return at least one candidate if a threshold is numerically close: rejected because it violates the spec's anti-filler behavior.
  - Lower the relevance bar when inventory is limited: rejected because poor suggestions are worse than no suggestion.

## Decision 5: Replace the placeholder admin route with a dedicated threshold manager

- **Decision**: Introduce `app/routes/app.thresholds.tsx` and update app navigation to surface it where the current placeholder additional page lives.
- **Rationale**: The repo already has a real bundle manager page and a placeholder additional page. Replacing the placeholder keeps navigation flat, preserves the existing embedded admin shell, and avoids overloading unrelated routes.
- **Alternatives considered**:
  - Add threshold controls to the bundle manager page: rejected because thresholds are a separate merchandising surface with different rule semantics.
  - Hide threshold management inside the knowledge graph page: rejected because that route already serves a different admin responsibility.

## Decision 6: Use summary-plus-suggestions shopper payloads

- **Decision**: Shape threshold results into a shopper payload with a summary block and up to three ranked suggestions, mirroring the current bundle and size recommendation style.
- **Rationale**: `app/lib/cart-intelligence/recommendations.ts` already centralizes shopper-facing payload shaping. Keeping Threshold Optimization in the same style reduces downstream integration work for cart surfaces and future checkout consumers.
- **Alternatives considered**:
  - Return raw evaluation internals directly to the UI: rejected because current cart surfaces expect normalized recommendation payloads.
  - Make threshold payloads a standalone API shape disconnected from existing recommendation builders: rejected because it increases orchestration complexity.