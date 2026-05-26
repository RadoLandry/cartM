# Feature Specification: Size Conflict Detection

**Feature Branch**: `008-size-conflict-detection`  
**Created**: 2026-05-26  
**Status**: Draft  
**Input**: User description: "Feature: Size Conflict Detection in prd-cartmind.md"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Shopper Is Warned About Incompatible Sizes (Priority: P1)

As a shopper, I want the cart to detect when the sizes I selected do not make sense together so I can fix mistakes before checkout.

**Why this priority**: Detecting mismatches is the core value of the feature. Without reliable conflict detection, the feature does not reduce returns or improve shopper confidence.

**Independent Test**: Build carts with known incompatible size combinations and verify that the system flags the conflict, identifies the affected items, and assigns the correct severity.

**Acceptance Scenarios**:

1. **Given** a cart containing two items with known incompatible sizes, **When** cart analysis runs, **Then** the system returns a conflict identifying both items and the incompatible size combination.
2. **Given** a cart containing a definite mismatch such as child-sized protective gear paired with adult-sized equipment, **When** cart analysis runs, **Then** the system classifies the result as an error-level conflict.
3. **Given** a cart containing a less certain but unusual combination such as a Medium apparel item paired with an XL related apparel item, **When** cart analysis runs, **Then** the system classifies the result as a warning-level conflict.
4. **Given** a cart whose sized items are compatible, **When** cart analysis runs, **Then** the system returns no size conflict.

---

### User Story 2 - Shopper Receives Actionable Correction Guidance (Priority: P1)

As a shopper, I want each detected size conflict to include a practical explanation and a suggested next step so I know how to resolve the issue quickly.

**Why this priority**: A warning without guidance still leaves the customer uncertain. The feature needs to improve decision quality, not just announce a problem.

**Independent Test**: Trigger a known conflict and confirm that the returned result explains the mismatch in plain language and includes at least one correction path tied to the cart items involved.

**Acceptance Scenarios**:

1. **Given** a detected size conflict, **When** the result is shown to the shopper, **Then** it includes a short explanation of why the selected sizes are inconsistent.
2. **Given** a detected size conflict with a clear preferred resolution, **When** the result is returned, **Then** it suggests the most appropriate size or item adjustment for one or more affected cart lines.
3. **Given** a detected size conflict where no confident correction can be inferred, **When** the result is returned, **Then** it clearly explains that a mismatch exists without guessing a specific replacement.
4. **Given** a shopper updates the cart to resolve the mismatch, **When** cart analysis reruns, **Then** the prior conflict is no longer returned.

---

### User Story 3 - Merchant Controls Compatibility Rules (Priority: P2)

As a merchant admin, I want the system to respect my size mappings and compatibility guidance so conflict detection reflects my catalog and sizing policies.

**Why this priority**: Detection accuracy depends on domain-specific size rules. Merchant control is necessary to keep the feature trustworthy across brands and product types.

**Independent Test**: Update a size compatibility mapping or category rule in the admin workflow, re-run analysis on the same cart, and confirm the conflict outcome reflects the updated rule.

**Acceptance Scenarios**:

1. **Given** a merchant-defined compatibility rule between related product categories, **When** a shopper adds items that violate that rule, **Then** the system uses the merchant rule when classifying the conflict.
2. **Given** a merchant override that marks a size pairing as acceptable, **When** cart analysis runs for that pairing, **Then** the system does not flag it as a conflict.
3. **Given** a catalog sync or product update occurs after a merchant has adjusted a compatibility rule, **When** conflict detection runs later, **Then** the merchant-defined rule remains in effect.

---

### User Story 4 - Ambiguous Carts Stay Low-Noise (Priority: P3)

As a shopper, I want the cart to stay quiet when there is not enough evidence to judge a mismatch so I am not distracted by low-confidence warnings.

**Why this priority**: False positives erode trust quickly. The system needs to distinguish between missing information and genuine conflict.

**Independent Test**: Analyze carts containing products without usable size data or without a defined cross-product mapping and verify that the system does not fabricate a conflict.

**Acceptance Scenarios**:

1. **Given** a cart containing only one sized product, **When** cart analysis runs, **Then** the system returns no cross-product size conflict.
2. **Given** a cart containing items that do not have compatible size metadata or mapping rules, **When** cart analysis runs, **Then** the system returns no conflict rather than inferring one from incomplete data.
3. **Given** a cart containing both sized and non-sized items, **When** cart analysis runs, **Then** the non-sized items do not create or amplify a size conflict.

### Edge Cases

- What happens when a cart contains multiple overlapping conflicts across more than two items? The system must report each distinct conflict clearly without collapsing unrelated mismatches into a single vague warning.
- How does the system handle products with non-standard size labels such as `Junior`, `Regular`, `Tall`, or `One Size`? The system must only evaluate them when a defined normalization or compatibility rule exists.
- What happens when the shopper intentionally selects mixed sizes that are valid for the catalog, such as compression tops and shorts with different fit preferences? The system must avoid flagging a conflict when merchant rules permit the combination.
- How does the system handle weight-dependent sizes such as glove ounce selections when the cart lacks enough evidence to judge suitability? The system must avoid assigning an error unless the mismatch is definitively incompatible.
- What happens when one of the products in a detected conflict is out of stock in the suggested corrective size? The system must still describe the conflict, but it must not present an unavailable size as the preferred correction.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST analyze carts containing two or more size-relevant items for cross-item size compatibility.
- **FR-002**: The system MUST compare cart selections using available size mappings, product category rules, and merchant-defined compatibility guidance.
- **FR-003**: The system MUST identify which cart items participate in each detected size conflict.
- **FR-004**: The system MUST classify each detected conflict with a severity level of either warning or error.
- **FR-005**: The system MUST reserve the error severity for combinations that are definitively incompatible according to configured size intelligence rules.
- **FR-006**: The system MUST avoid reporting a conflict when the cart lacks sufficient size data or compatibility evidence to support a reliable determination.
- **FR-007**: The system MUST return a shopper-readable explanation for each detected conflict.
- **FR-008**: The system MUST return one or more suggested corrections when a supported correction can be inferred from configured mappings or acceptable adjacent sizes.
- **FR-009**: The system MUST NOT recommend a corrective size or variant that is unavailable for purchase.
- **FR-010**: The system MUST re-evaluate conflicts after cart changes so resolved issues are no longer surfaced.
- **FR-011**: The system MUST support carts with multiple distinct conflicts and return each conflict separately.
- **FR-012**: Merchant-defined compatibility overrides MUST take precedence over auto-derived or default compatibility logic.
- **FR-013**: Merchant-defined compatibility overrides MUST persist through catalog synchronization and product updates.
- **FR-014**: The system MUST ignore non-sized items when determining whether a size conflict exists.
- **FR-015**: The system MUST support both standard apparel sizes and sport-specific size systems, including weight- or measurement-based sizing, when rules exist for those systems.
- **FR-016**: The system MUST provide enough structured result detail for storefront and checkout surfaces to show the affected items, severity, explanation, and suggested correction.

### Key Entities *(include if feature involves data)*

- **Size Conflict**: A detected incompatibility between selected cart items, including the affected items, severity, explanation, and current resolution status.
- **Compatibility Rule**: A merchant-defined or default rule describing which size combinations across related product types are acceptable, unusual, or disallowed.
- **Correction Suggestion**: A proposed shopper-facing adjustment that resolves or reduces a detected mismatch, such as switching one cart line to a compatible size.
- **Cart Size Context**: The subset of cart data relevant to evaluation, including selected variants, normalized size values, product roles, and any supporting body-attribute signals already known to the system.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The system correctly detects at least 95% of error-level conflicts in the predefined cart conflict validation suite.
- **SC-002**: The system produces no false positive conflict in at least 90% of predefined compatible-cart validation scenarios.
- **SC-003**: At least 85% of detected conflicts include a correction suggestion that merchant reviewers judge as appropriate.
- **SC-004**: Shoppers can understand and act on a detected conflict fast enough that at least 80% of conflict-resolution test sessions resolve the issue in one cart-edit cycle.
- **SC-005**: Cart-level size conflict analysis completes within 200 milliseconds for the supported cart sizes in the validation environment.

## Assumptions

- Existing size intelligence data already provides normalized size metadata and cross-category mapping inputs for the main product types in scope.
- Merchant admins will manage compatibility exceptions and fit-policy overrides through existing size or knowledge-graph administration surfaces rather than a separate standalone workflow for this feature.
- This feature is limited to detecting and explaining size conflicts in the cart; standalone product-page size recommendation and long-term customer size-profile enrichment remain outside this specification.
- Storefront and checkout surfaces that consume conflict results can present warning and error states without requiring a separate approval workflow.
- The initial release targets the merchant's supported physical products with meaningful size semantics; accessories and one-size items are only evaluated when explicit rules exist.
