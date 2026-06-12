# Research: Chat Cart Management

## Decision: Extend existing cart tool proposal pipeline instead of introducing a new mutation channel

**Rationale**: The repository already has `buildCartToolActionProposal` in `app/lib/ai/tools.ts` and action confirmation in `api.ai.chat.actions.confirm.tsx`. Extending these surfaces keeps mutation proposals, shopper approvals, and idempotent execution in one path.

**Alternatives considered**: A separate dedicated cart-mutation route for chat-only actions was rejected because it would duplicate token/scope checks and split action lifecycle state across two implementations.

## Decision: Keep confirmation token scope and origin validation as strict preconditions for every approved mutation

**Rationale**: Existing action confirmation already validates token, shop, session key, and storefront origin. This is the correct network-boundary enforcement model for shopper-initiated cart mutations and aligns with Security-By-Design.

**Alternatives considered**: Relaxing origin checks for convenience was rejected due to CSRF/scope risk. Trusting client-only action IDs without signed confirmation tokens was rejected due to replay and spoofing risks.

## Decision: Treat swap-variant as an atomic intention with rollback-safe execution semantics

**Rationale**: Current adapter flow removes then adds. For this feature, swap intent must remain shopper-safe with no unintended destructive state. The planned execution semantics require explicit failure handling and conflict messaging so no silent partial mutation is accepted as success.

**Alternatives considered**: Handling variant replacement in the client by issuing separate remove/add actions was rejected because it weakens conversational consistency and error recovery messaging.

## Decision: Preserve idempotent replay behavior for terminal action statuses

**Rationale**: `getCartToolActionIdempotentReplay` and lifecycle transitions already support at-most-once semantics for approval flows. Cart management in chat relies on this to avoid duplicate adds or repeated quantity changes when clients retry.

**Alternatives considered**: Allowing repeated execution for duplicate approve calls was rejected because it can cause over-add and inconsistent cart state.

## Decision: Keep cart snapshot refresh in storefront widget as the source of post-mutation UI truth

**Rationale**: `useCartStateSync` already observes mutation endpoints and `/cart.js` snapshots. Reusing this model ensures chat action results converge with actual storefront cart state and supports drawer/page parity.

**Alternatives considered**: Rendering cart mutation results only from server response without sync refresh was rejected because it can drift from storefront state when theme or third-party scripts mutate cart concurrently.

## Decision: Add focused tests around action parsing, execution outcomes, and edge-case failures

**Rationale**: This feature modifies business-critical cart mutation behavior. Unit tests should cover proposal inference and adapter rules; integration tests should cover confirm route transitions, idempotent replay, and conflict/error responses.

**Alternatives considered**: Relying on manual storefront verification alone was rejected because regression risk is high for mutation idempotency and failure-path correctness.
