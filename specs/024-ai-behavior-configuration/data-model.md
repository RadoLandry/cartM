# Data Model: AI Behavior Configuration

## Entity: AIBehaviorDraft

- Purpose: Mutable per-shop working copy of behavior settings edited in admin before publication.
- Key fields:
  - `id` (UUID)
  - `shop` (string, unique)
  - `versionToken` (string) for optimistic concurrency
  - `tone` (enum: `PROFESSIONAL`, `FRIENDLY`, `CONCISE`, `COACHING`)
  - `aggressiveness` (decimal 0..1)
  - `safetyPriority` (enum: `SAFETY_FIRST`, `BALANCED`)
  - `customGuidance` (string, nullable)
  - `conversationStarters` (json array of strings)
  - `updatedBy` (string)
  - `updatedAt` (datetime)
  - `createdAt` (datetime)
- Validation rules:
  - `aggressiveness` in inclusive range [0, 1].
  - `customGuidance` max length bounded to prompt budget.
  - `conversationStarters` contains unique non-empty strings with max item count.
  - Save requires matching `versionToken` to prevent lost updates.

## Entity: AIBehaviorPublishedVersion

- Purpose: Immutable published snapshot used by storefront runtime and rollback source.
- Key fields:
  - `id` (UUID)
  - `shop` (string)
  - `versionNumber` (integer, monotonic per shop)
  - `status` (enum: `ACTIVE`, `ARCHIVED`)
  - `snapshot` (json; full behavior payload)
  - `publishedBy` (string)
  - `publishedAt` (datetime)
  - `archivedAt` (datetime, nullable)
- Validation rules:
  - Exactly one `ACTIVE` version per shop.
  - `snapshot` must conform to behavior configuration schema.

## Entity: AIBehaviorAuditEntry

- Purpose: Traceability for configuration lifecycle actions.
- Key fields:
  - `id` (UUID)
  - `shop` (string)
  - `actionType` (enum: `DRAFT_SAVED`, `PUBLISHED`, `ROLLED_BACK`)
  - `actorId` (string)
  - `targetVersionId` (UUID, nullable)
  - `beforeSnapshot` (json, nullable)
  - `afterSnapshot` (json, nullable)
  - `reason` (string, nullable)
  - `createdAt` (datetime)
- Validation rules:
  - `beforeSnapshot` and `afterSnapshot` required for `PUBLISHED` and `ROLLED_BACK`.
  - `actorId` required for all actions.

## Entity: AIBehaviorPreviewRun

- Purpose: Captures preview execution metadata and outcomes for merchant review and diagnostics.
- Key fields:
  - `id` (UUID)
  - `shop` (string)
  - `status` (enum: `READY`, `RUNNING`, `FAILED`)
  - `inputSnapshot` (json)
  - `scenarioSet` (json array)
  - `resultPayload` (json, nullable)
  - `errorCode` (string, nullable)
  - `requestedBy` (string)
  - `requestedAt` (datetime)
  - `completedAt` (datetime, nullable)
- Validation rules:
  - `resultPayload` required when `status = READY`.
  - `errorCode` required when `status = FAILED`.

## Relationships

- `AIBehaviorDraft.shop -> AIBehaviorPublishedVersion.shop` (logical one-to-many across version lifecycle).
- `AIBehaviorPublishedVersion.id -> AIBehaviorAuditEntry.targetVersionId` (one-to-many).
- `AIBehaviorPreviewRun` references `AIBehaviorDraft` by embedded `inputSnapshot` at request time (snapshot consistency).

## State Transitions

### AIBehaviorPublishedVersion

- `ACTIVE -> ARCHIVED`: when a newer version is published or rollback activates a different snapshot.

### Publish Flow

- Draft validated -> create new `AIBehaviorPublishedVersion (ACTIVE)` -> previous active set to `ARCHIVED` -> audit entry inserted.

### Rollback Flow

- Selected archived version cloned as new active published snapshot -> previous active archived -> rollback audit entry inserted.

### AIBehaviorPreviewRun

- `RUNNING -> READY`: preview generated successfully.
- `RUNNING -> FAILED`: preview generation or validation failure.
