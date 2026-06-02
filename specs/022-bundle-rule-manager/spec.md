# Feature Specification: Bundle Rule Manager

**Feature Branch**: `022-bundle-rule-manager`  
**Created**: 2026-06-02  
**Status**: Draft  
**Input**: User description: "Feature: Bundle Rule Manager in #file:prd-cartmind.md"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Create And Activate Bundle Rules (Priority: P1)

A merchant admin can create a new bundle rule by selecting included products, defining minimum completion criteria, and setting the customer incentive so the store can promote coherent kits and increase basket value.

**Why this priority**: Without reliable rule creation, no bundle experience can be delivered to shoppers.

**Independent Test**: Can be fully tested by creating a new rule from scratch, activating it, and confirming it appears as active in the merchant rule list.

**Acceptance Scenarios**:

1. **Given** a merchant with bundle management access and an existing product catalog, **When** they create a rule with a valid name, product set, completion criteria, and incentive, **Then** the rule is saved and shown as active.
2. **Given** a merchant creating a rule, **When** required inputs are missing or contradictory, **Then** the system blocks activation and clearly identifies what must be corrected.

---

### User Story 2 - Preview And Validate Bundle Behavior (Priority: P2)

A merchant admin can simulate how a configured rule behaves against representative cart contents before publishing changes, so they can prevent pricing mistakes and customer confusion.

**Why this priority**: Validation before launch reduces revenue risk and avoids broken customer-facing offers.

**Independent Test**: Can be fully tested by running a preview using example carts and verifying the expected qualification result and customer-facing bundle message.

**Acceptance Scenarios**:

1. **Given** a draft or edited rule, **When** the merchant runs a preview with a sample cart, **Then** the system returns whether the cart qualifies and what incentive would be shown.
2. **Given** preview results that reveal an issue, **When** the merchant modifies rule inputs and re-runs preview, **Then** updated results reflect the new configuration immediately.

---

### User Story 3 - Maintain Rule Lifecycle Safely (Priority: P3)

A merchant admin can edit, pause, archive, and duplicate existing bundle rules while preserving traceability, so merchandising can adapt to campaigns without losing governance control.

**Why this priority**: Ongoing lifecycle operations are needed for seasonal changes and safe iteration after initial launch.

**Independent Test**: Can be fully tested by changing a rule through each lifecycle state and confirming only intended rules are active at any time.

**Acceptance Scenarios**:

1. **Given** an active rule, **When** the merchant pauses or archives it, **Then** it is excluded from active offer evaluation while remaining visible in historical listings.
2. **Given** a successful historical rule, **When** the merchant duplicates it, **Then** a new editable draft is created without altering the original rule.

### Edge Cases

- What happens when two active rules match the same cart with overlapping products but different incentives?
- How does the system handle a rule that references products that become unavailable or removed from the catalog?
- What happens when a merchant attempts to activate a rule with contradictory thresholds (for example, impossible completion conditions)?
- How does the system behave when many rules are active simultaneously for the same product family?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow authorized merchant admins to create bundle rules with a name, bundle item set, eligibility conditions, incentive definition, and lifecycle state.
- **FR-002**: System MUST validate rule inputs before activation and prevent activation of rules that are incomplete, contradictory, or reference invalid items.
- **FR-003**: System MUST let merchant admins preview rule outcomes against example cart compositions before publishing changes.
- **FR-004**: System MUST present preview output that includes qualification status, incentive outcome, and an explanation that the merchant can verify.
- **FR-005**: System MUST allow merchant admins to update existing rules and save changes without unintentionally modifying unrelated rules.
- **FR-006**: System MUST support rule lifecycle transitions at minimum for draft, active, paused, and archived states.
- **FR-007**: System MUST ensure archived or paused rules are excluded from active customer offer evaluation.
- **FR-008**: System MUST provide a duplication workflow that creates a new draft from an existing rule.
- **FR-009**: System MUST retain auditable metadata for rule creation and updates, including who changed the rule and when.
- **FR-010**: System MUST resolve overlapping eligible rules using a deterministic priority policy so customer outcomes are consistent.
- **FR-011**: System MUST preserve existing active customer experiences if a rule edit fails validation or cannot be published.
- **FR-012**: System MUST provide clear merchant-facing feedback for validation failures and lifecycle transition errors.

### Key Entities *(include if feature involves data)*

- **Bundle Rule**: A merchant-defined offer configuration containing rule identity, status, eligibility conditions, incentive definition, and governance metadata.
- **Bundle Item Requirement**: A structured entry describing which product(s) contribute to rule completion and whether each item is required or optional.
- **Rule Preview Scenario**: A merchant-provided sample cart context used to evaluate qualification and incentive outcomes before activation.
- **Rule Evaluation Outcome**: The deterministic result of applying one or more rules to a cart context, including matched rule, incentive effect, and rationale.
- **Rule Audit Record**: A historical record of rule creation, edits, status transitions, and actor/timestamp context.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 95% of merchants can create and activate a valid bundle rule in under 10 minutes during onboarding usability tests.
- **SC-002**: 100% of preview simulations return a deterministic qualification result for the same input cart and rule set.
- **SC-003**: At least 90% of rule validation errors are resolved by merchants without support intervention on first retry.
- **SC-004**: Merchants can complete a full lifecycle operation (activate, pause, duplicate, archive) with zero unintended activation of other rules.
- **SC-005**: Bundle-offer related support tickets from configuration errors decrease by at least 40% within one quarter after launch.

## Assumptions

- Merchant users managing bundle rules have appropriate administrative access within the app.
- Product catalog data used for rule selection is already synchronized and available at the time of rule configuration.
- Bundle incentives are governed by existing store discount policies and legal constraints defined outside this feature.
- Merchants will configure a manageable number of concurrent active rules per product family, enabling practical review and governance.
- Existing customer-facing cart and checkout experiences can consume active rule outcomes without requiring new shopper education flows.
