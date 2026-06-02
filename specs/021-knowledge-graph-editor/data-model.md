# Data Model: Knowledge Graph Editor

## Entities

## 1. ProductIntelligenceRecord
- Purpose: Canonical product intelligence state shown in the editor.
- Fields:
  - id: string
  - productId: string
  - disciplineAssignments: string[]
  - categoryAssignments: string[]
  - confidenceScore: number
  - reviewStatus: enum (pending, reviewed, needs_attention)
  - sourceVersion: string
  - updatedAt: datetime
- Validation:
  - confidenceScore range is 0.0 to 1.0.
  - at least one discipline or category assignment is required for reviewed status.

## 2. ClassificationOverride
- Purpose: Merchant-authored override replacing auto-generated classification output.
- Fields:
  - id: string
  - productId: string
  - dimension: enum (discipline, category)
  - overrideValues: string[]
  - isActive: boolean
  - createdBy: string
  - createdAt: datetime
  - supersededAt: datetime | null
- Validation:
  - overrideValues must be non-empty when isActive is true.
  - only one active override per product+dimension.

## 3. RelationshipRule
- Purpose: Directed product relationship used by recommendations and kit completeness.
- Fields:
  - id: string
  - sourceProductId: string
  - targetProductId: string
  - relationshipType: enum (complements, upgrades, alternatives, conflicts, same_collection)
  - weight: number
  - isActive: boolean
  - revision: number
  - updatedAt: datetime
- Validation:
  - sourceProductId and targetProductId must differ.
  - weight range is 0.0 to 1.0.

## 4. SizeMappingRule
- Purpose: Mapping logic across category-specific size systems.
- Fields:
  - id: string
  - fromCategory: string
  - toCategory: string
  - fromSizeCode: string
  - toSizeCode: string
  - confidenceBand: enum (strict, normal, flexible)
  - isActive: boolean
  - revision: number
  - updatedAt: datetime
- Validation:
  - fromCategory and toCategory are required.
  - fromSizeCode and toSizeCode are required.

## 5. BulkUpdateOperation
- Purpose: Tracks one confirmed bulk governance mutation.
- Fields:
  - id: string
  - operationType: enum (reclassify, relationship_update, tag_apply, tag_remove)
  - targetCount: number
  - previewHash: string
  - initiatedBy: string
  - status: enum (previewed, confirmed, running, partial, completed, failed, cancelled)
  - startedAt: datetime | null
  - finishedAt: datetime | null
- Validation:
  - operationType is required.
  - targetCount > 0 for confirmed operations.

## 6. ChangeLogEntry
- Purpose: Immutable audit trail for all editor mutations.
- Fields:
  - id: string
  - actorId: string
  - entityType: enum (product_intelligence, classification_override, relationship_rule, size_mapping_rule, bulk_update_operation)
  - entityId: string
  - action: enum (create, update, delete, activate, deactivate, bulk_apply)
  - beforeSnapshot: json | null
  - afterSnapshot: json | null
  - reason: string | null
  - createdAt: datetime
- Validation:
  - at least one of beforeSnapshot/afterSnapshot must be present.

## Relationships
- ProductIntelligenceRecord 1:N ClassificationOverride (by product and dimension history).
- ProductIntelligenceRecord 1:N RelationshipRule (as source/target references).
- ProductIntelligenceRecord 1:N SizeMappingRule (through category mappings).
- BulkUpdateOperation 1:N ChangeLogEntry.
- All mutable entities 1:N ChangeLogEntry.

## State Transitions

## Product intelligence lifecycle
1. ingested -> draft intelligence generated.
2. pending_review -> confidence/risk queue assignment.
3. reviewed -> merchant approves or overrides.
4. propagated -> downstream intelligence consumers read updated values.
5. reflagged -> future sync or conflicts push item back to pending_review.

## Bulk update lifecycle
1. drafted -> operation request captured.
2. previewed -> impact preview generated.
3. confirmed -> operator approves execution.
4. running -> per-record updates processed.
5. completed_or_partial_or_failed -> terminal status with result summary.
