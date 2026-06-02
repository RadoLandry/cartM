# Data Model: Cart Manipulation via Tools

## Overview

This feature adds a confirmation-gated cart mutation model on top of storefront chat streaming. The core model separates intent proposal from execution and tracks lifecycle with idempotency guarantees.

## Entities

### CartActionRequest

Structured action proposed by the assistant before any mutation.

Fields:
- actionId: string (ULID/UUID).
- sessionKey: string (shopper chat session scope).
- shop: string (`*.myshopify.com`).
- cartId: string | null.
- actionType: `add` | `remove` | `change_quantity` | `swap_variant`.
- payload: action-specific parameters.
- proposedAt: ISO timestamp.
- expiresAt: ISO timestamp.
- sourceMessageId: string (assistant message that proposed action).

Action payload variants:
- add:
  - merchandiseId: string (Shopify variant GID).
  - quantity: integer >= 1.
- remove:
  - lineId: string (Shopify cart line id).
- change_quantity:
  - lineId: string.
  - quantity: integer >= 1.
- swap_variant:
  - lineId: string.
  - newMerchandiseId: string.
  - quantity: integer >= 1 (defaults to current line quantity).

Validation rules:
- `expiresAt` must be later than `proposedAt` and within configured TTL.
- `actionType` and payload discriminator must match.
- quantity must be bounded by store limits and available inventory checks.

### ActionConfirmation

Shopper decision for one proposed action.

Fields:
- confirmationId: string.
- actionId: string.
- sessionKey: string.
- decision: `approve` | `decline`.
- decidedAt: ISO timestamp.
- actor: `shopper_session`.

Validation rules:
- Must reference an action in `proposed` state.
- Must be same `shop` + `sessionKey` scope as proposal.
- Decisions after expiry are rejected with `ACTION_EXPIRED`.

### PendingActionToken

Short-lived token binding confirmation requests to one action and session.

Fields:
- token: signed string.
- actionId: string.
- sessionKey: string.
- shop: string.
- cartId: string | null.
- exp: epoch ms.

Validation rules:
- Signature valid and unexpired.
- Scope must match request body and current stream scope.

### CartMutationExecution

Canonical lifecycle record for proposed actions.

Fields:
- actionId: string.
- status: `proposed` | `approved` | `declined` | `expired` | `executing` | `executed` | `failed`.
- idempotencyKey: string.
- validatedCartVersion: string | null.
- mutationAttemptedAt: ISO timestamp | null.
- completedAt: ISO timestamp | null.
- failureCode: string | null.
- failureMessage: string | null.

Validation rules:
- Allowed transitions only (see state transitions).
- `executed` and `failed` are terminal.
- Duplicate approvals while terminal must return existing terminal state without re-running mutation.

### CartMutationResult

Result payload returned to chat stream and confirmation endpoint.

Fields:
- actionId: string.
- status: `executed` | `declined` | `expired` | `failed`.
- appliedChange: human-readable summary.
- reason: optional failure/decline reason.
- recoveryOptions: string[].
- cartSnapshot: current cart summary after processing.

Validation rules:
- `appliedChange` required for `executed`.
- `reason` required for `failed`/`expired` when available.

## Relationships

- One `ConversationSessionState` can create many `CartActionRequest` entries.
- Each `CartActionRequest` can have at most one terminal `CartMutationExecution`.
- One `ActionConfirmation` references exactly one `CartActionRequest`.
- One `CartMutationResult` is emitted per resolved action.

## State Transitions

Action lifecycle:
1. `proposed` -> `approved` when shopper approves before expiry.
2. `proposed` -> `declined` when shopper declines.
3. `proposed` -> `expired` when TTL elapses without decision.
4. `approved` -> `executing` when server acquires idempotent execution lock.
5. `executing` -> `executed` on successful Storefront mutation.
6. `executing` -> `failed` on revalidation or mutation error.

Invalid transitions:
- Any transition out of `declined`, `expired`, `executed`, `failed`.
- `approved` -> `approved` (duplicate approval is read-only replay).

## Derived Projections for UI

### ActionHistoryItem
- actionId
- actionType
- proposedLabel
- currentStatus
- proposedAt
- resolvedAt
- resultSummary

Rules:
- Timeline sorted by `proposedAt` ascending.
- Status badge reflects canonical terminal/non-terminal state.
- Duplicate approval acknowledgements do not create duplicate history rows.
