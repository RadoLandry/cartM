# Research: Style & Colorway Matching

## Existing visual data as source of truth

### Decision
Reuse the existing `ProductVisualProfile` and `ColorCompatibilityRule` persistence introduced by the colorway tracking slice, and avoid adding new Prisma models for v1 shopper-facing style matching.

### Rationale
The current admin workflow in `app/routes/app.knowledge-graph.tsx` already lets merchants review effective colorways, collection membership, and explicit compatibility rules. The style-matching slice needs to consume that curated data in cart analysis rather than introduce a second persistence model for shopper-facing recommendations.

### Alternatives considered
- Add a dedicated `StyleRecommendationRule` model: rejected because the current visual-profile and compatibility-rule tables already carry the required merchandising intent.
- Infer everything directly from raw product fields: rejected because it would bypass merchant overrides and reintroduce drift between admin review and shopper output.

## Shopper integration surface

### Decision
Treat `app/lib/cart-intelligence/style-coherence.ts` as the owning analysis layer and `app/lib/cart-intelligence/recommendations.ts` as the owning shopper-payload layer, then expose those results through a dedicated recommendation route if no existing shopper endpoint currently consumes them.

### Rationale
The scorer already computes coherence status, reasons, and add-or-swap suggestions. The missing vertical slice is reliable cart hydration, payload shaping, and route-level exposure for storefront consumers. Extending the existing analysis and recommendation helpers is smaller and more testable than inventing a second style-matching subsystem.

### Alternatives considered
- Build a new standalone style engine: rejected because it would duplicate logic that already exists in `style-coherence.ts`.
- Push shopper-facing formatting into the route only: rejected because payload shaping belongs in a reusable library surface alongside the other recommendation builders.

## Candidate sourcing strategy

### Decision
Source cart items and style candidates from Prisma-backed product, variant, and visual-profile data already stored in CartMind, rather than making runtime Shopify Admin API calls during cart analysis.

### Rationale
The cart experience needs deterministic low-latency analysis. The local database already stores effective visual profile data, collection summaries, price and availability context, and merchant overrides. Hydrating style candidates from local persistence keeps the analysis field-minimal and avoids Admin API latency or cost in the shopper path.

### Alternatives considered
- Fetch product details live from Shopify Admin during style evaluation: rejected because it adds latency and violates the principle of keeping shopper paths deterministic and field-minimal.
- Evaluate only the items already in the cart with no candidate pool: rejected because the feature requires collection-completion additions and swap recommendations.

## Theme selection and suppression policy

### Decision
Use deterministic dominant-theme selection with explicit suppression rules: do not emit shopper-facing style guidance when the cart is already cohesive, when competing themes are tied without a clear winner, or when the best candidate does not beat a minimum confidence threshold.

### Rationale
The spec requires subtle and trustworthy recommendations. The current scorer already distinguishes `cohesive`, `mixed`, and `clashing`; the remaining work is to make ambiguity and low-confidence states suppressive by default instead of forcing a recommendation just because a candidate exists.

### Alternatives considered
- Always recommend a best-effort candidate: rejected because it would produce manipulative or low-signal suggestions in ambiguous carts.
- Let the storefront decide suppression entirely: rejected because the analysis layer should be authoritative about whether a recommendation is credible.

## Variant-aware matching

### Decision
Prefer the shopper's selected variant colorway when available, fall back to product-level effective colorway keys when variant-specific data is missing, and require same-role swaps to stay within the same functional category.

### Rationale
The spec explicitly calls out cases where the product-level style data looks compatible but the selected variant breaks the match. Variant-aware evaluation is necessary for accurate swap guidance, while product-level fallback keeps the system functional for catalogs without fully normalized variant colorway data.

### Alternatives considered
- Product-only matching: rejected because it can recommend the wrong swap for multi-colorway products.
- Variant-only matching: rejected because many products may not yet expose clean variant-level colorway keys.

## Merchant control surface

### Decision
Keep merchant control in the existing Polaris knowledge-graph route and, if needed, add only preview-oriented enhancements there rather than a new admin route.

### Rationale
The current `app/routes/app.knowledge-graph.tsx` already owns visual overrides and compatibility rules. The shopper-facing style slice depends on that reviewed data, so any admin-side follow-up should remain on the same surface to avoid fragmented merchandising workflows.

### Alternatives considered
- Create a dedicated top-level style manager route: rejected because the current knowledge-graph route already contains the relevant visual-review workflow.
- Skip admin preview entirely: rejected because merchants may need a way to inspect how overrides affect shopper-facing style results.