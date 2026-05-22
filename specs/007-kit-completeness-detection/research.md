# Research: Kit Completeness Detection

## Kit-definition persistence

### Decision
Persist kit-completeness configuration in two new Prisma models: `KitDefinition` for the discipline-level kit and `KitRequirement` for the required or optional slots within that kit.

### Rationale
The current schema already separates raw catalog facts from higher-level knowledge-graph state, such as `ProductRelationship` and `ProductVisualProfile` in [prisma/schema.prisma](C:/Users/Landry/Documents/CARTMIND/cart-mind/prisma/schema.prisma#L32). Kit completeness needs merchant-owned structure that survives syncs, supports priorities, and can express substitutes. That is a poor fit for `BundleRule`, which is discount-oriented, and for freeform JSON on `Product`, which would scatter the behavior across individual products instead of modeling the kit as a first-class concept.

### Alternatives considered
- Reuse `BundleRule`: rejected because bundle rules model discount thresholds, not required-vs-optional coverage, safety priorities, or discipline inference.
- Encode kits only as `ProductRelationship.COMPLEMENTS` edges: rejected because relationship edges alone do not represent completeness scoring, required slots, or merchant-defined substitutes cleanly.

## Inference strategy

### Decision
Use a deterministic discipline-first scorer in a new `app/lib/cart-intelligence/kit-detection.ts` module. The scorer groups cart items by discipline evidence, resolves candidate kits for those disciplines, scores requirement fulfillment, and returns one assessment per inferred kit.

### Rationale
The spec requires predictable, explainable output and the constitution forbids unnecessary latency in shopper-facing flows. Existing cart-intelligence code such as [app/lib/cart-intelligence/style-coherence.ts](C:/Users/Landry/Documents/CARTMIND/cart-mind/app/lib/cart-intelligence/style-coherence.ts#L1) already demonstrates deterministic scoring with structured reasons. Kit completeness should follow that model instead of introducing request-time AI inference.

### Alternatives considered
- LLM-assisted kit detection on every cart change: rejected because it adds cost, latency, and non-determinism to a hot path.
- Single winning-kit classification only: rejected because the PRD explicitly requires multi-discipline carts to be handled independently.

## Requirement fulfillment and substitute logic

### Decision
Treat a kit requirement as fulfilled in this order: direct product match, category-tag match, then explicit substitute or equivalent coverage derived from active `ProductRelationship.ALTERNATIVES` edges or merchant-pinned acceptable products.

### Rationale
The spec requires substitutes to satisfy a kit need without producing false missing-item prompts. Category-tag matching handles most generalized kit slots, while explicit product or relationship coverage handles merchant exceptions and higher-precision substitutions.

### Alternatives considered
- Category match only: rejected because it is too coarse for slots where only specific products or curated substitutes should count.
- Product match only: rejected because it makes default kit templates brittle and creates excessive merchant maintenance overhead.

## Merchant configuration surface

### Decision
Extend the existing Polaris knowledge-graph page with a `Kits` tab for reviewing active kit definitions, editing requirement priorities, toggling required vs. optional slots, and assigning accepted substitute products.

### Rationale
The route in [app/routes/app.knowledge-graph.tsx](C:/Users/Landry/Documents/CARTMIND/cart-mind/app/routes/app.knowledge-graph.tsx#L1) already serves as the merchant review surface for knowledge-graph-derived data. Keeping kit definitions there centralizes admin workflows and avoids fragmenting the embedded navigation.

### Alternatives considered
- New standalone admin route: rejected for now because the workflows remain cohesive within the knowledge-graph area.
- Hard-code default kits with no merchant UI: rejected because FR-011 requires merchant control over kit compositions and priorities.

## Recommendation reasoning contract

### Decision
Return each assessment with structured reasons at both the kit and requirement levels, using reason types such as `discipline_match`, `relationship_support`, `merchant_override`, `required_missing`, and `optional_missing`.

### Rationale
The cart UI needs to explain why a kit was inferred and why a missing item was prioritized. Structured reasoning also supports deterministic testing and analytics without depending on hidden logs.

### Alternatives considered
- Freeform explanation strings only: rejected because they are harder to validate and sort analytically.
- No reasoning payload: rejected because the feature would become opaque to both merchants and shoppers.

## Default kit template strategy

### Decision
Seed default kit definitions per discipline from existing taxonomy and relationship graph evidence through an internal backfill script, then treat merchant edits as the lasting source of truth.

### Rationale
The knowledge graph already contains product discipline tags and relationship edges. Seeding starter templates reduces merchant setup time while still allowing manual refinement where store-specific catalog structure differs.

### Alternatives considered
- Require merchants to author every kit from scratch: rejected because it slows adoption and increases onboarding effort.
- Auto-regenerate kit definitions on every sync: rejected because it risks overwriting merchant intent and makes review unstable.