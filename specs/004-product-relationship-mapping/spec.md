# Feature Specification: Product Relationship Mapping

**Feature Branch**: `[004-product-relationship-mapping]`  
**Created**: 2026-05-22  
**Status**: Draft  
**Input**: User description: "Feature: Product Relationship Mapping dans prd-cartmind.md"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Generate Relationship Suggestions (Priority: P1)

As a merchant admin, I want the system to generate an initial map of product relationships from my catalog and shopping patterns so the cart can begin making relevant guidance without requiring full manual setup.

**Why this priority**: This is the foundation for every downstream recommendation, bundle, and conflict flow. Without an initial relationship graph, the feature provides no merchant value.

**Independent Test**: Can be fully tested by processing a catalog with known disciplines and purchase patterns, then confirming that the resulting relationship suggestions match expected complementary, upgrade, alternative, conflict, and same-collection links.

**Acceptance Scenarios**:

1. **Given** a catalog with classified products and sufficient product evidence, **When** relationship mapping runs, **Then** the system creates suggested links between relevant products with a relationship type and relative strength.
2. **Given** a catalog with co-purchase evidence and product descriptions, **When** the system evaluates candidate relationships, **Then** it prioritizes the most relevant suggestions for each product instead of producing an unfiltered list.
3. **Given** a product with no reliable supporting evidence, **When** relationship mapping runs, **Then** the system leaves the product without a forced relationship rather than creating misleading suggestions.

---

### User Story 2 - Curate Relationship Rules (Priority: P2)

As a merchant admin, I want to review, add, adjust, or remove product relationships so the relationship graph reflects my business knowledge and merchandising intent.

**Why this priority**: Auto-generated suggestions will not be correct for every catalog. Merchant control is required to preserve trust and keep recommendations aligned with merchandising goals.

**Independent Test**: Can be fully tested by editing generated relationships for a sample set of products and confirming that the updated graph reflects the merchant's changes and suppresses superseded automated suggestions.

**Acceptance Scenarios**:

1. **Given** an auto-generated relationship suggestion, **When** the merchant changes its type, weight, or status, **Then** the updated relationship is saved and becomes the active version used by the system.
2. **Given** a product pair with no existing relationship, **When** the merchant creates a new relationship, **Then** the new link is added with the merchant-selected type and priority.
3. **Given** an automated relationship that the merchant rejects, **When** the merchant removes or disables it, **Then** the system does not restore that relationship as active until new evidence or an explicit merchant action warrants it.

---

### User Story 3 - Supply Trusted Relationships to Cart Intelligence (Priority: P3)

As a merchant admin, I want downstream cart experiences to consume the approved relationship graph so customers see relevant suggestions, upgrades, and warnings that match the catalog strategy.

**Why this priority**: The graph only creates value when other cart intelligence features can rely on it as a trustworthy source of product relationships.

**Independent Test**: Can be fully tested by requesting relationships for a product or cart context and confirming that only active, relevant relationships are returned in the expected priority order.

**Acceptance Scenarios**:

1. **Given** a product with approved complementary and upgrade relationships, **When** a downstream consumer requests related products, **Then** the system returns the active relationships ordered by relevance.
2. **Given** a product with a conflict relationship, **When** a downstream consumer requests relationship data for compatibility checks, **Then** the conflict is included as part of the returned relationship set.
3. **Given** a deleted, archived, or unavailable product, **When** downstream consumers request active relationships, **Then** inactive relationships tied to that product are excluded from customer-facing results.

### Edge Cases

- What happens when two evidence sources suggest different relationship types for the same product pair?
- What happens when a merchant-defined relationship conflicts with an automated suggestion for the same product pair?
- How does the system handle products that belong to multiple disciplines and could validly relate to different product sets?
- How does the system handle new catalogs with little or no co-purchase history?
- How does the system handle products that are deleted, archived, or merged after relationships have already been created?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST generate candidate product relationships from available catalog attributes, discipline classification, merchant-defined rules, and purchase co-occurrence data.
- **FR-002**: The system MUST support the relationship types complements, upgrades, alternatives, conflicts, and same-collection.
- **FR-003**: The system MUST store each active relationship with its source, relationship type, and relative strength so merchants and downstream consumers can distinguish stronger links from weaker ones.
- **FR-004**: The system MUST prevent a product from being linked to itself as a relationship.
- **FR-005**: The system MUST avoid creating duplicate active relationships for the same product pair and relationship type.
- **FR-006**: The system MUST allow merchants to create, edit, disable, and remove relationships between products.
- **FR-007**: The system MUST treat merchant-defined relationship changes as higher priority than automated suggestions for the same product pair.
- **FR-008**: The system MUST preserve the active merchant-reviewed relationship graph across subsequent automated remapping runs.
- **FR-009**: The system MUST support products having multiple active relationships when they serve different customer needs or disciplines.
- **FR-010**: The system MUST make active relationships available to downstream cart intelligence features in a form that can be filtered by product, relationship type, and priority.
- **FR-011**: The system MUST exclude inactive, rejected, or product-invalidated relationships from customer-facing downstream results.
- **FR-012**: The system MUST identify relationship candidates with insufficient or conflicting evidence so merchants can review them before relying on them.
- **FR-013**: The system MUST update the active relationship graph when underlying products become unavailable, deleted, or no longer qualify for an active relationship.

### Key Entities *(include if feature involves data)*

- **Product Relationship**: A directed or shared link between two products that describes how they should be considered together, including its type, relative strength, origin, and active status.
- **Relationship Evidence**: The set of signals that justify a relationship, such as catalog context, shared discipline, merchant rules, or purchase behavior.
- **Relationship Override**: A merchant-authored adjustment that creates, changes, suppresses, or replaces an automatically suggested relationship.
- **Relationship View**: The approved set of active relationships returned to downstream cart intelligence consumers for recommendation, conflict detection, or merchandising use.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: During initial mapping, at least 80% of active products that have relevant companion items in the catalog receive one or more suggested relationships.
- **SC-002**: In a merchant review sample of 50 products, an admin can confirm or correct the generated relationship set for the sample in 30 minutes or less.
- **SC-003**: In a curated validation set of representative cart scenarios, at least 90% of expected complementary, upgrade, and conflict relationships are available to downstream consumers.
- **SC-004**: After a catalog change affecting a related product, the active relationship view reflects the product's new eligibility state within one synchronization cycle.

## Assumptions

- Catalog ingestion and discipline classification already provide the product data needed to generate candidate relationships.
- Merchants begin with automated relationship suggestions and only manually adjust exceptions, priority tuning, or catalog-specific business rules.
- Complements and upgrades are treated as directional relationships by default, while alternatives, conflicts, and same-collection relationships are treated as shared relationships unless the merchant specifies otherwise.
- New or low-volume stores may have limited purchase-history evidence, so the feature still needs to produce usable suggestions from catalog and taxonomy signals alone.
- Downstream cart intelligence features consume only the approved active relationship view rather than raw candidate suggestions.