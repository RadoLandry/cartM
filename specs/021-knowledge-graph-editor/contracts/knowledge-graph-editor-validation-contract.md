# Contract: Knowledge Graph Editor Validation

## Scope
Defines validation and rejection semantics for classification, relationship, size mapping, and bulk governance updates.

## Validation Rules

## Classification Overrides
- Override value sets must be non-empty.
- Override values must belong to merchant-allowed taxonomy terms.
- Deactivation of the active override must restore deterministic fallback behavior.

## Relationship Rules
- Source and target products must be distinct and valid.
- Relationship type must be in the supported enumeration.
- Weight must be within the accepted numeric range.

## Size Mapping Rules
- Category pairs must be valid for mapping.
- Size codes must be non-empty normalized values.
- Contradictory mappings for the same normalized pair are rejected.

## Bulk Update Operations
- Target set must be non-empty.
- Preview hash must match the confirmation request to prevent drift.
- Per-record failures do not hide success/failure counts for the overall operation.

## Error Shape
- `code`: stable machine-readable classification.
- `message`: operator-readable summary.
- `fieldErrors[]`: optional field-level details.
- `conflict`: optional stale-revision details where relevant.

## Guarantees
- Validation runs server-side for every mutation.
- No partially-applied single-record mutation is committed when validation fails.
- Bulk operations return deterministic aggregate status (`completed`, `partial`, `failed`).
