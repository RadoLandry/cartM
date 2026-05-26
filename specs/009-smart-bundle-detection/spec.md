# Feature Specification: Smart Bundle Detection

**Feature Branch**: `009-smart-bundle-detection`  
**Created**: 2026-05-26  
**Status**: Draft  
**Input**: User description: "Feature: Smart Bundle Detection in prd-cartmind.md"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Recognize Bundle Opportunities In The Cart (Priority: P1)

As a shopper, I want the cart to recognize when the items I selected already match or nearly match a meaningful bundle so I can understand the value available to me without manually piecing it together.

**Why this priority**: The feature only delivers value if it can reliably determine when a cart aligns with a defined bundle. Accurate bundle recognition is the foundation for any completion prompt, savings message, or discount eligibility.

**Independent Test**: Can be fully tested by placing products and quantities from a known bundle into the cart and confirming that the system identifies full and near-complete bundle matches without relying on any other recommendation feature.

**Acceptance Scenarios**:

1. **Given** a cart containing all required items for a defined bundle, **When** the cart is analyzed, **Then** the system identifies the bundle as qualified and returns the associated benefit information.
2. **Given** a cart containing most, but not all, required items for a defined bundle, **When** the cart is analyzed, **Then** the system identifies the bundle as nearly complete and reports which qualifying items are still missing.
3. **Given** a cart containing items that do not map to any active bundle rule, **When** the cart is analyzed, **Then** the system returns no bundle match rather than manufacturing an offer.

---

### User Story 2 - Encourage High-Intent Bundle Completion (Priority: P2)

As a shopper, I want the cart to show the most relevant next item or action to complete a bundle so I can unlock the offer with minimal friction.

**Why this priority**: Once a bundle opportunity is recognized, the next user-facing value is helping the shopper finish the bundle in a way that feels useful and context-aware rather than generic or pushy.

**Independent Test**: Can be fully tested by creating carts that are close to qualifying for a bundle and verifying that the system returns the missing item set, completion threshold, and a clear explanation of the value unlocked by completion.

**Acceptance Scenarios**:

1. **Given** a cart that is one required item short of a defined bundle, **When** the cart is analyzed, **Then** the system highlights the missing item and the benefit the shopper would receive by adding it.
2. **Given** a cart that is missing multiple items from a bundle, **When** the cart is analyzed, **Then** the system prioritizes the most relevant completion path instead of overwhelming the shopper with redundant prompts.
3. **Given** a cart that already qualifies for a bundle, **When** the cart is analyzed, **Then** the system emphasizes the qualified offer and suppresses completion prompts for that same bundle.

---

### User Story 3 - Honor Merchant Bundle Rules And Priorities (Priority: P3)

As a merchant admin, I want bundle detection to follow the bundle definitions and priorities I configured so the cart promotes offers that match my merchandising strategy.

**Why this priority**: Merchants need confidence that bundle messaging reflects deliberate commercial rules, especially when multiple offers overlap or when only certain product combinations should trigger a benefit.

**Independent Test**: Can be fully tested by changing bundle definitions, eligibility thresholds, or offer priorities and verifying that later cart analyses reflect the updated rules without manual intervention in shopper sessions.

**Acceptance Scenarios**:

1. **Given** an active merchant-defined bundle with required items, optional items, and a stated benefit, **When** a shopper cart is analyzed, **Then** the system evaluates the cart against that exact definition.
2. **Given** multiple active bundles that could apply to the same cart, **When** the cart is analyzed, **Then** the system returns the bundle opportunities in merchant-defined or rule-defined priority order.
3. **Given** a bundle rule that has been deactivated or changed, **When** the cart is analyzed after that update, **Then** the system stops using the old definition and uses the current active rule set.

### Edge Cases

- What happens when the cart contains overlapping items that could satisfy more than one bundle? The system must identify each legitimate opportunity while preventing duplicate or conflicting shopper messages for the same items.
- How does the system handle quantity-based bundles when the shopper has some, but not all, required quantities? The system must recognize partial progress and report the remaining quantities needed to qualify.
- What happens when a cart qualifies for multiple bundles but they compete for the same items? The system must present the highest-priority or highest-value applicable opportunity clearly and avoid implying incompatible offers can all be claimed simultaneously.
- How does the system handle inactive, expired, or incomplete bundle rules? The system must ignore them and avoid surfacing unreliable savings messages.
- What happens when a bundle is nearly complete but the missing item is unavailable for purchase? The system must avoid presenting that completion path as an active opportunity.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST analyze current cart contents against active bundle definitions to determine whether the cart fully qualifies for any bundle.
- **FR-002**: The system MUST identify when a cart is near qualification for a bundle and report the missing required items or quantities.
- **FR-003**: The system MUST use merchant-defined bundle composition rules as the authoritative source for bundle eligibility.
- **FR-004**: The system MUST return the benefit associated with each detected bundle opportunity, including whether the benefit is already qualified or still unlockable through completion.
- **FR-005**: The system MUST support bundles that require specific quantities of items, not just item presence.
- **FR-006**: The system MUST evaluate carts against multiple active bundles in the same analysis.
- **FR-007**: The system MUST prioritize returned bundle opportunities so downstream cart surfaces can present the most relevant offer first.
- **FR-008**: The system MUST suppress bundle suggestions when the cart does not meaningfully align with any active bundle.
- **FR-009**: The system MUST avoid presenting completion prompts for a bundle that is already fully qualified.
- **FR-010**: The system MUST ignore inactive, expired, or otherwise invalid bundle definitions during analysis.
- **FR-011**: The system MUST prevent misleading bundle messaging when overlapping bundles compete for the same qualifying cart items.
- **FR-012**: The system MUST provide enough explanation for each bundle opportunity that shopper-facing surfaces can tell the shopper why the bundle was detected and what action, if any, remains.
- **FR-013**: The system MUST avoid promoting a bundle completion path when the required remaining items are not currently purchasable.
- **FR-014**: The system MUST reflect merchant updates to bundle rules in subsequent cart analyses without requiring shopper-side reconfiguration.

### Key Entities *(include if feature involves data)*

- **Bundle Definition**: A merchant-configured commercial offer that specifies the products or product roles, required quantities, eligibility conditions, and shopper benefit for a bundle.
- **Bundle Match**: The result of comparing one cart against one bundle definition, including qualification status, matched items, missing items, and priority.
- **Bundle Opportunity**: A shopper-facing summary of a full or near-complete bundle that can be surfaced in the cart with messaging about value and next steps.
- **Bundle Benefit**: The reward a shopper receives when a bundle qualifies, such as a price reduction or other promotional value.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In a representative validation set of defined bundle carts, the system correctly identifies full bundle qualification in at least 95% of cases.
- **SC-002**: In controlled near-complete bundle scenarios, the system correctly identifies the missing item or quantity needed to qualify in at least 90% of cases.
- **SC-003**: In carts that do not correspond to any active bundle, the system suppresses irrelevant bundle offers in at least 95% of validation scenarios.
- **SC-004**: Merchant reviewers judge the returned bundle priority order and completion prompts as appropriate in at least 85% of tested overlapping-bundle scenarios.
- **SC-005**: For qualified bundles, shopper-facing surfaces can display the unlocked offer without additional interpretation in at least 95% of integration test scenarios.

## Assumptions

- Merchants maintain active bundle definitions with enough detail to identify required items, quantities, and shopper benefit.
- Existing product and relationship data is sufficient to relate cart items to bundle definitions without requiring a separate catalog onboarding flow for this feature.
- This feature focuses on detecting and describing bundle opportunities in the cart; broader promotion strategy outside the cart remains out of scope.
- Shopper-facing cart surfaces can render qualified and near-complete bundle states using the information returned by this feature.