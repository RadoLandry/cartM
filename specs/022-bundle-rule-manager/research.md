# Research: Bundle Rule Manager

## Rule persistence model

### Decision
Represent bundle rules as first-class persisted entities with explicit requirement rows, lifecycle state, priority metadata, and audit fields.

### Rationale
The feature requires safe CRUD, deterministic preview parity, and lifecycle controls. Relational persistence supports partial updates, policy checks, and durable governance better than freeform blobs.

### Alternatives considered
- Store rules in a single JSON document per shop: rejected because requirement-level validation and targeted updates become brittle.
- Store only in Shopify metafields: rejected because admin editing, auditability, and cross-route consistency are harder to guarantee.

## Deterministic evaluation and overlap policy

### Decision
Use deterministic evaluation with explicit tie-breaks: higher merchant priority first, then stronger qualification ratio, then lowest incentive cost to merchant, then creation timestamp.

### Rationale
Merchants need consistent outcomes across preview and active evaluation. A strict policy prevents inconsistent offers when multiple rules overlap.

### Alternatives considered
- Return all matching rules equally: rejected because customer-facing surfaces need one deterministic winning incentive.
- Pick random or first-loaded match: rejected because results become unstable and non-auditable.

## Preview parity contract

### Decision
Preview uses the same evaluator and policy chain as active runtime evaluation and returns explainable diagnostics for non-qualification.

### Rationale
Merchants need trust that preview behavior mirrors production behavior. Shared evaluation logic eliminates drift.

### Alternatives considered
- Separate lightweight preview logic: rejected because it risks mismatch between preview and live activation.

## Lifecycle governance

### Decision
Support lifecycle states `DRAFT`, `ACTIVE`, `PAUSED`, and `ARCHIVED` with guarded transitions and immutable history records.

### Rationale
Campaign operations require safe enable/disable workflows while preserving historical accountability.

### Alternatives considered
- Only active/inactive boolean: rejected because archived history and draft staging are both required by the feature scope.

## Downstream projection strategy

### Decision
Generate a compact projection of active rule data for downstream cart/checkout/function consumers instead of exposing full admin entities.

### Rationale
Downstream consumers should receive only evaluation-relevant fields, reducing payload size and keeping function-oriented consumers efficient.

### Alternatives considered
- Recompute from full admin entities in every consumer: rejected because it duplicates logic and increases drift risk.
