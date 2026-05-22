# Data Model: Product Relationship Mapping

## Entities

### ProductRelationship

Represents an approved or candidate link between two products.

- `id`: Internal unique identifier.
- `sourceProductId`: Product initiating the relationship intent.
- `targetProductId`: Product receiving the relationship intent.
- `relationshipType`: One of `COMPLEMENTS`, `UPGRADES`, `ALTERNATIVES`, `CONFLICTS`, `SAME_COLLECTION`.
- `directionality`: `DIRECTIONAL` or `SYMMETRIC` so query code can normalize behavior consistently.
- `strength`: Relative score used for ranking within a relationship type.
- `status`: `CANDIDATE`, `ACTIVE`, `REJECTED`, `INACTIVE`.
- `origin`: `AUTO` or `MERCHANT`.
- `evidenceSummary`: Structured summary of why the relationship exists.
- `reviewedAt`: Timestamp for merchant review actions.
- `invalidatedAt`: Timestamp set when a relationship is no longer valid because of product lifecycle changes.
- `createdAt`, `updatedAt`: Standard audit timestamps.

### RelationshipEvidence

Represents the evidence snapshot supporting a candidate or active relationship.

- `id`: Internal unique identifier.
- `productRelationshipId`: Parent relationship reference.
- `evidenceType`: `TAXONOMY`, `COLLECTION`, `EMBEDDING`, `MERCHANT_RULE`, `COPURCHASE`, `CATALOG_METADATA`.
- `score`: Contribution of this evidence source to the final strength.
- `details`: JSON payload describing the evidence input used.
- `createdAt`: Audit timestamp.

### RelationshipOverride

Represents a merchant-authored create, update, suppression, or reactivation decision.

- `id`: Internal unique identifier.
- `normalizedPairKey`: Canonical key for the affected product pair.
- `relationshipType`: Relationship type being overridden.
- `action`: `CREATE`, `UPDATE`, `REJECT`, `REACTIVATE`, `DISABLE`.
- `appliedState`: Snapshot of the merchant-approved result.
- `createdBy`: Shop-scoped actor reference if available.
- `createdAt`: Audit timestamp.

## Relationships

- A `Product` can participate in many `ProductRelationship` rows as both source and target.
- A `ProductRelationship` can have many `RelationshipEvidence` rows.
- A `RelationshipOverride` maps to one normalized product pair and one relationship type, and its latest applicable decision controls the active relationship state.

## Validation Rules

- A product cannot relate to itself.
- The normalized pair plus relationship type must be unique among active/candidate records after canonicalization.
- Merchant-authored state has precedence over automated state for the same normalized pair and type.
- Symmetric relationship types must resolve to one canonical stored pair.
- Relationships tied to deleted, archived, or unavailable products cannot remain in the approved downstream view.
- A candidate without sufficient evidence can exist for review, but cannot appear in the approved downstream view until promoted to `ACTIVE`.

## State Transitions

- `CANDIDATE -> ACTIVE`: automated promotion or merchant approval.
- `CANDIDATE -> REJECTED`: merchant rejects the suggestion.
- `ACTIVE -> INACTIVE`: related product lifecycle or evidence invalidation removes it from approved use.
- `REJECTED -> ACTIVE`: merchant explicitly reactivates the relationship.
- `INACTIVE -> ACTIVE`: remapping or merchant review restores eligibility.