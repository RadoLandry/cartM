# Data Model: Bundle Rule Manager

## Entity: BundleRule

Purpose: Merchant-owned bundle configuration used for preview and active cart evaluation.

Fields:
- id (string, primary key)
- shopId (string, indexed)
- name (string, required, unique per shop among non-archived rules)
- description (string, optional)
- status (enum: DRAFT | ACTIVE | PAUSED | ARCHIVED)
- priority (integer, default 100, lower means higher priority)
- minimumQualifiedItems (integer, required, >= 1)
- discountType (enum: PERCENTAGE | FIXED)
- discountValue (decimal, required, > 0)
- startsAt (datetime, optional)
- endsAt (datetime, optional)
- createdBy (string, required)
- updatedBy (string, required)
- createdAt (datetime)
- updatedAt (datetime)

Relationships:
- One-to-many with BundleRuleRequirement
- One-to-many with BundleRuleAuditRecord

Validation rules:
- `name` must be non-empty and <= 120 chars
- `endsAt` must be greater than `startsAt` when both exist
- `discountValue` maximum depends on `discountType`
- ACTIVE state requires at least one requirement and valid incentive parameters

## Entity: BundleRuleRequirement

Purpose: Defines product contribution rules needed to satisfy a bundle.

Fields:
- id (string, primary key)
- bundleRuleId (string, foreign key)
- productId (string, required)
- variantId (string, optional)
- quantityRequired (integer, required, >= 1)
- requirementType (enum: REQUIRED | OPTIONAL)
- sortOrder (integer)
- createdAt (datetime)
- updatedAt (datetime)

Relationships:
- Many-to-one with BundleRule

Validation rules:
- At least one REQUIRED requirement per rule
- No duplicate requirement tuples for same rule (productId + variantId)

## Entity: BundleRuleAuditRecord

Purpose: Immutable event history for governance and troubleshooting.

Fields:
- id (string, primary key)
- bundleRuleId (string, foreign key)
- actionType (enum: CREATED | UPDATED | STATUS_CHANGED | DUPLICATED | ARCHIVED)
- actorId (string, required)
- fromStatus (enum, optional)
- toStatus (enum, optional)
- changeSummary (json, required)
- createdAt (datetime)

Relationships:
- Many-to-one with BundleRule

Validation rules:
- `changeSummary` must include only whitelisted field changes
- STATUS_CHANGED records require `fromStatus` and `toStatus`

## Entity: RulePreviewScenario

Purpose: Ephemeral request model used to test a rule against a sample cart.

Fields:
- shopId (string, required)
- bundleRuleId (string, optional for draft preview)
- cartLines (array, required)
- cartLines[].productId (string, required)
- cartLines[].variantId (string, optional)
- cartLines[].quantity (integer, required, >= 1)
- now (datetime, optional override)

Validation rules:
- cartLines length >= 1
- all product references must resolve in catalog for same shop

## Entity: RuleEvaluationOutcome

Purpose: Deterministic evaluator output consumed by admin preview and runtime cart logic.

Fields:
- matched (boolean)
- winningRuleId (string, optional)
- qualificationRatio (decimal 0..1)
- missingRequirements (array)
- appliedDiscountType (enum, optional)
- appliedDiscountValue (decimal, optional)
- overlapCandidates (array of rule IDs)
- decisionTrace (array of strings)

Validation rules:
- `winningRuleId` required when matched=true
- `appliedDiscount*` required when matched=true

## State transitions

Allowed transitions:
- DRAFT -> ACTIVE
- DRAFT -> ARCHIVED
- ACTIVE -> PAUSED
- ACTIVE -> ARCHIVED
- PAUSED -> ACTIVE
- PAUSED -> ARCHIVED

Disallowed transitions:
- ARCHIVED -> any state

Transition guards:
- Activation requires successful validation and at least one REQUIRED requirement.
- Archiving allowed from DRAFT/ACTIVE/PAUSED only.
- Transition failure leaves prior state unchanged and records no partial mutation.
