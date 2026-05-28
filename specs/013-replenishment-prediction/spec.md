# Feature Specification: Replenishment Prediction

**Feature Branch**: `013-replenishment-prediction`  
**Created**: 2026-05-26  
**Status**: Draft  
**Input**: User description: "Feature: Replenishment Prediction in prd-cartmind.md"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Surface Timely Replacement Reminders (Priority: P1)

As a returning shopper, I want the cart experience to recognize when previously purchased gear is likely due for replacement so I can restock essential items without manually tracking wear cycles.

**Why this priority**: Timely replenishment is the core outcome of the feature. If the system cannot recognize when a shopper is plausibly due to replace consumable or wear-based items, the feature does not deliver its primary business or customer value.

**Independent Test**: Use returning shopper histories with prior purchases across eligible product categories and verify that the system surfaces replenishment suggestions only when the shopper is within the expected replacement window.

**Acceptance Scenarios**:

1. **Given** a returning shopper previously bought an item whose expected replacement window is approaching, **When** the shopper returns near that window, **Then** the system surfaces a replenishment suggestion for that item.
2. **Given** a shopper purchased multiple eligible items with different replacement cadences, **When** replenishment is evaluated, **Then** the system ranks the items by which ones are most plausibly due soonest.
3. **Given** a shopper has no prior purchases in eligible replenishment categories, **When** replenishment is evaluated, **Then** the system returns no replenishment suggestion rather than inventing one.

---

### User Story 2 - Refresh a Prior Gear Set Quickly (Priority: P1)

As a returning shopper replacing worn gear, I want to quickly re-add the right replacement items or suitable upgrades so I can rebuild my cart with minimal effort.

**Why this priority**: Recognition alone is not enough. The feature must convert a due-for-replacement signal into a low-friction action that helps the shopper restock or upgrade instead of searching through the catalog again.

**Independent Test**: Present replenishment suggestions for a returning shopper and verify that the shopper can rebuild a replacement cart from those suggestions without manually finding each prior item.

**Acceptance Scenarios**:

1. **Given** a prior purchased item is still available for purchase, **When** the shopper accepts the replenishment suggestion, **Then** the system prepares that item for fast re-addition to the cart.
2. **Given** the shopper's prior item is no longer the best available option, **When** replenishment is surfaced, **Then** the system offers a suitable replacement path such as reorder or upgrade rather than a dead-end reminder.
3. **Given** several previously purchased items are due together, **When** the shopper chooses to refresh them, **Then** the system can prepare a grouped replenishment action instead of requiring item-by-item rediscovery.

---

### User Story 3 - Avoid Premature or Irrelevant Reminders (Priority: P2)

As a returning shopper, I want replenishment prompts to appear only when they are credible and relevant so the cart feels helpful instead of pushy or repetitive.

**Why this priority**: Poorly timed replenishment prompts undermine trust and reduce the value of other recommendations. Restraint is necessary for the feature to feel intelligent rather than noisy.

**Independent Test**: Evaluate shoppers with recent purchases, sparse order history, and inconsistent replacement patterns, and verify that the system suppresses or softens replenishment prompts when confidence is low.

**Acceptance Scenarios**:

1. **Given** a shopper recently purchased an item well before its expected replacement window, **When** replenishment is evaluated, **Then** the system does not prompt the shopper to replace it early.
2. **Given** the shopper's purchase history is too sparse or ambiguous to estimate replacement timing confidently, **When** replenishment is evaluated, **Then** the system withholds strong replenishment recommendations.
3. **Given** the shopper has already replenished a suggested item through a recent purchase, **When** the system evaluates replenishment again, **Then** it removes or delays the prior reminder.

---

### User Story 4 - Respect Shopper Replacement Habits (Priority: P2)

As a repeat shopper with established habits, I want replenishment timing and product suggestions to reflect how I actually buy so reminders align with my usage and price preferences.

**Why this priority**: Replenishment becomes materially more useful when it adapts to the shopper's actual cadence and purchasing patterns instead of using only generic category averages.

**Independent Test**: Use shopper histories with distinct replacement cadences or consistent reorder preferences and verify that replenishment timing and item selection adapt to those observed patterns.

**Acceptance Scenarios**:

1. **Given** a shopper repeatedly replaces the same category sooner or later than the default lifecycle window, **When** future replenishment timing is calculated, **Then** the system adjusts toward that shopper's established pattern.
2. **Given** a shopper consistently reorders the same item rather than upgrading, **When** replenishment is suggested, **Then** the same item is prioritized when still appropriate.
3. **Given** a shopper usually trades up within a category after wear-out, **When** replenishment is surfaced, **Then** the system can prioritize a credible upgrade path over a strict reorder.

### Edge Cases

- What happens when a shopper bought multiple units of the same item in one order? The system must account for the larger quantity so it does not assume the standard replacement timing for a single unit.
- What happens when a shopper's purchase history contains a gift purchase or one-off exception? The system must avoid treating a single atypical order as a strong long-term replenishment pattern.
- How does the system handle items that are discontinued, unavailable, or temporarily out of stock? The feature must avoid dead-end reminders and either present a suitable alternative or suppress the action.
- What happens when several eligible items become due at once but some are safety-critical and others are optional? The system must rank the more important replenishment opportunities ahead of lower-priority accessories.
- How does the system handle shoppers whose recent behavior contradicts the default lifecycle window for a category? The system must favor the stronger shopper-specific pattern when sufficient evidence exists.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST identify returning shoppers with prior purchase history that can be evaluated for replenishment opportunities.
- **FR-002**: The system MUST determine whether a previously purchased item is eligible for replenishment based on its product category or lifecycle definition.
- **FR-003**: The system MUST estimate when eligible prior purchases are likely due for replacement using available purchase timing, quantity, and lifecycle information.
- **FR-004**: The system MUST surface replenishment suggestions only when the shopper is within a credible replacement window for the item or category.
- **FR-005**: The system MUST rank replenishment suggestions by likely urgency and shopper relevance when multiple items are eligible at the same time.
- **FR-006**: The system MUST support a fast action that allows the shopper to rebuild a replacement cart from suggested replenishment items.
- **FR-007**: The system MUST support both direct reorder and suitable upgrade paths when presenting replenishment suggestions.
- **FR-008**: The system MUST avoid surfacing replenishment prompts for items that were purchased too recently to be credibly due.
- **FR-009**: The system MUST suppress or soften replenishment prompts when purchase history is too sparse, too inconsistent, or too ambiguous to support a confident prediction.
- **FR-010**: The system MUST update replenishment eligibility after new qualifying purchases so prior suggestions do not persist after the shopper has already restocked.
- **FR-011**: The system MUST account for shopper-specific replacement behavior when repeated history shows a more reliable cadence than the default category lifecycle.
- **FR-012**: The system MUST account for purchase quantity when estimating expected replacement timing for a prior item.
- **FR-013**: The system MUST avoid dead-end replenishment suggestions by excluding unavailable items from direct reorder actions.
- **FR-014**: The system MUST preserve enough structured result detail for cart surfaces to distinguish reorder suggestions, upgrade suggestions, timing confidence, and grouped refresh actions.
- **FR-015**: The system MUST keep replenishment recommendations bounded to eligible product categories and returning-shopper history rather than applying the feature to every cart indiscriminately.

### Key Entities *(include if feature involves data)*

- **Replenishment Candidate**: A prior shopper purchase in a product category that may warrant replacement based on lifecycle expectations, purchase timing, and shopper behavior.
- **Lifecycle Window**: The expected usage period for an eligible product category that defines when replacement is likely to become relevant.
- **Replenishment Signal**: Evidence used to judge replacement timing, such as prior order date, quantity purchased, repeat cadence, or a shopper's prior reorder and upgrade behavior.
- **Refresh Cart Suggestion**: A shopper-facing grouped action that prepares one or more due items for fast reorder or upgrade.
- **Replenishment Recommendation Result**: The structured output that describes what is due, why it is being surfaced, confidence level, and the action type available to the shopper.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In backtesting against historical shopper orders for eligible categories, at least 85% of surfaced replenishment suggestions fall within the intended replacement window defined by merchant review.
- **SC-002**: At least 80% of shoppers in validation scenarios who are shown due replenishment items can rebuild a replacement cart in under 2 minutes.
- **SC-003**: Fewer than 10% of replenishment prompts shown in validation scenarios are judged premature or irrelevant by merchant reviewers.
- **SC-004**: At least 75% of replenishment suggestions shown for repeat shoppers reflect their observed reorder or upgrade behavior when sufficient prior pattern data exists.
- **SC-005**: At least 90% of shoppers with no credible due-for-replacement items receive no replenishment prompt during evaluation.

## Assumptions

- Customer profile and purchase-history summaries from the preceding customer-profile feature are available for returning shoppers before replenishment evaluation runs.
- Merchants define or approve lifecycle expectations for eligible product categories such as wraps, mouthguards, and gloves.
- The initial release focuses on historical purchase-based replenishment for returning shoppers and does not include subscription billing or automatic recurring orders.
- Replenishment actions can reuse existing cart-addition and recommendation surfaces rather than requiring a separate shopper interface.
- The feature may return no replenishment result when the shopper is not due, the catalog lacks a viable replacement path, or confidence is too low.