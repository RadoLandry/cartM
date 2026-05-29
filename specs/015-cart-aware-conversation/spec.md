# Feature Specification: Cart-Aware Conversation

**Feature Branch**: `[015-cart-aware-conversation]`  
**Created**: 2026-05-29  
**Status**: Draft  
**Input**: User description: "Feature: Cart-Aware Conversation in prd-cartmind.md"

## User Scenarios & Testing *(mandatory)*

<!--
  IMPORTANT: User stories should be PRIORITIZED as user journeys ordered by importance.
  Each user story/journey must be INDEPENDENTLY TESTABLE - meaning if you implement just ONE of them,
  you should still have a viable MVP (Minimum Viable Product) that delivers value.
  
  Assign priorities (P1, P2, P3, etc.) to each story, where P1 is the most critical.
  Think of each story as a standalone slice of functionality that can be:
  - Developed independently
  - Tested independently
  - Deployed independently
  - Demonstrated to users independently
-->

### User Story 1 - Get Cart-Specific Advice (Priority: P1)

A shopper opens the cart conversation panel and asks whether their current cart is appropriate for their intended discipline and use, then receives guidance that references the exact products and selected options already in the cart.

**Why this priority**: This is the core value of the feature. Without cart-specific advice, the conversation behaves like generic chat and does not reduce uncertainty at checkout.

**Independent Test**: Can be fully tested by providing a seeded cart and submitting natural-language questions, then verifying responses include relevant cart items and actionable next steps.

**Acceptance Scenarios**:

1. **Given** a cart with multiple items and selected variants, **When** the shopper asks for an audit of the cart, **Then** the response references the actual cart items and highlights any notable gaps or concerns.
2. **Given** a shopper asks a follow-up question in the same session, **When** the cart has not changed, **Then** the response remains consistent with prior advice and current cart context.

---

### User Story 2 - Receive Actionable Cart Changes (Priority: P2)

A shopper asks how to improve the cart (for safety, completeness, or budget fit) and receives concrete recommendations such as add, remove, swap, or resize suggestions tied to current cart contents.

**Why this priority**: Specific actions convert advice into buying progress and directly support higher completion and confidence.

**Independent Test**: Can be tested independently by asking optimization questions and validating that suggested actions are specific, context-appropriate, and feasible from the current cart state.

**Acceptance Scenarios**:

1. **Given** a partially complete discipline kit in cart, **When** the shopper asks what is missing, **Then** the system returns prioritized missing items with a clear rationale.
2. **Given** the cart is above the shopper's stated budget, **When** the shopper asks for budget optimization, **Then** the system suggests itemized changes that reduce total cost while preserving essential items.

---

### User Story 3 - Keep Guidance Current as Cart Changes (Priority: P3)

As the shopper updates quantities, sizes, or products during checkout intent, subsequent conversation answers automatically reflect the latest cart state.

**Why this priority**: This preserves trust in the assistant and prevents stale advice, but it is secondary to initially delivering cart-aware guidance.

**Independent Test**: Can be tested independently by changing cart contents between prompts and verifying that later responses use the updated state.

**Acceptance Scenarios**:

1. **Given** the shopper modifies cart items mid-conversation, **When** they ask another cart question, **Then** the response reflects the revised cart rather than prior state.
2. **Given** the shopper removes all items, **When** they ask for recommendations, **Then** the system clearly explains that cart-specific advice requires at least one item and provides a helpful next step.

---

### Edge Cases

- Shopper asks for cart advice when cart is empty.
- Shopper provides ambiguous intent (for example, no discipline or use case stated) and cart contains multi-discipline items.
- Cart changes externally during an active conversation session (another tab or device updates the cart).
- Shopper asks questions unrelated to the cart context.
- Product or variant referenced in existing conversation is no longer available at response time.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST include the latest cart context on every conversation turn before generating a response.
- **FR-002**: The system MUST generate responses that reference relevant cart items by shopper-visible names when giving cart-specific guidance.
- **FR-003**: The system MUST provide actionable recommendations in structured categories: keep, add, remove, swap, or size-adjust.
- **FR-004**: The system MUST prioritize safety- and compatibility-related guidance above optional upsell-oriented suggestions.
- **FR-005**: The system MUST update conversation guidance after cart changes so subsequent responses are based on current cart state.
- **FR-006**: The system MUST handle empty-cart requests gracefully by returning a clear explanation and a next action instead of generic advice.
- **FR-007**: The system MUST preserve in-session conversational continuity so follow-up questions can reference prior shopper intent.
- **FR-008**: The system MUST return a user-facing fallback response when cart analysis cannot be completed, without exposing internal error details.
- **FR-009**: The system MUST avoid recommending products that are unavailable to the shopper at response time.
- **FR-010**: The system MUST provide recommendation reasoning in plain shopper language for each high-priority suggestion.

### Key Entities *(include if feature involves data)*

- **Conversation Turn Context**: A single request context containing cart snapshot, shopper question, relevant shopper profile signals, and prior in-session thread summary.
- **Cart Snapshot**: Shopper-visible cart state at a point in time, including items, selected options, quantities, and subtotal.
- **Guidance Recommendation**: A structured recommendation item containing recommendation type, priority, rationale, and expected shopper outcome.
- **Conversation Session**: A bounded shopper interaction window that links sequential turns for continuity and follow-up understanding.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: At least 90% of cart-specific questions include references to one or more items currently in the shopper's cart.
- **SC-002**: At least 85% of shoppers who ask for cart help receive at least one actionable recommendation they can immediately apply.
- **SC-003**: In moderated validation sessions, at least 80% of shoppers rate the advice as relevant to their current cart and intent.
- **SC-004**: For sessions using cart-aware conversation, cart abandonment is reduced by at least 10% relative to comparable sessions without this feature.

## Assumptions

- The feature is intended for storefront shoppers in the cart context and does not include merchant admin configuration workflows.
- Initial release scope focuses on cart-aware advice and recommendations, not full long-term conversation history across separate shopping sessions.
- Existing product intelligence inputs (classification, relationships, sizing, and availability) are available for recommendation reasoning.
- The conversation experience is available on both cart drawer and cart page surfaces where supported by the active store theme.
