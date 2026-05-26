# Data Model: Threshold Optimization

## Overview

Threshold Optimization adds merchant-authored threshold rules plus deterministic evaluation outputs that derive shopper-facing suggestions from existing catalog, relationship, pricing, and availability data.

## Entities

### ThresholdRule

- **Purpose**: Defines a merchant-controlled spend target and how CartMind should behave when a shopper approaches it.
- **Key fields**:
  - `id`: Internal unique identifier.
  - `shop`: Shopify shop domain.
  - `key`: Stable merchant-scoped rule key.
  - `label`: Merchant-facing rule label.
  - `description`: Optional internal explanation.
  - `status`: Lifecycle state such as `ACTIVE`, `DRAFT`, or `ARCHIVED`.
  - `priority`: Integer ordering used when more than one rule could apply.
  - `benefitType`: Threshold outcome category such as free shipping, discount tier, or custom benefit.
  - `benefitLabel`: Shopper-facing benefit copy.
  - `targetSubtotal`: Cart subtotal required to satisfy the threshold.
  - `actionableWindow`: Maximum allowed gap for shopper prompting.
  - `allowOvershoot`: Whether a suggestion may reasonably exceed the gap when it remains relevant.
  - `maxSuggestions`: Maximum surfaced candidates, capped at 3 in v1.
  - `supportedDisciplineTags`: Optional discipline allowlist for targeted rules.
  - `supportedCategoryTags`: Optional category allowlist for targeted rules.
  - `excludedShopifyProductIds`: Product exclusions that must never be suggested for this rule.
  - `duplicatePurchasePolicy`: Rule for whether in-cart products may be suggested again.
- **Relationships**:
  - Owned by a single shop.
  - Evaluated against cart items and existing product relationship data.
- **Validation rules**:
  - `key` must be unique per shop.
  - `targetSubtotal` must be greater than zero.
  - `actionableWindow` must be greater than zero for active rules.
  - `maxSuggestions` must be between 1 and 3.

### ThresholdEvaluation

- **Purpose**: Represents a single cart's evaluation against the chosen threshold opportunity.
- **Key fields**:
  - `thresholdKey`: Selected rule key.
  - `cartSubtotal`: Current cart subtotal in the shop currency.
  - `gapAmount`: Remaining spend needed to qualify.
  - `selectionReason`: Why this threshold was chosen over other active rules.
  - `status`: Evaluation state such as `qualified`, `eligible`, `suppressed`, or `not_applicable`.
  - `suppressionReason`: Optional reason when no shopper prompt should surface.
- **Relationships**:
  - References one `ThresholdRule`.
  - Contains zero to three `ThresholdSuggestion` results.
- **Validation rules**:
  - `gapAmount` cannot be negative for unmet thresholds.
  - `suppressionReason` is required when status is suppressed.

### ThresholdSuggestion

- **Purpose**: A ranked candidate product that could help the shopper reach the chosen threshold.
- **Key fields**:
  - `productId`: Internal product identifier.
  - `variantId`: Optional preferred variant identifier.
  - `title`: Shopper-facing product title.
  - `unitPrice`: Candidate unit price used for gap fit scoring.
  - `availableForSale`: Availability flag.
  - `relevanceScore`: Contextual fit score relative to the current cart.
  - `gapFitScore`: Score describing how reasonably the candidate closes the gap.
  - `compositeScore`: Final ranking score.
  - `reasoning`: Shopper-readable explanation fragments for benefit plus contextual fit.
  - `wouldOvershoot`: Whether the suggestion exceeds the exact remaining gap.
  - `isDuplicateSuggestion`: Whether the item already exists in the cart.
- **Relationships**:
  - Derived from existing product, variant, and relationship data.
- **Validation rules**:
  - Suggestions must not be emitted when `availableForSale` is false.
  - Suggestions must not violate the rule's exclusion or duplicate policy.

## State Transitions

### ThresholdRule lifecycle

`DRAFT` -> `ACTIVE` -> `ARCHIVED`

- Draft rules can be edited freely and previewed.
- Active rules can be used in shopper evaluations.
- Archived rules remain auditable but are ignored during evaluation.

### ThresholdEvaluation lifecycle

`not_applicable` -> `eligible` -> `qualified`

Alternate suppression path:

`not_applicable` -> `suppressed`

- `not_applicable`: Cart is far from any active threshold or no active rules exist.
- `eligible`: Cart is inside the actionable window and has at least one credible candidate.
- `qualified`: Cart already meets the selected threshold; no prompt should surface.
- `suppressed`: Cart is near a threshold numerically but should stay quiet because relevance, inventory, or policy rules block credible suggestions.