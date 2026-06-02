# Contract: Knowledge Graph Editor API

## Scope
Defines the functional contract for reading and mutating knowledge graph governance data from the embedded admin editor.

## Read Operations
- List product intelligence records with filters: discipline, category, confidence band, review status, search query.
- Retrieve relationship rules for a product or product set.
- Retrieve size mapping rules for selected category pairs.
- Retrieve change history for a target entity.

### Read Guarantees
- Responses include pagination metadata.
- Returned records include revision/version metadata for optimistic concurrency.
- Filter semantics are deterministic and stable for identical inputs.

## Mutation Operations
- Upsert classification override.
- Upsert relationship rule.
- Upsert size mapping rule.
- Execute confirmed bulk update operation.
- Mark review status for flagged records.

### Mutation Guarantees
- All mutation requests are validated before persistence.
- Mutation responses include operation outcome and updated revision.
- Conflict responses are explicit when stale revision tokens are submitted.
- Auditable change log entries are emitted for successful mutations.

## Error Contract
- Validation errors return a structured, field-addressable payload.
- Conflicts return a stale-write indicator with current server revision metadata.
- Authorization failures return an explicit permission-denied response.

## Non-Goals
- No storefront cart mutation behavior is defined by this contract.
- No direct changes to checkout extension behavior are defined by this contract.
