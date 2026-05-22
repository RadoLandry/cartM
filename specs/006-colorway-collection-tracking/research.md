# Research: Colorway & Collection Tracking

## Visual profile persistence

### Decision
Persist visual merchandising state in a new `ProductVisualProfile` model keyed one-to-one to the existing `Product` row. Keep `Product.dominantColors` and `Product.collectionIds` as raw sync outputs from Shopify, while the new profile stores normalized colorway labels, collection summaries, confidence, override values, and extraction reasoning.

### Rationale
The current ingestion flow in [app/lib/knowledge-graph/ingestion.ts](c:\Users\Landry\Documents\CARTMIND\cart-mind\app\lib\knowledge-graph\ingestion.ts#L1) already upserts `Product` rows during catalog sync. Storing merchant-curated visual state directly on `Product` would couple override preservation to the sync path and make accidental overwrite more likely. A derived `ProductVisualProfile` isolates auto-generated signals from merchant corrections and keeps re-sync logic simple.

### Alternatives considered
- Extend `Product` with more array fields: rejected because sync writes would need custom merge logic for every visual attribute and override.
- Use only transient in-memory visual derivation: rejected because merchants need persistent review, correction, and auditability.

## Collection tracking source

### Decision
Extend the existing Shopify product fragment to include collection `title` and `handle` in addition to `id`, then copy that richer collection summary into the derived visual profile.

### Rationale
The current Shopify fragment in [app/lib/shopify/graphql.ts](c:\Users\Landry\Documents\CARTMIND\cart-mind\app\lib\shopify\graphql.ts#L1) already fetches collections but only stores IDs. Merchant review and cart messaging need human-readable collection names. Adding two collection fields to the existing fragment is cheaper and safer than introducing a second Admin API query path.

### Alternatives considered
- Fetch collection details lazily in the admin route: rejected because it creates a second GraphQL path and duplicates rate-limit exposure.
- Use only raw collection IDs in the UI: rejected because IDs are not usable for merchant review or shopper-facing reasoning.

## Colorway detection strategy

### Decision
Derive normalized colorway keys from three signals merged in order: image palette extraction, textual token parsing from product and variant names, and merchant-facing metadata from tags or metafields. The effective product colorway set is the merchant override when present, otherwise the detected set.

### Rationale
The current `extractDominantColors()` function in [app/lib/knowledge-graph/colorways.ts](c:\Users\Landry\Documents\CARTMIND\cart-mind\app\lib\knowledge-graph\colorways.ts#L1) only returns a mocked palette. Images alone are insufficient to distinguish named merchandising colorways like `black-gold` versus `matte-black`; textual tokens alone are insufficient when names are inconsistent. Combining both gives deterministic, explainable output without requiring LLM inference in the critical path.

### Alternatives considered
- Image-only color clustering: rejected because it misses branded colorway names and can collapse visually similar but commercially distinct variants.
- LLM-based colorway naming: rejected for the core path because it adds latency, cost, and non-determinism to ingestion.

## Compatibility scoring model

### Decision
Use a deterministic weighted scorer for cart visual coherence: collection overlap is the strongest signal, explicit merchant `ColorCompatibilityRule` entries come next, then palette similarity and taxonomy alignment as tie-breakers. The scorer emits a normalized coherence score plus structured reasons and candidate add/swap actions.

### Rationale
This feature must power subtle cart suggestions rather than hard restrictions. A weighted scorer can be unit-tested with fixed fixtures and keeps recommendations explainable. It also fits the existing relationship-driven architecture, where evidence is aggregated rather than inferred opaquely.

### Alternatives considered
- Reuse only `ProductRelationship.SAME_COLLECTION`: rejected because it cannot explain compatible colors outside a shared collection.
- Pure pairwise rule table for every product combination: rejected because it is too high-maintenance for merchants at catalog scale.

## Merchant override surface

### Decision
Extend the existing Polaris knowledge-graph page with a `Colorways` tab that has two responsibilities: review low-confidence product visual profiles and manage shop-level color compatibility rules.

### Rationale
The current route in [app/routes/app.knowledge-graph.tsx](c:\Users\Landry\Documents\CARTMIND\cart-mind\app\routes\app.knowledge-graph.tsx#L1) already hosts merchant review workflows for taxonomy and sizing. Adding colorway review there keeps the knowledge-graph workflow centralized and consistent with Shopify admin expectations.

### Alternatives considered
- New standalone admin route: deferred because the knowledge-graph workflow is still cohesive and benefits from a single review surface.
- Editing visual rules per product detail page: rejected because compatibility rules are cross-product and cross-colorway, not local to a single product page.

## Recommendation reasoning trace

### Decision
Return visual recommendations as structured objects carrying `reasonType`, `confidence`, and `source` metadata, where `reasonType` is one of `same_collection`, `compatible_colorway`, `merchant_override`, or `fallback_palette_match`.

### Rationale
FR-011 requires merchant-visible reasoning. Encoding reasons directly in the contract avoids hidden coupling to logs and lets the same payload be reused by the cart UI and the admin review surface.

### Alternatives considered
- Log-only reasoning: rejected because it is not available to shoppers or merchants in the product UI.
- Freeform explanation strings only: rejected because they are harder to test and cannot be filtered analytically.