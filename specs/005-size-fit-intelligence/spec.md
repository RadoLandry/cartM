# Feature Specification: Size & Fit Intelligence

**Feature Branch**: `005-size-fit-intelligence`  
**Created**: 2026-05-22  
**Status**: Draft  
**Input**: User description: "Feature: Size & Fit Intelligence in prd-cartmind.md"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Customer Receives Size Recommendation (Priority: P1)

A shopper is browsing combat sports gear and wants to know what size boxing gloves or shorts to buy. They provide a few body measurements (or weight class / known clothing size) and the system returns a specific size recommendation for the product they are viewing, along with a brief explanation of why that size fits.

**Why this priority**: Size uncertainty is a primary driver of cart abandonment and return rates. Giving accurate, confident size guidance at the point of selection is the highest-value outcome of this feature.

**Independent Test**: A shopper can enter their weight (e.g., 75 kg) and immediately see a recommended glove size (e.g., "14 oz – standard sparring weight for your weight class") without any other features being active.

**Acceptance Scenarios**:

1. **Given** a product with a size chart configured (e.g., boxing gloves), **When** a customer provides their body weight, **Then** the system returns the recommended glove oz size with a brief rationale.
2. **Given** a product with abstract sizes (S/M/L/XL), **When** a customer provides chest/waist measurements, **Then** the system returns the closest matching size.
3. **Given** a customer has a saved size profile from a prior session, **When** they view a new product, **Then** the recommendation is pre-populated without requiring re-entry of measurements.
4. **Given** a product that has no size chart configured, **When** a customer requests a recommendation, **Then** the system clearly states no size guidance is available for this product.

---

### User Story 2 - Cart Size Conflict Warning (Priority: P1)

A shopper adds multiple items to their cart that have incompatible sizes — for example, a Medium rashguard paired with an XL shorts. The system detects this inconsistency and surfaces a clear warning so the shopper can correct it before purchasing.

**Why this priority**: Undetected size conflicts are the single largest driver of size-related returns. Preventing them at the cart stage protects both the merchant's return rate and the customer's satisfaction.

**Independent Test**: Adding two cart items with known incompatible sizes (e.g., child-sized headgear + adult gloves) triggers a visible conflict warning that identifies both items and suggests a correction, even without any recommendation feature enabled.

**Acceptance Scenarios**:

1. **Given** a cart containing a Medium rashguard and an XL pair of shorts, **When** cart analysis runs, **Then** a warning is shown identifying the size mismatch and suggesting the customer align sizes.
2. **Given** a cart containing a children's headgear SKU and an adult glove SKU, **When** cart analysis runs, **Then** an error-level conflict is shown (not just a warning) indicating definite incompatibility.
3. **Given** a cart where all items are in compatible sizes, **When** cart analysis runs, **Then** no conflict is shown.
4. **Given** a conflict warning is shown, **When** the customer corrects the size of one item, **Then** the warning disappears without requiring a page reload.
5. **Given** a single-item cart, **When** cart analysis runs, **Then** no conflict is shown (no cross-product comparison is possible).

---

### User Story 3 - Merchant Configures Size Charts (Priority: P2)

A merchant admin wants to define or override the size charts for their product categories. For example, a merchant knows their rashguards run one size small and wants to encode that knowledge so customers are recommended one size up from the standard chart.

**Why this priority**: Auto-generated size charts cover the general case, but merchant-specific overrides unlock accuracy for brands with non-standard sizing — significantly improving recommendation trust.

**Independent Test**: A merchant can open the admin, navigate to a product category's size chart, modify a size mapping (e.g., shift the rashguard chart by one size), save it, and then verify that the updated recommendation reflects the change.

**Acceptance Scenarios**:

1. **Given** a merchant opens the size intelligence admin, **When** they select a product category, **Then** they see the current size chart (auto-generated or previously saved).
2. **Given** a merchant modifies a size mapping (e.g., "our Medium = industry Large"), **When** they save, **Then** future recommendations for that category use the updated mapping.
3. **Given** a merchant has defined an override, **When** auto-sync re-runs for that product, **Then** the merchant override is preserved and not overwritten.
4. **Given** a merchant wants to revert an override, **When** they click "Reset to default", **Then** the size chart reverts to the auto-generated baseline.

---

### User Story 4 - Size Profile Persists Across Sessions (Priority: P2)

A returning customer who previously provided their measurements or was recommended sizes does not need to re-enter their size data on a subsequent visit. Their size profile is available and powers pre-populated recommendations.

**Why this priority**: Repeat customers are the most valuable segment. Eliminating friction for them improves loyalty and conversion rate on return visits.

**Independent Test**: A logged-in customer who received a size recommendation during a previous session sees their stored size data pre-applied when they view a new product, without being prompted to re-enter measurements.

**Acceptance Scenarios**:

1. **Given** a logged-in customer with a saved size profile, **When** they view a product with a configured size chart, **Then** the recommended size is pre-displayed without any user input.
2. **Given** an anonymous (guest) customer who entered sizes in the current session, **When** they navigate to another product in the same session, **Then** their sizes are retained.
3. **Given** a guest customer, **When** they start a new browser session, **Then** their size data is no longer available (session-scoped only).
4. **Given** a logged-in customer updates their size profile (e.g., changes weight class), **When** they view a product, **Then** the recommendation reflects the updated profile.

---

### User Story 5 - Return Data Improves Recommendations (Priority: P3)

Over time, return data (customers returning items due to wrong size) is fed back into the size intelligence model to adjust future recommendations. A product category that consistently generates size-related returns is flagged and its size chart is adjusted.

**Why this priority**: This closes the feedback loop and makes the system self-improving, but it depends on having sufficient return data history and is not needed for the initial launch.

**Independent Test**: Feeding in a simulated batch of return records (product ID, returned size, reason = "too small") causes the size chart for that product category to shift recommendations by one size up in future queries.

**Acceptance Scenarios**:

1. **Given** a batch of return records is processed for a product category, **When** the adjustment runs, **Then** the size chart for that category reflects the statistical correction.
2. **Given** insufficient return data (fewer than a configurable minimum threshold), **When** adjustment runs, **Then** no change is made to the size chart to avoid noise from small samples.
3. **Given** a merchant has a manual override on a size chart, **When** return data processing runs, **Then** the merchant override takes precedence and is not overwritten.

---

### Edge Cases

- What happens when a product has variants with non-standard size labels (e.g., "One Size", "Junior", "Pro")?
- How does the system handle products that have two independent size dimensions (e.g., shorts with both a waist size and an inseam length)?
- What if a customer's measurements fall exactly between two sizes?
- How does conflict detection behave when one item in the cart has no size chart configured?
- What if a customer's saved size profile conflicts with the size they manually selected (e.g., profile says Medium but they added an XL to cart)?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST map abstract clothing sizes (XS, S, M, L, XL, XXL) to body measurements (chest, waist, height) for each configured product category.
- **FR-002**: The system MUST map sport-specific sizes (boxing glove oz, shorts waist inches) to athlete body attributes (body weight, weight class, waist measurement).
- **FR-003**: The system MUST generate a size recommendation for any product with a configured size chart when given a customer's relevant body attribute(s).
- **FR-004**: The system MUST detect size conflicts between two or more cart items that have cross-product size mappings defined.
- **FR-005**: Size conflicts MUST be classified with a severity level — "warning" (unusual but possible) or "error" (definitively incompatible, e.g., child-scale item paired with adult-scale item).
- **FR-006**: The system MUST allow merchants to create, edit, and reset size charts for product categories via the admin interface.
- **FR-007**: Merchant-defined size chart overrides MUST survive product catalog re-syncs without being overwritten.
- **FR-008**: The system MUST persist a size profile for logged-in customers across sessions.
- **FR-009**: The system MUST maintain a session-scoped size profile for anonymous customers that is discarded when the session ends.
- **FR-010**: The system MUST accept return data (product, returned size, return reason) and adjust size chart recommendations when statistically sufficient data is available.
- **FR-011**: Return-data-driven adjustments MUST NOT overwrite merchant-defined manual overrides.
- **FR-012**: The system MUST surface a size recommendation alongside the rationale (e.g., "recommended for your weight class") to support customer understanding.
- **FR-013**: When no size chart exists for a product, the system MUST communicate clearly that size guidance is unavailable rather than guessing.

### Key Entities

- **SizeChart**: A mapping table for a product category that translates body attributes (weight, chest, waist) to product size labels. Has an auto-generated baseline and an optional merchant override layer.
- **CrossSizeMapping**: A defined relationship between two product categories indicating that size X in category A corresponds to size Y in category B (e.g., "M rashguard = M shorts"). Used for conflict detection.
- **CustomerSizeProfile**: A record of a customer's body attributes and/or known sizes per product category. Scoped to the customer account for logged-in users, or to the current session for guests.
- **SizeConflict**: A detected incompatibility between two cart items, carrying the severity level (warning/error), the conflicting items, and a suggested correction.
- **ReturnRecord**: A data point representing a single return event: the product returned, the size that was returned, and the reason code (e.g., "too small", "too large"). Used as input for size chart adjustment.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The system detects 95% or more of definitive size conflicts (error-level) across the predefined conflict scenario test suite.
- **SC-002**: Size recommendations align with the correct size in 85% or more of cases when validated against a human-labeled test set of customer measurement → correct size mappings.
- **SC-003**: Size-related return rates for merchants using the feature decrease by 30% or more compared to the baseline period (as tracked by return reason codes).
- **SC-004**: A merchant can create or update a size chart override in under 2 minutes using the admin interface.
- **SC-005**: Size recommendations and conflict checks complete within 200 milliseconds for any cart state, as experienced by the customer.
- **SC-006**: 80% or more of returning customers with a saved size profile receive pre-populated recommendations without needing to re-enter measurements.

## Assumptions

- Product size variants are available in the catalog as structured variant option data (e.g., option name = "Size", value = "M") rather than encoded only in free-text descriptions.
- Sport-specific size conversions (glove oz to weight class) follow widely accepted industry standards (e.g., amateur boxing weight class charts) as the auto-generated baseline.
- Return data is available as a structured feed or webhook from Shopify Order data (tagged with reason codes); if no return integration is configured, Story 5 is deferred.
- Cross-product size mappings (e.g., rashguard M = shorts M) are initially seeded manually or via LLM analysis of the catalog; the system does not auto-derive them solely from co-purchase data at launch.
- The size intelligence feature is scoped to physical apparel and equipment products (gloves, shorts, rashguards, headgear). Digital products and accessories without size variants are out of scope.
- Size conflict detection covers pairs of items; detection across three or more items simultaneously is desirable but not required for the initial release.
- Merchants are responsible for the accuracy of their size chart overrides; the system does not validate override values against external standards.
