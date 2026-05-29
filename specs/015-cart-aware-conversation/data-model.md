# Data Model: Cart-Aware Conversation

## Overview

This feature uses route-level contracts and storefront widget session state to keep cart-aware conversation behavior consistent turn by turn.

## Entities

### ConversationTurnContext

Represents one server chat turn input assembled at request time.

Fields:
- shop: Shopify shop domain.
- sessionKey: scoped shopper chat session identifier.
- cartSnapshot: current cart state used for reasoning.
- messages: ordered conversational thread context.
- streamToken: signed short-lived token for stream authorization.

Validation rules:
- shop, sessionKey, and streamToken are required.
- messages must include at least one shopper message.
- cartSnapshot is required and may contain zero or more cart lines.

### CartSnapshot

Represents current shopper-visible cart state at turn time.

Fields:
- cartId: optional storefront cart id.
- currencyCode: ISO currency code.
- items: cart lines with productId, optional variantId, and quantity.

Validation rules:
- quantity must be a positive integer.
- cartId may be omitted for transient cart contexts.
- empty item arrays are valid and produce fallback guidance behavior.

### StructuredGuidanceBlock

Represents a typed guidance artifact rendered with assistant output.

Variants:
- recommendation_list
- comparison_table
- size_summary
- fallback_notice

Common fields:
- blockId
- type
- title
- summary
- priority

Validation rules:
- type must match a supported discriminator.
- all required variant fields must be present.
- unsupported block types must degrade to fallback rendering.

### ConversationSessionState

Represents in-browser state for one shopper conversation session.

Fields:
- sessionId
- isOpen
- status (idle, bootstrapping, ready, streaming, error)
- messages
- retryableMessage
- streamToken/sessionKey/chatUrl bootstrap fields

Validation rules:
- only one active stream per session.
- reopen preserves same-session thread context.
- stream failure preserves retry path and error message.

## Relationships

- One ConversationSessionState may issue many ConversationTurnContext requests.
- One ConversationTurnContext references one CartSnapshot.
- One assistant message may emit many StructuredGuidanceBlock instances.

## State Transitions

Session lifecycle:
1. idle -> bootstrapping when chat opens without valid bootstrap data.
2. bootstrapping -> ready after bootstrap succeeds.
3. ready -> streaming when shopper submits message.
4. streaming -> ready when message-complete arrives.
5. streaming -> error when stream fails.
6. error -> ready when retry succeeds.

Turn consistency:
1. Cart is read from current storefront state at submit time.
2. Request is authorized by token and origin checks.
3. Response stream emits text-delta and optional guidance blocks.
4. Client finalizes assistant message on message-complete.
