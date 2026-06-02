# Feature Specification: Knowledge Graph Editor

**Feature Branch**: `021-knowledge-graph-editor`  
**Created**: 2026-06-02  
**Status**: Draft  
**Input**: User description: "Feature: Knowledge Graph Editor in #file:prd-cartmind.md"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Review and correct product intelligence (Priority: P1)

As a merchant admin, I can review low-confidence product classifications and relationship suggestions, then approve or correct them so cart recommendations remain accurate.

**Why this priority**: If product intelligence is wrong, every downstream recommendation, warning, and kit suggestion loses trust.

**Independent Test**: Can be fully tested by loading flagged products, applying corrections, and confirming corrected outcomes are used in subsequent cart analysis results.

**Acceptance Scenarios**:

1. **Given** products with low-confidence classification, **When** the admin reviews and saves corrected discipline/category assignments, **Then** those products are marked as reviewed and use the corrected assignments.
2. **Given** suggested product relationships, **When** the admin approves, edits, or removes a relationship, **Then** the relationship graph reflects the admin decision for future analysis.

---

### User Story 2 - Manage size and fit mappings safely (Priority: P2)

As a merchant admin, I can define and update size mappings across related product categories so the system detects likely mismatch cases accurately.

**Why this priority**: Size mismatch prevention directly affects return-rate reduction and customer confidence.

**Independent Test**: Can be independently tested by updating size mappings and validating that known mismatch scenarios are flagged while known valid scenarios remain unflagged.

**Acceptance Scenarios**:

1. **Given** existing size mapping rules, **When** the admin updates mappings and saves changes, **Then** subsequent size conflict checks use the updated rules.
2. **Given** incomplete or contradictory mapping input, **When** the admin attempts to save, **Then** the system prevents invalid changes and clearly explains what must be corrected.

---

### User Story 3 - Apply bulk governance updates efficiently (Priority: P3)

As a merchant admin, I can perform bulk updates on product intelligence attributes (such as shared collection tagging or discipline reassignment) to reduce manual effort on large catalogs.

**Why this priority**: Bulk workflows reduce setup and maintenance time, enabling merchants to keep data quality high as catalogs change.

**Independent Test**: Can be independently tested by selecting a product subset, applying a bulk change, and confirming all targeted records are updated while non-targeted records are unchanged.

**Acceptance Scenarios**:

1. **Given** a filtered product subset, **When** the admin executes a bulk update, **Then** all selected products receive the intended change.
2. **Given** a bulk update preview, **When** the admin cancels before confirmation, **Then** no product intelligence data is modified.

### Edge Cases

- What happens when a product belongs to multiple valid disciplines and the admin reclassifies only one dimension?
- How does the system handle simultaneous edits by two admins on the same product relationship?
- What happens when a bulk action targets products that already contain mixed or conflicting values?
- How does the system handle products with missing key attributes needed for classification or size mapping?
- What happens when an admin removes a relationship currently used by active bundle or recommendation logic?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow merchant admins to view products grouped by discipline and functional category with confidence indicators.
- **FR-002**: System MUST allow merchant admins to override product discipline and category assignments and persist those overrides as authoritative until changed.
- **FR-003**: System MUST allow merchant admins to create, edit, and remove product relationships, including relationship type and priority/strength.
- **FR-004**: System MUST allow merchant admins to define and update cross-category size and fit mappings used by cart size conflict analysis.
- **FR-005**: System MUST validate edits before save and block contradictory or incomplete rule definitions that would produce ambiguous outcomes.
- **FR-006**: System MUST provide bulk update capabilities for selected product sets, including a confirmation step before applying changes.
- **FR-007**: System MUST maintain a review queue or equivalent view that prioritizes low-confidence classifications and unresolved data-quality issues.
- **FR-008**: System MUST provide searchable and filterable views so admins can locate specific products, categories, relationships, and pending reviews.
- **FR-009**: System MUST keep an auditable change history of admin edits, including who changed what and when.
- **FR-010**: System MUST ensure downstream cart-intelligence processes use the latest approved admin data after changes are saved.

### Key Entities *(include if feature involves data)*

- **Product Intelligence Record**: Canonical representation of a product's discipline/category assignments, confidence state, and review status.
- **Classification Override**: Merchant-approved replacement value for an automatically generated classification, including effective state and timestamp.
- **Relationship Rule**: Directed link between products with relationship type and priority/strength used in recommendations and completeness analysis.
- **Size Mapping Rule**: Normalized mapping between sizing schemes across related categories used to detect likely mismatches.
- **Bulk Update Operation**: User-confirmed grouped change request affecting a selected set of product intelligence records.
- **Change Log Entry**: Auditable record of a modification, actor identity, target object, timestamp, and before/after values.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Merchant admins can complete first-pass review of flagged product intelligence items for a catalog of up to 1,000 products in under 2 hours.
- **SC-002**: At least 95% of admin-approved edits are reflected in downstream recommendation outcomes within 1 minute of save.
- **SC-003**: At least 90% of sampled known relationship and size-rule corrections are applied correctly without manual rework.
- **SC-004**: Bulk governance workflows reduce manual update time by at least 60% compared to one-by-one editing for equivalent catalog changes.
- **SC-005**: At least 85% of merchants report that maintaining product intelligence quality is straightforward after onboarding.

## Assumptions

- Merchant users performing these actions have admin-level permissions for product intelligence governance.
- Existing catalog ingestion and initial auto-classification continue to provide draft intelligence data for review.
- This feature focuses on managing product intelligence data quality and does not include redesign of storefront recommendation presentation.
- Change history must be retained long enough for operational troubleshooting and accountability.
- Bulk actions are scoped to explicitly selected products and require explicit confirmation before commit.