# Contract: Knowledge Graph Editor Propagation

## Scope
Defines how approved knowledge graph governance changes become visible to downstream cart intelligence consumers.

## Propagation Rules
- Approved overrides are authoritative over auto-generated values.
- Relationship and size mapping edits become the active read set after successful persistence.
- Downstream recommendation and conflict-detection reads must consume the latest approved state within one minute.

## Consistency Model
- Read-your-write consistency is required for the editing admin session immediately after successful save.
- Eventual consistency is allowed across independent sessions and services within the one-minute propagation window.

## Observability Requirements
- Mutation responses include a propagation token or equivalent trace identifier.
- System emits metrics for propagation delay and stale-read incidents.
- Audit logs connect each mutation to downstream consumption version identifiers.

## Failure Semantics
- If propagation cannot complete within the bounded window, system flags the state for retry and operator visibility.
- Failed propagation does not erase successfully persisted governance edits.
