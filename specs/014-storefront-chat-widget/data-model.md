# Data Model: Chat Interface (Storefront Widget)

## Overview

This feature keeps its primary state session-local in the storefront widget and adds only transient server-issued bootstrap data. No long-term transcript persistence is introduced in v1.

## Entities

### StorefrontChatBootstrap

Represents the server-issued payload that authorizes a shopper session to open a streamed chat connection.

**Fields**
- `shop`: Shopify shop domain the widget is operating against.
- `cartId`: Optional cart identifier supplied by the storefront surface.
- `sessionKey`: Opaque shopper-session identifier used to correlate turns within the current browsing session.
- `streamToken`: Short-lived signed token used by the direct chat route.
- `expiresAt`: Absolute expiration timestamp for the token.
- `conversationLimits`: Current session limits such as max retained messages or payload size.

**Validation rules**
- `shop` must be a non-empty shop domain string.
- `streamToken` must be signed server-side and rejected after expiration.
- `sessionKey` must not expose merchant secrets or customer identifiers directly.

### StorefrontChatSession

Represents the in-browser conversation state for a single shopper session.

**Fields**
- `sessionKey`: Bootstrap-linked conversation identifier.
- `status`: `idle | bootstrapping | ready | streaming | error`.
- `isOpen`: Whether the panel is currently expanded.
- `surface`: `cart_drawer | cart_page`.
- `messages`: Ordered collection of `StorefrontChatMessage` items retained for follow-up turns.
- `lastError`: Optional human-readable recovery message for the most recent failure.
- `updatedAt`: Last local interaction timestamp.

**Validation rules**
- Only one active streamed request may exist per session at a time.
- The session must preserve recent messages when the panel closes and reopens within the same browser session.
- Local state must degrade safely if bootstrap expires or token validation fails.

### StorefrontChatMessage

Represents one chronological thread item from the shopper or assistant.

**Fields**
- `messageId`: Client-generated or server-generated stable identifier.
- `role`: `user | assistant | system`.
- `state`: `pending | streaming | complete | failed`.
- `textParts`: Ordered textual segments rendered in the thread.
- `guidanceBlocks`: Ordered collection of `StructuredGuidanceBlock` items associated with the message.
- `createdAt`: Timestamp used for ordering and reconnection handling.

**Validation rules**
- Messages must render in chronological order.
- Only assistant messages may contain `guidanceBlocks`.
- A failed message must retain enough context for the shopper to retry without losing the submitted question.

### StructuredGuidanceBlock

Represents a typed rich-shopping artifact rendered inline with an assistant response.

**Variants**
- `recommendation_list`: Ordered recommendation cards with title, reason, and cart-linked product references.
- `comparison_table`: Side-by-side comparison rows for shortlisted products.
- `size_summary`: Shopper-readable sizing guidance summary with confidence and caveat text.
- `fallback_notice`: Non-rich recovery block explaining why rich output is unavailable.

**Common fields**
- `blockId`: Stable identifier unique within a message.
- `type`: Discriminator for client rendering.
- `title`: Shopper-facing heading.
- `summary`: Short explanatory text.
- `priority`: Integer used for ordering when multiple blocks are present.

**Validation rules**
- Every block must match a known discriminator.
- Product or variant references must be optional and validated before render.
- Unknown block types must render as a safe fallback notice rather than crashing the thread.

### CartContextSnapshot

Represents the cart-aware state shared with the chat orchestrator on a turn.

**Fields**
- `shop`: Shop domain.
- `cartId`: Optional cart identifier.
- `items`: Current cart lines with product and optional variant references.
- `currencyCode`: Currency context for shopper-facing copy.
- `shopperIdentity`: Optional customer or session identity hints already used by the recommendation route.
- `personalization`: Optional resolved profile summary from existing customer-profile logic.

**Validation rules**
- The snapshot must be derived from the current storefront state for each turn.
- Empty-cart snapshots are valid but must limit item-specific guidance.
- All nested values must be sanitized before prompt assembly or UI rendering.

## Relationships

- One `StorefrontChatBootstrap` authorizes one `StorefrontChatSession` at a time.
- One `StorefrontChatSession` contains many `StorefrontChatMessage` items.
- One assistant `StorefrontChatMessage` may contain many `StructuredGuidanceBlock` items.
- Each chat turn references one current `CartContextSnapshot`, but the snapshot itself is not persisted across visits in v1.

## State Transitions

### Chat session lifecycle

1. `idle` → `bootstrapping` when the shopper opens the panel.
2. `bootstrapping` → `ready` when the widget receives a valid bootstrap payload.
3. `ready` → `streaming` when the shopper submits a message.
4. `streaming` → `ready` when the assistant completes successfully.
5. `streaming` → `error` when token validation, network transport, or AI orchestration fails.
6. `error` → `bootstrapping` or `ready` when the shopper retries successfully.

### Message lifecycle

1. Shopper message is created as `complete` immediately after local submit.
2. Assistant placeholder is created as `pending`.
3. Assistant placeholder moves to `streaming` as text or block parts arrive.
4. Assistant message becomes `complete` when the stream finishes.
5. Assistant message becomes `failed` when the stream terminates unexpectedly.