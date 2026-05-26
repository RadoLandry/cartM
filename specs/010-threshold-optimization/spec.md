# Feature Specification: Threshold Optimization

**Feature Branch**: `010-optimize-threshold`  
**Created**: 2026-05-26  
**Status**: Draft  
**Input**: User description: "Feature: Threshold Optimization in prd-cartmind.md"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Shopper Gets Relevant Threshold Suggestions (Priority: P1)

As a shopper who is close to earning a cart benefit, I want the cart to suggest the most relevant item to add so I can reach the threshold without derailing what I am already buying.

**Why this priority**: This is the core outcome of the feature. If the suggestions are not relevant and actionable when the shopper is near a threshold, the feature does not improve conversion or cart value.

**Independent Test**: Create carts that are just below an active threshold and verify that the system returns up to three add-on suggestions whose price fits the remaining gap and whose relevance matches the existing cart context.

**Acceptance Scenarios**:

1. **Given** a shopper cart that is below an active threshold by a small amount, **When** threshold optimization runs, **Then** the system returns the top relevant item suggestions that can reasonably close the gap.
2. **Given** a shopper cart centered on a specific discipline or use case, **When** threshold optimization returns suggestions, **Then** the suggestions complement the current cart instead of introducing unrelated products.
3. **Given** multiple eligible products can close the remaining gap, **When** the system ranks them, **Then** the highest-ranked suggestion is the one with the strongest contextual relevance to the cart.
4. **Given** the shopper adds one of the suggested products and reaches the threshold, **When** threshold optimization runs again, **Then** the previous threshold-closing suggestion is no longer shown.

---

### User Story 2 - Shopper Receives Clear Value Reasoning (Priority: P1)

As a shopper, I want each suggestion to explain why it is being recommended so I can quickly judge whether the extra item is worth adding.

**Why this priority**: Threshold suggestions are persuasive only when the shopper understands both the threshold benefit and why the suggested item fits their current purchase intent.

**Independent Test**: Trigger a threshold recommendation and verify that each returned suggestion includes a short reason tied to both the cart context and the threshold benefit.

**Acceptance Scenarios**:

1. **Given** a cart that qualifies for threshold suggestions, **When** the system returns a recommendation, **Then** it states what shopper benefit the added item helps unlock.
2. **Given** a suggested product that complements the current cart, **When** the recommendation is shown, **Then** it explains the relationship in shopper-friendly language.
3. **Given** multiple suggestions are returned, **When** the shopper reviews them, **Then** each suggestion includes distinct reasoning that clarifies why it is relevant.

---

### User Story 3 - Low-Relevance Carts Stay Quiet (Priority: P2)

As a shopper, I want the cart to avoid pushing filler products when there is no genuinely relevant way to reach a threshold so the experience stays helpful instead of feeling manipulative.

**Why this priority**: Trust depends on restraint. The feature must avoid trading short-term threshold completion for low-quality recommendations that feel random or spammy.

**Independent Test**: Analyze carts that are already above the threshold, far below the threshold, or missing any relevant add-on items and verify that the system suppresses recommendations or returns none.

**Acceptance Scenarios**:

1. **Given** a cart that already qualifies for the relevant benefit, **When** threshold optimization runs, **Then** the system returns no threshold-closing suggestion for that benefit.
2. **Given** a cart whose remaining gap is too large to close with a sensible add-on, **When** threshold optimization runs, **Then** the system does not recommend unrelated filler items.
3. **Given** a cart with no in-stock products that are both relevant and gap-appropriate, **When** threshold optimization runs, **Then** the system returns no recommendation instead of lowering its relevance standard.
4. **Given** a shopper with a focused replacement purchase, **When** the current cart signals low appetite for add-ons, **Then** the system keeps recommendations minimal and contextually justified.

---

### User Story 4 - Merchant Threshold Rules Are Respected (Priority: P2)

As a merchant admin, I want threshold suggestions to follow my configured spending rules and product relationships so the feature reinforces my merchandising strategy rather than overriding it.

**Why this priority**: Merchants need confidence that the feature drives the thresholds and product pairings they actually want to promote.

**Independent Test**: Configure threshold rules and product relevance relationships, then verify that suggestions reflect the active threshold targets, exclude disallowed products, and change when the rules change.

**Acceptance Scenarios**:

1. **Given** a merchant-defined spending threshold, **When** a shopper cart approaches it, **Then** the system evaluates suggestions against that active threshold.
2. **Given** a merchant has identified which products complement a category or discipline, **When** threshold optimization ranks candidates, **Then** those relationships influence which products are suggested.
3. **Given** a merchant excludes a product from threshold recommendations, **When** the system evaluates candidates, **Then** the excluded product is not returned.
4. **Given** a merchant changes a threshold value or relevance rule, **When** threshold optimization runs on a later cart, **Then** the updated rule is reflected in the results.

### Edge Cases

- What happens when a cart is close to more than one threshold at the same time? The system must prioritize the next most meaningful threshold and avoid showing conflicting or redundant recommendation sets.
- What happens when the exact gap can only be closed by products that would overfill the threshold? The system may suggest a slightly higher-priced item only when it remains contextually relevant and still represents a reasonable shopper decision.
- How does the system handle mixed-discipline carts? The system must prioritize suggestions that fit the strongest cart intent or clearly support more than one item already in the cart.
- What happens when the only relevant candidate is already in the cart? The system must not suggest duplicating it unless duplicate purchase is clearly valid for that product type.
- How does the system handle out-of-stock or unavailable products near the ideal price point? The system must skip unavailable candidates rather than using them to justify a threshold suggestion.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST evaluate active shopper-benefit thresholds against the current cart subtotal.
- **FR-002**: The system MUST determine the remaining amount needed to reach the nearest relevant threshold that the shopper has not yet achieved.
- **FR-003**: The system MUST only generate threshold-closing suggestions when the shopper is within an actionable range of an active threshold.
- **FR-004**: The system MUST rank candidate products using contextual relevance to the existing cart before considering price fit alone.
- **FR-005**: The system MUST prefer products that complement the shopper's current discipline, category mix, or purchase intent.
- **FR-006**: The system MUST return between one and three ranked product suggestions when qualifying candidates exist.
- **FR-007**: The system MUST include shopper-readable reasoning for each suggestion, covering both the threshold benefit and the product's contextual fit.
- **FR-008**: The system MUST NOT recommend products that are unavailable for purchase.
- **FR-009**: The system MUST NOT recommend excluded or disallowed products defined by merchant rules.
- **FR-010**: The system MUST suppress threshold suggestions when the cart has already reached the applicable threshold.
- **FR-011**: The system MUST suppress threshold suggestions when no candidate meets the minimum relevance standard, even if lower-quality products could close the gap.
- **FR-012**: The system MUST avoid suggesting duplicate products that are already in the cart unless duplicate purchase is explicitly permitted for that product type.
- **FR-013**: The system MUST update its results after any cart subtotal or line-item change so outdated threshold suggestions are removed.
- **FR-014**: Merchant-defined threshold values and relevance rules MUST take precedence over default suggestion behavior.
- **FR-015**: The system MUST provide enough structured result detail for downstream cart surfaces to display the threshold target, remaining gap, ranked suggestions, and reasoning.
- **FR-016**: The system MUST handle carts that qualify for more than one threshold by selecting and returning the most relevant threshold opportunity without creating contradictory recommendation messages.

### Key Entities *(include if feature involves data)*

- **Threshold Rule**: A merchant-defined cart benefit trigger, including the spend target, benefit description, and any eligibility boundaries that determine when optimization should activate.
- **Threshold Gap**: The remaining spend amount between the current cart subtotal and the next relevant threshold the shopper has not yet reached.
- **Threshold Recommendation Candidate**: A purchasable product evaluated for its ability to help close the gap while remaining contextually relevant to the current cart.
- **Threshold Optimization Result**: The shopper-facing output containing the chosen threshold opportunity, remaining gap, ranked suggestions, and explanation for each suggestion.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In the threshold-optimization validation suite, at least 90% of returned suggestions are judged by merchant reviewers as contextually relevant to the cart.
- **SC-002**: At least 95% of validation scenarios that lack a genuinely relevant add-on return no threshold recommendation rather than a filler suggestion.
- **SC-003**: At least 80% of shoppers in usability testing can correctly explain why the top suggestion was shown and what benefit it helps unlock.
- **SC-004**: At least 20% of eligible near-threshold carts in pilot evaluation add one of the returned suggestions or otherwise reach the highlighted threshold.
- **SC-005**: Eligible shoppers see refreshed threshold recommendations quickly enough that at least 95% of cart updates display the new result within 1 second.

## Assumptions

- Merchants already define the threshold benefits that matter for their storefront, such as free shipping or spend-based discounts, and this feature uses those configured thresholds rather than inventing new ones.
- Existing product relationship and cart-context data are available to judge whether a candidate product is a meaningful complement to the current cart.
- The initial release focuses on product-addition recommendations and explanatory messaging; automatic cart changes and negotiated discount logic remain outside this specification.
- Threshold optimization is evaluated within a single store and currency context at a time.
- The feature is allowed to return no recommendation when relevance standards are not met, even if the shopper is numerically close to a threshold.