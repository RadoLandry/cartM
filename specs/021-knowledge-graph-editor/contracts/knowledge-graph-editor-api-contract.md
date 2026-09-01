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

## Consistency Validation Notes (T044)

- **Revision metadata**: `RelationshipRule` and `SizeMappingRule` (persisted as `ProductRelationship`/`CrossSizeMapping`) have no dedicated `revision` column in the Prisma schema. The implementation uses `updatedAt.getTime()` as the revision token (see `app/lib/knowledge-graph/editor.concurrency.ts` `assertRevisionMatches`, wired in `app/lib/knowledge-graph/sizing.ts`). This satisfies the "revision/version metadata for optimistic concurrency" read guarantee without a schema migration; relationship-rule upserts do not yet enforce this check (only size-mapping rules do as of Sprint 4).
- **Upsert size mapping rule**: implemented via the `upsert-size-mapping-rule` / `deactivate-size-mapping-rule` route intents, backed by `upsertGovernedSizeMapping` / `deactivateGovernedSizeMapping`, satisfying contradiction validation, stale-write conflict responses, and audit log emission.
- **Execute confirmed bulk update operation**: implemented as `preview-bulk-operation` → `confirm-bulk-operation` (confirms then synchronously executes) → `cancel-bulk-operation`, backed by `app/lib/knowledge-graph/editor.bulk.ts`. Per-record outcomes are returned in the confirm response; the `KnowledgeGraphBulkOperation` row has no JSON column for the target list/change payload, so the preview snapshot is stored as the initial `KnowledgeGraphChangeLog` entry (linked via `bulkOperationId`) rather than on the operation row itself.
- **Retrieve change history**: implemented via `getKnowledgeGraphChangeHistory` (paginated, cursor-based) in `app/lib/knowledge-graph/editor.ts`, surfaced in the admin UI via `KnowledgeGraphAuditTrail.tsx`.
- **Error contract — permission-denied**: not yet distinctly modeled. The route only enforces `authenticate.admin(request)` at the loader/action boundary (Shopify session auth); there is no separate governance-level permission check or a dedicated `permission-denied` response shape. This is a known gap versus the contract's error section.
- **Deactivation semantics**: `SizeMappingRule` has no `isActive` flag in the schema (unlike `ProductClassificationOverride`), so "deactivate" is implemented as a hard delete guarded by the revision check and recorded as a `DEACTIVATE` change-log entry, rather than a soft-deactivate-and-reactivate lifecycle.

