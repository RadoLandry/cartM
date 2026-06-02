# Data Model: Product Comparison

## Overview

This feature introduces structured comparison state in storefront chat so shoppers can compare products and apply a selection action from the result without losing context.

## Entities

### ComparisonRequest

Shopper intent to compare products in the current session.

Fields:
- requestId: string (ULID/UUID).
- sessionKey: string.
- shop: string (`*.myshopify.com`).
- productRefs: string[] (2-5 product or variant references).
- optionalDimensions: string[] | null (e.g., price, material, use-case).
- requestedAt: ISO timestamp.
- sourceMessageId: string.

Validation rules:
- `productRefs` length must be >=2 and <=5.
- Duplicate refs are removed; if unique count <2, request is invalid.
- All refs must resolve to products visible in current storefront context.

### ComparisonProductSnapshot

Normalized per-product data used for one comparison response.

Fields:
- snapshotId: string.
- comparisonContextId: string.
- productId: string.
- variantId: string | null.
- title: string.
- imageUrl: string | null.
- price: string.
- currencyCode: string.
- availability: `available` | `unavailable` | `limited`.
- attributes: Record<string, string | number | boolean>.
- snapshotAt: ISO timestamp.

Validation rules:
- Required shopper-facing fields must be present for every compared product.
- `snapshotAt` must be set from data-fetch completion time.

### ComparisonResult

Session-renderable comparison output.

Fields:
- comparisonContextId: string.
- requestId: string.
- comparedProducts: ComparisonProductSnapshot[].
- comparisonRows: Array<{ dimension: string; values: Record<string, string> }>.
- recommendation: {
  - recommendedProductId: string;
  - rationale: string;
  - confidence: number;
  } | null.
- generatedAt: ISO timestamp.
- dataFreshness: {
  - priceCheckedAt: ISO timestamp;
  - availabilityCheckedAt: ISO timestamp;
  }.

Validation rules:
- `recommendedProductId` must belong to `comparedProducts` if recommendation is present.
- `comparisonRows` must include at least one non-empty dimension.

### ComparisonFollowupAction

Shopper action chosen from a comparison result.

Fields:
- actionId: string.
- comparisonContextId: string.
- sessionKey: string.
- actionType: `choose_recommended` | `choose_alternative`.
- selectedProductId: string.
- selectedVariantId: string | null.
- initiatedAt: ISO timestamp.

Validation rules:
- `comparisonContextId` must resolve to existing `ComparisonResult` in same session.
- Selected product must exist in that comparison context.
- Action must pass existing confirmation and idempotency guards before mutation.

### ComparisonLifecycleRecord

Canonical status tracking for comparison generation and follow-up application.

Fields:
- comparisonContextId: string.
- status: `generated` | `failed` | `expired` | `action_pending` | `action_executed` | `action_failed`.
- errorCode: string | null.
- errorMessage: string | null.
- updatedAt: ISO timestamp.

Validation rules:
- Status transitions are monotonic and terminal for `failed`, `expired`, `action_executed`, `action_failed`.

## Relationships

- One `ComparisonRequest` produces at most one `ComparisonResult`.
- One `ComparisonResult` contains 2-5 `ComparisonProductSnapshot` records.
- One `ComparisonResult` can trigger zero or more `ComparisonFollowupAction` attempts.
- `ComparisonFollowupAction` execution outcome is reflected in `ComparisonLifecycleRecord`.

## State Transitions

Comparison lifecycle:
1. Request accepted -> `generated` on successful comparison payload build.
2. Request accepted -> `failed` when product resolution or data fetch fails with no fallback.
3. `generated` -> `action_pending` when shopper initiates follow-up choice.
4. `action_pending` -> `action_executed` when confirmed mutation succeeds.
5. `action_pending` -> `action_failed` when revalidation or mutation fails.
6. `generated` -> `expired` when context TTL passes without action.

Invalid transitions:
- Any transition out of terminal statuses (`failed`, `expired`, `action_executed`, `action_failed`).

## Derived UI Projections

### ComparisonCardModel
- comparisonContextId
- productColumns[]
- dimensionRows[]
- recommendationBadge
- freshnessLabel
- actionButtons (recommendation + alternatives)

Rules:
- Must render with stable column ordering matching `productRefs` order after normalization.
- Must display freshness metadata when comparison age exceeds configured threshold.

### ComparisonHistoryItem
- comparisonContextId
- createdAt
- status
- selectedProductTitle (optional)
- statusSummary

Rules:
- Persist in session timeline for transparency and retry guidance.
