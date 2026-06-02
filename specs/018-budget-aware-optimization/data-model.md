# Data Model: Budget-Aware Optimization

## Overview

This feature introduces structured budget optimization state inside storefront chat so shoppers can request a target budget, review ranked trade-offs, and apply accepted changes safely.

## Entities

### BudgetOptimizationRequest

A shopper-originated optimization request for the current cart.

Fields:
- requestId: string (UUID).
- sessionKey: string.
- shop: string (`*.myshopify.com`).
- cartId: string | null.
- targetBudgetAmount: number.
- currencyCode: string.
- requestedAt: ISO timestamp.
- sourceMessageId: string.

Validation rules:
- `targetBudgetAmount` must be > 0.
- `currencyCode` must match cart currency.
- Request must be scoped to the active session/shop.

### BudgetOptimizationCandidate

A single potential change considered by the optimizer.

Fields:
- candidateId: string.
- changeType: `swap` | `remove` | `downgrade` | `defer`.
- sourceLineId: string.
- sourceProductId: string.
- sourceVariantId: string | null.
- targetProductId: string | null.
- targetVariantId: string | null.
- estimatedSavings: number.
- safetyCriticalImpact: `none` | `reduced_protection` | `critical_removal`.
- rationale: string.
- disciplineFitScore: number (0..1).
- availability: `available` | `unavailable` | `unknown`.

Validation rules:
- `estimatedSavings` must be >= 0.
- Candidates with `critical_removal` are excluded unless explicit shopper override path is active.

### BudgetOptimizationProposal

Ranked, shopper-visible optimization output.

Fields:
- optimizationContextId: string.
- requestId: string.
- baselineSubtotal: number.
- targetBudgetAmount: number.
- projectedSubtotal: number.
- projectedGapAmount: number.
- candidates: BudgetOptimizationCandidate[].
- appliedConstraintSummary: string[].
- status: `within_budget` | `optimized` | `constraint_blocked` | `insufficient_candidates`.
- generatedAt: ISO timestamp.
- freshness: {
  - priceCheckedAt: ISO timestamp;
  - availabilityCheckedAt: ISO timestamp;
  }.

Validation rules:
- `projectedSubtotal` must be <= `baselineSubtotal` when status is `optimized`.
- `projectedGapAmount` is `max(0, target - projectedSubtotal)`.
- Proposal must include at least one candidate unless status explains no-action path.

### BudgetOptimizationDecision

Shopper decision event against a proposal.

Fields:
- decisionId: string.
- optimizationContextId: string.
- actionId: string.
- decisionType: `accept_candidate` | `reject_candidate` | `accept_all` | `decline_all`.
- candidateIds: string[].
- decidedAt: ISO timestamp.

Validation rules:
- `candidateIds` must belong to the referenced proposal.
- Decisions are idempotent per `actionId`.

### BudgetOptimizationLifecycleRecord

Canonical status tracking for optimization lifecycle.

Fields:
- optimizationContextId: string.
- status: `generated` | `failed` | `expired` | `action_pending` | `action_executed` | `action_failed`.
- errorCode: string | null.
- errorMessage: string | null.
- updatedAt: ISO timestamp.

Validation rules:
- Terminal states are monotonic (`failed`, `expired`, `action_executed`, `action_failed`).

## Relationships

- One `BudgetOptimizationRequest` produces at most one `BudgetOptimizationProposal` per run.
- One `BudgetOptimizationProposal` contains 0..N `BudgetOptimizationCandidate` entries.
- One proposal can receive multiple `BudgetOptimizationDecision` events.
- Decision outcomes update `BudgetOptimizationLifecycleRecord`.

## State Transitions

1. Request accepted -> `generated` when proposal built successfully.
2. Request accepted -> `failed` when candidate generation or validation fails.
3. `generated` -> `action_pending` when shopper approves one/all candidates.
4. `action_pending` -> `action_executed` when cart mutations complete.
5. `action_pending` -> `action_failed` when revalidation/mutation fails.
6. `generated` -> `expired` after context TTL.

Invalid transitions:
- Any transition out of terminal states.

## Derived UI Projections

### BudgetOptimizationCardModel
- optimizationContextId
- baselineSubtotal
- targetBudgetAmount
- projectedSubtotal
- projectedGapAmount
- candidateRows[]
- constraintNotices[]
- applyControls

Rules:
- Candidate rows sorted by safety-first then highest savings.
- Must display explicit warning when proposal is `constraint_blocked`.

### BudgetOptimizationTimelineItem
- optimizationContextId
- createdAt
- status
- resolvedSubtotal (optional)
- statusSummary

Rules:
- Persist in session timeline to support retries and transparent history.
