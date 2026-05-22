# Feature Specification: Kit Completeness Detection

**Feature Branch**: `007-detect-kit-completeness`  
**Created**: 2026-05-22  
**Status**: Draft  
**Input**: User description: "Feature: Kit Completeness Detection in prd-cartmind.md"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Identify The Kit In Progress (Priority: P1)

As a shopper, I want the cart to recognize what type of kit I am building from the items I already selected so I can understand whether I have the essentials covered.

**Why this priority**: The feature has no value unless the cart can correctly interpret the shopper's current intent. Reliable kit identification is the foundation for every missing-item recommendation and completeness score.

**Independent Test**: Can be fully tested by placing products associated with a known discipline or use case in the cart and confirming that the system identifies the intended kit and reports a completeness status without requiring any other feature slice.

**Acceptance Scenarios**:

1. **Given** a cart containing products strongly associated with one discipline, **When** the cart is analyzed, **Then** the system identifies that discipline and maps the cart to the corresponding kit definition.
2. **Given** a cart containing products that belong to more than one discipline, **When** the cart is analyzed, **Then** the system identifies each applicable kit independently instead of forcing the cart into a single discipline.
3. **Given** a cart containing products with weak or incomplete classification data, **When** the cart is analyzed, **Then** the system returns a lower-confidence kit assessment or no kit assessment rather than asserting an incorrect kit.

---

### User Story 2 - Highlight Missing Essentials (Priority: P2)

As a shopper, I want the cart to tell me what important items are still missing from my kit so I do not forget safety gear or other high-value essentials.

**Why this priority**: Once the system understands the shopper's intent, the most important user value is surfacing the next best missing items in a way that improves confidence and cart completeness.

**Independent Test**: Can be fully tested by building partial kits for known disciplines and verifying that the system returns the expected missing items, ordered by importance, with a completeness score that reflects the current cart.

**Acceptance Scenarios**:

1. **Given** a cart that matches part of a known kit, **When** the cart is analyzed, **Then** the system lists the missing kit items in priority order with safety-critical or essential items ranked ahead of optional accessories.
2. **Given** a cart that already includes every required item for a known kit, **When** the cart is analyzed, **Then** the system marks the kit as complete and does not promote missing-item recommendations for that kit.
3. **Given** a cart that partially matches multiple kits, **When** the cart is analyzed, **Then** the system returns missing items for each applicable kit without mixing the priorities across unrelated kits.

---

### User Story 3 - Preserve Merchant Control Over Kit Definitions (Priority: P3)

As a merchant admin, I want kit definitions and item priorities to reflect my merchandising and safety guidance so the cart recommends the right missing products for my store.

**Why this priority**: Merchants need the feature to reflect their catalog structure and domain rules, especially when some items are essential for safety while others are only optional add-ons.

**Independent Test**: Can be fully tested by changing which items are considered part of a kit or adjusting their relative importance, then verifying that later cart analyses use the updated kit composition and priority ordering.

**Acceptance Scenarios**:

1. **Given** a merchant-defined kit with required and optional items, **When** a shopper builds part of that kit, **Then** the completeness score and missing-item list reflect the merchant's definition.
2. **Given** a merchant changes the priority of a kit item, **When** the system analyzes a qualifying cart, **Then** the missing-item ranking reflects the updated priority.

### Edge Cases

- What happens when the cart is empty? The system must return no inferred kit, a neutral completeness result, and no misleading missing-item prompts.
- How does the system handle carts that contain products outside any known kit definition? The system must analyze only the recognized items and avoid treating unrelated products as evidence for a kit.
- What happens when the cart includes substitute or alternative products that satisfy the same kit need? The system must avoid reporting that need as missing if the substitute is recognized as fulfilling it.
- How does the system handle a cart that mixes beginner essentials with advanced or discipline-specific add-ons? The system must still prioritize foundational missing items ahead of optional or advanced recommendations.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST analyze current cart contents to infer the most likely kit or kits the shopper is building.
- **FR-002**: The system MUST use product discipline and category information to determine whether cart items correspond to a known kit definition.
- **FR-003**: The system MUST calculate a completeness score for each inferred kit based on which required and optional kit items are already present in the cart.
- **FR-004**: The system MUST identify missing kit items for each inferred kit and return them in priority order.
- **FR-005**: The system MUST rank missing items so that essential or safety-related items are prioritized ahead of optional accessories.
- **FR-006**: The system MUST support carts that correspond to multiple kits and evaluate each kit independently.
- **FR-007**: The system MUST suppress missing-item recommendations for a kit that is already complete.
- **FR-008**: The system MUST avoid inferring a kit with high confidence when the cart evidence is weak, ambiguous, or incomplete.
- **FR-009**: The system MUST treat recognized substitute or equivalent products as satisfying the corresponding kit need when applicable.
- **FR-010**: The system MUST ignore unrelated cart items that do not contribute meaningful evidence toward a known kit.
- **FR-011**: The system MUST let merchant-defined kit compositions and item priorities determine completeness scoring and missing-item ranking.
- **FR-012**: The system MUST provide enough reasoning context for downstream cart surfaces to explain why a kit was inferred and why a missing item was prioritized.

### Key Entities *(include if feature involves data)*

- **Kit Definition**: A merchant-defined or system-recognized set of products or product roles that together represent a complete setup for a specific discipline or shopping goal.
- **Kit Item Requirement**: A required or optional slot within a kit definition, including its role, relative importance, and the products that can satisfy it.
- **Kit Assessment**: The result of analyzing a cart for one inferred kit, including the identified discipline, completeness score, confidence level, and missing-item list.
- **Missing Kit Recommendation**: A prioritized recommendation for an item or item category that would improve completeness for an inferred kit.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In a representative test set of defined single-discipline carts, the system correctly identifies the intended kit in at least 90% of cases.
- **SC-002**: In controlled partial-kit scenarios, at least 90% of required missing items are surfaced in the returned recommendations.
- **SC-003**: In mixed-discipline cart scenarios, at least 85% of cart analyses separate the applicable kits without incorrectly merging them.
- **SC-004**: Merchant reviewers judge the missing-item priority order as appropriate in at least 85% of tested cart scenarios.
- **SC-005**: For fully complete kits, the system suppresses missing-item prompts in at least 95% of validation scenarios.

## Assumptions

- The existing product knowledge graph already classifies products by discipline and category well enough to support kit inference.
- Merchants either maintain explicit kit definitions or accept sensible default kit structures derived from the catalog and domain rules.
- This feature focuses on identifying kit intent and missing items, not on applying discounts or automatically modifying the cart.
- Shopper-facing surfaces that consume this feature can display completeness scores and missing-item recommendations without requiring a new dedicated workflow.