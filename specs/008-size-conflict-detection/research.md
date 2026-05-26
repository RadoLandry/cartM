# Research: Size Conflict Detection

## Conflict persistence and source of truth

### Decision
Reuse the existing `CrossSizeMapping` and `SizeChart` persistence models as the source of truth for compatibility logic instead of adding a conflict-specific table. `CrossSizeMapping` continues to define expected size pairings and severity, while `SizeChart` remains the normalization source for categories that support measurement- or weight-based sizing.

### Rationale
The repository already ships a working deterministic detector backed by `CrossSizeMapping`, a Polaris admin surface for managing mappings, and unit tests that validate the current lookup behavior. Adding a new persistence layer would duplicate merchant-maintained sizing knowledge and create a second place for compatibility logic to drift.

### Alternatives considered
- Add a `SizeConflictRule` table dedicated to shopper-facing warnings: rejected because it duplicates `CrossSizeMapping` semantics without solving a new persistence problem.
- Persist precomputed conflict rows per cart: rejected because conflicts are request-time cart state, not durable catalog state.

## Correction suggestion strategy

### Decision
Promote `suggestedCorrection` from a single message string to a structured list of correction candidates derived from mapping expectations and variant availability. Each candidate names the affected cart item, target size, optional target variant, availability status, and confidence.

### Rationale
The spec requires actionable guidance and explicitly forbids suggesting unavailable sizes as the preferred correction. A structured candidate list allows downstream cart and checkout surfaces to render safe calls to action, while the detector remains responsible only for canonical sizing logic.

### Alternatives considered
- Keep a single freeform correction string: rejected because the UI cannot reliably distinguish between actionable and informational text.
- Compute suggestions entirely in the frontend: rejected because it would duplicate variant-availability and mapping logic across surfaces.

## Multi-conflict and low-noise behavior

### Decision
Keep the engine pairwise and deterministic, but emit independent conflicts with stable identifiers and skip any comparison that lacks enough evidence: missing size values, missing compatibility mapping, or categories with no supported normalization rule. Child/adult mismatches remain an immediate `ERROR`.

### Rationale
The current pairwise implementation already fits the cart shape and is easy to unit test. The main spec gap is not algorithmic breadth but output quality: the engine must stay quiet when evidence is incomplete and clear when multiple unrelated conflicts exist.

### Alternatives considered
- Build a graph-wide conflict scorer over the entire cart: rejected because it adds complexity without improving the core shopper outcome for v1.
- Infer conflicts from broad size distance heuristics when no mapping exists: rejected because it would increase false positives and violate the low-noise requirement.

## Weight-based and measurement-based sizing support

### Decision
Conflict detection remains category-rule driven, but when a category already uses `SizeChart` normalization, the engine may use normalized or expected size values from those existing charts to explain or rank conflicts. No new numeric sizing model is introduced in this slice.

### Rationale
The repository already contains `SizeChart` lookup logic and shared sizing interfaces. Reusing that surface keeps the implementation aligned with the existing size-intelligence feature and avoids inventing a second interpretation model for glove ounces, waist sizes, or measurement-based apparel.

### Alternatives considered
- Introduce a new universal numeric size scale across all categories: rejected because the existing schema and product data are not uniformly normalized enough for that to be reliable.
- Use AI to interpret ambiguous size mismatches: rejected because request-time detection must remain deterministic and fast.

## Merchant control surface

### Decision
Keep compatibility management in the existing `app.knowledge-graph.tsx` Polaris route and extend the size tooling only where necessary for richer conflict workflows, such as testing a category pair or validating a mapping against real variants.

### Rationale
The size charts and cross-size mappings are already curated in the knowledge-graph route. Reusing that route preserves the merchant mental model and avoids a redundant admin surface for a capability that belongs to the broader sizing domain.

### Alternatives considered
- Create a new top-level `app.size-conflicts.tsx` route: rejected because it fragments merchant sizing controls across multiple pages too early.
- Hide all compatibility logic behind scripts or database seeds: rejected because the spec requires merchant control and override persistence.

## Downstream contract strategy

### Decision
Add a dedicated size-conflict recommendation payload builder in `app/lib/cart-intelligence/recommendations.ts` that converts raw detection results into stable shopper-facing cards for cart and checkout consumers.

### Rationale
The repo already uses `recommendations.ts` to translate raw intelligence output into UI-ready payloads for kit and visual recommendations. Adding size conflicts there keeps downstream rendering contracts consistent and prevents the detector from becoming UI-specific.

### Alternatives considered
- Have every consumer transform raw `SizeConflictResult` independently: rejected because it would duplicate formatting, prioritization, and severity summarization logic.
- Add a new API route before defining a shared payload contract: rejected because the contract needs to be stable before transport details matter.
