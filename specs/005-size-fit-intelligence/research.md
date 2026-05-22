# Research: Size & Fit Intelligence

## Size chart data structure

### Decision
Store size charts as a JSON lookup table in a new `SizeChart` model keyed by `(shop, categoryTag, sizeSystem)`. The `breakpoints` JSON field encodes an ordered array of entries mapping a size label to its measurement range (e.g., `{ label: "M", minWeight: 65, maxWeight: 75, unit: "kg" }`). A separate `source` field distinguishes auto-generated charts from merchant overrides. Merchant overrides live in the same row — an `overrideBreakpoints` JSON field supersedes `breakpoints` when present.

### Rationale
A single-row-per-category model is easy to query (one lookup by `categoryTag`), easy for merchants to inspect and replace, and avoids the complexity of a fully normalized breakpoint table for the first implementation. The override-in-row approach guarantees that `syncCatalog` can refresh `breakpoints` without touching `overrideBreakpoints`, satisfying FR-007.

### Alternatives considered
- Fully normalized `SizeBreakpoint` rows: rejected because multi-row reads for a simple size lookup add complexity without benefit at catalog scale.
- Separate `SizeChartOverride` table: rejected because two-table merges on every recommendation query are more expensive than a JSON coalesce in a single row.

## Cross-product size mapping and conflict detection

### Decision
Use an explicit pairwise `CrossSizeMapping` table: `(shop, sourceCategoryTag, sourceSize, targetCategoryTag, targetSize, source)`. Conflict detection compares the mapped size for each pair of cart items against this table; a mismatch is a conflict. Severity is derived from the category pair: items in the same age-range group (adult vs. child categories) produce an `ERROR`; items within the same adult category that diverge by more than one size step produce a `WARNING`.

### Rationale
Explicit pairings are deterministic, fully unit-testable, and easy for merchants to reason about. Normalizing all sizes to body measurements first (Option B from the spec) would require solving the size-to-measurement mapping problem twice — once for recommendations and once for conflict detection — doubling the surface area. Explicit mappings also allow the PRD's severity distinction (error vs. warning) to be encoded directly in the category-pair metadata.

### Alternatives considered
- Normalize sizes to body measurements and compare numerically: rejected because it requires a reliable numeric measurement for every size label, which is not available for all product categories at launch.
- Machine-learning conflict scorer: rejected for v1 as non-deterministic and unverifiable without sufficient labeled training data.

## Size recommendation algorithm

### Decision
Apply a three-step resolution: (1) if the customer's known size for the target category exists in their size profile, return it directly; (2) if the customer has a body attribute (weight, chest, waist) and a size chart exists for the category, find the breakpoint whose range contains the attribute; (3) if neither is available, return null (no guidance). When the customer's measurement falls between two breakpoints, return the larger size with a caveat note. Merchant `overrideBreakpoints` always replaces auto-generated `breakpoints` in step 2.

### Rationale
This is purely table-driven and requires no AI inference, making it fast (sub-millisecond in-process) and deterministic. The "larger size on boundary" default matches the industry convention for most combat sports gear (better to have slack than to be too tight for protective equipment).

### Alternatives considered
- LLM-assisted recommendation for ambiguous cases: rejected for the core lookup path because it adds latency, non-determinism, and cost; an LLM can still be used by the conversational sidebar to explain the recommendation.
- Return the smaller size on boundary: rejected because for safety gear (gloves, headgear) a snug-but-incorrect fit is worse than a slightly large fit.

## Return data integration approach

### Decision
Add a `SizeReturnRecord` table that can be populated from two sources: (a) automated ingestion from Shopify order refund data when the return integration is enabled (Phase 5 of the PRD), and (b) a manual CSV import surface in the admin for merchants who want to seed historical data. The size chart adjustment logic runs as a batch job that recalculates `breakpoints` only when a configurable minimum sample count (`MIN_RETURN_SAMPLES`, default 10) is exceeded for a category. Merchant `overrideBreakpoints` are never touched by this job.

### Rationale
Separating the data ingestion path from the adjustment logic allows the adjustment algorithm to be tested deterministically with fixtures. The minimum sample threshold prevents noisy small-sample adjustments, matching FR-010. Protecting `overrideBreakpoints` satisfies FR-011 and is consistent with the pattern established in the relationship mapping feature.

### Alternatives considered
- Adjust size charts in real time per return event: rejected because individual returns are too noisy and the 5-second webhook response budget leaves no room for synchronous chart recalculation.
- Use only automated Shopify order data: rejected because that integration is deferred to Phase 5; the feature must be independently testable before that integration exists.

## Admin surface placement

### Decision
Extend the existing embedded Polaris knowledge-graph admin route (`app.knowledge-graph.tsx`) with a new "Size Charts" tab. The tab lists product categories, shows the current breakpoints (auto-generated or override), and provides inline editing for merchant overrides. A second tab lists cross-size mappings with add/edit/delete actions. This avoids creating a new top-level route before the existing knowledge-graph surface is mature.

### Rationale
Consistent with the decision made for Product Relationship Mapping — extending the existing route costs less than maintaining two separate knowledge-graph admin pages and keeps the navigation hierarchy flat for merchants.

### Alternatives considered
- Standalone `app.sizing.tsx` admin route: deferred — appropriate once the knowledge-graph route becomes too crowded, but premature for v1.
- Size chart editing inline on the product detail page: rejected because size charts are per-category, not per-product, and placing them on the product page would confuse the mental model.

## CustomerSizeProfile storage

### Decision
The `CustomerProfile` model described in the PRD already contains a `sizeProfile` JSON field. For this feature, that field is treated as the source of truth for known sizes and is updated by the recommendation engine whenever a customer confirms or corrects a recommended size. For logged-in customers the profile is persisted in the DB; for anonymous customers it is stored in a server-side session cookie (consistent with the existing anonymous profile pattern).

### Rationale
No new model is needed — the PRD's `CustomerProfile` table already covers this use case. Keeping the size profile inside the existing profile record avoids cross-table joins on every recommendation request.

### Alternatives considered
- Separate `CustomerSizeProfile` table: rejected because it duplicates the profile model described in the PRD without adding meaningful structure for this feature's scope.
