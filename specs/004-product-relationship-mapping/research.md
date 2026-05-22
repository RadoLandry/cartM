# Research: Product Relationship Mapping

## Relationship shape and directionality

### Decision
Use a normalized relationship record with a canonical source/target pair, a relationship type, a source of truth (`AUTO` or merchant-authored), and an active status. Treat `complements` and `upgrades` as directional by default. Treat `alternatives`, `conflicts`, and `same-collection` as symmetric at the business level, but normalize them into a canonical stored pair so duplicate mirrored rows are not required.

### Rationale
The PRD examples are directional for complements and upgrades, while conflicts and alternatives behave like shared compatibility rules. Storing one canonical record for symmetric relationships keeps downstream query logic simpler than maintaining mirrored rows and reduces duplicate-merge edge cases during remapping.

### Alternatives considered
- Store every relationship as directional: rejected because conflicts and alternatives would need duplicate mirrored entries and merchant edits would become harder to reason about.
- Store every relationship as symmetric: rejected because upgrades and complements lose important intent for recommendation ranking and cart actions.

## Evidence precedence and override handling

### Decision
Generate relationship candidates from catalog metadata, taxonomy tags, collection overlap, merchant-defined rules, embeddings, and purchase co-occurrence when available. Merchant overrides always take precedence over automated suggestions for the same normalized product pair and relationship type. Rejected merchant decisions persist across later remapping runs.

### Rationale
The feature only becomes trustworthy if merchant curation survives future syncs. Preserving explicit suppressions also avoids the frustrating loop where automated logic recreates relationships the merchant has intentionally removed.

### Alternatives considered
- Let automated remapping overwrite all previous state: rejected because it breaks FR-007 and FR-008.
- Store only the latest final relationship and discard evidence provenance: rejected because low-confidence review and debugging need visibility into why a relationship was suggested.

## Retrieval contract for downstream cart intelligence

### Decision
Expose a dedicated approved relationship view that returns only active, valid relationships for downstream consumers, filterable by product, relationship type, and priority. Candidate evidence and rejected records stay outside customer-facing reads.

### Rationale
Cart intelligence features need a stable and low-noise read surface. Mixing candidate and approved relationships would create ambiguity for recommendation, bundle, and conflict logic.

### Alternatives considered
- Let downstream features read raw relationship rows directly: rejected because each consumer would need to re-implement status filtering and merchant precedence logic.
- Build a separate denormalized cache first: rejected for v1 because direct query helpers are simpler and sufficient at current scale.

## Incremental remapping strategy

### Decision
Run relationship generation incrementally for changed products after ingestion updates classification, embeddings, and normalized product data. Limit candidate evaluation to bounded sets drawn from shared taxonomy, collections, and nearest-neighbor embedding matches rather than recomputing the full catalog on every sync.

### Rationale
The codebase already performs classification and embedding generation during sync. Reusing that lifecycle for relationship mapping avoids adding a separate full-catalog job to every webhook and keeps the feature within the repo's performance constraints.

### Alternatives considered
- Recompute all product relationships on every webhook: rejected because it does not scale to the 10k-product target and would risk webhook-related performance regressions.
- Require a separate manual batch run only: rejected because relationships would go stale too easily after catalog edits.

## Admin curation surface

### Decision
Extend the existing embedded Polaris knowledge-graph route with relationship review/edit actions before introducing a separate graph visualization experience.

### Rationale
The current codebase already has a trusted admin route, loader/action pattern, and Polaris table workflow for taxonomy overrides. Reusing that surface keeps the first implementation aligned with the constitution and reduces planning risk.

### Alternatives considered
- Create a new standalone admin route immediately: rejected because the first requirement is merchant review/edit, not a richer visualization shell.
- Build a free-form graph canvas first: rejected because it increases UI complexity before the persistence and approval flow are stable.