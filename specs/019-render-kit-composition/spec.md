# Feature Specification: Kit Composition Renderer

**Feature Branch**: `019-render-kit-composition`  
**Created**: 2026-06-02  
**Status**: Draft  
**Input**: User description: "Feature: Kit Composition Renderer in prd-cartmind.md"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - View Complete Kit Preview (Priority: P1)

A shopper can see a single combined preview of all items currently in their cart so they understand how the full kit looks together before checkout.

**Why this priority**: This is the core value of the feature and directly reduces uncertainty about visual coherence, which is a known cause of hesitation and abandonment.

**Independent Test**: Can be fully tested by adding multiple compatible items to cart and confirming that one cohesive preview is displayed representing the full set of items.

**Acceptance Scenarios**:

1. **Given** a cart with multiple eligible items, **When** the shopper opens the kit preview, **Then** the system shows one combined kit image representing all cart items together.
2. **Given** the shopper changes cart contents, **When** the kit preview is refreshed, **Then** the combined image updates to reflect the current cart.

---

### User Story 2 - Receive Discipline-Appropriate Layout (Priority: P1)

A shopper sees the kit preview organized in a layout that matches the inferred discipline so the composition feels intuitive and relevant.

**Why this priority**: Discipline-aligned presentation improves comprehension and trust by showing products in expected context rather than a random collage.

**Independent Test**: Can be fully tested by comparing previews for different discipline-specific carts and verifying each preview follows the expected composition style for that discipline.

**Acceptance Scenarios**:

1. **Given** a cart inferred as a single discipline, **When** the preview is generated, **Then** the arrangement follows that discipline’s standard visual composition.
2. **Given** a cart with mixed disciplines, **When** the preview is generated, **Then** the system applies a default mixed-kit composition and indicates that mixed context is being shown.

---

### User Story 3 - Reuse Existing Preview Quickly (Priority: P2)

A shopper gets a fast response when reopening an unchanged cart preview because previously generated output is reused.

**Why this priority**: Fast repeat access improves perceived responsiveness and encourages continued use of the preview during comparison and decision-making.

**Independent Test**: Can be fully tested by opening the preview twice without cart changes and verifying the second render is returned significantly faster than the initial generation.

**Acceptance Scenarios**:

1. **Given** an unchanged cart with an existing preview, **When** the shopper reopens preview, **Then** the system returns the previously generated result without full regeneration.
2. **Given** the cart has changed since the last preview, **When** the shopper reopens preview, **Then** the system generates and returns a new preview matching the updated cart.

### Edge Cases

- What happens when one or more cart items have missing, inaccessible, or invalid source imagery?
- How does the system handle a cart containing unsupported product types that cannot be positioned in the kit composition?
- What happens when the cart is empty at preview request time?
- How does the system respond when generation fails partway through due to a transient processing issue?
- How does the system behave when two visually identical products differ only by minor variant metadata?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST generate a single combined kit preview representing all eligible cart items together.
- **FR-002**: System MUST use the shopper’s current cart state as the source of truth for preview composition.
- **FR-003**: System MUST organize composed items using a discipline-appropriate layout when discipline context can be inferred.
- **FR-004**: System MUST apply a deterministic fallback layout when discipline context is ambiguous or mixed.
- **FR-005**: System MUST return a shopper-visible preview format suitable for cart and chat surfaces.
- **FR-006**: System MUST reuse an existing preview when the cart state is unchanged.
- **FR-007**: System MUST regenerate the preview when cart composition or selected variants change.
- **FR-008**: System MUST exclude unsupported or invalid items from composition and report which items were omitted.
- **FR-009**: System MUST provide a clear fallback response when preview generation cannot be completed.
- **FR-010**: System MUST maintain visual consistency so repeated requests for the same cart state produce equivalent composition output.
- **FR-011**: System MUST support both desktop and mobile storefront contexts where the preview is surfaced.

### Key Entities *(include if feature involves data)*

- **Kit Preview Request**: A request tied to a specific cart snapshot and context needed to produce a composed visual output.
- **Cart Snapshot**: The normalized set of cart items, variants, and quantities used as preview input.
- **Layout Profile**: The composition template selected based on inferred discipline or fallback rules.
- **Composed Preview Asset**: The generated output artifact representing the full kit view.
- **Preview Reuse Record**: A lookup record linking a cart snapshot signature to an existing composed preview asset.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: At least 95% of preview requests for carts with valid imagery return a composed kit preview on the first attempt.
- **SC-002**: At least 90% of unchanged-cart repeat requests return an existing preview in under 1.0 second.
- **SC-003**: At least 95% of preview outputs are judged by internal QA as accurately reflecting current cart contents.
- **SC-004**: Fewer than 2% of preview requests result in a shopper-facing error without a usable fallback response.
- **SC-005**: Shoppers who open the kit preview complete their cart decision (proceed to checkout or continue editing) within 2 minutes in at least 75% of sessions.

## Assumptions

- The storefront already provides access to product imagery for most purchasable variants in cart.
- Existing cart intelligence can provide discipline context for layout selection when available.
- Preview generation is limited to cart contexts and does not include full product catalog browsing use cases in v1.
- Preview outputs may omit unsupported items while still delivering value, as long as omissions are clearly communicated.
- Merchant-specific visual branding overlays are out of scope for the initial release of this feature.
