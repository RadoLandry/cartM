# Research: Product Comparison

## Decision 1: Model product comparison as an AI tool contract with typed stream payloads

Decision: Add a dedicated `compareProducts` tool path within existing storefront chat streaming so the assistant emits a structured comparison payload, not free-form markdown tables.

Rationale: The feature requires deterministic UI rendering and direct follow-up actions from the comparison output. Structured payloads preserve machine-readable context for both UI and action-confirmation flow.

Alternatives considered:
- Generate plain-text comparison only: rejected because follow-up actions cannot be reliably bound to compared products.
- Add a separate `/api/ai/compare` endpoint: rejected because it duplicates session handling and creates split conversation state.

## Decision 2: Use Storefront GraphQL as the source of truth with minimal field selection

Decision: Fetch comparison product data through Storefront GraphQL with only required fields for shopper decisions (title, image, price, availability, selected specs).

Rationale: Storefront APIs are appropriate for shopper-visible product state and align with Constitution Principle III (field-minimal queries, no over-fetching).

Alternatives considered:
- Query Admin API for richer product metadata: rejected as unnecessary for shopper comparison and risks coupling with admin auth.
- Reuse stale catalog snapshots only: rejected because comparison must reflect current price/availability.

## Decision 3: Keep follow-up product selection under explicit confirmation gating

Decision: Route "choose recommended product" and "choose alternative" as actionable intents through existing confirmation lifecycle before cart mutation.

Rationale: FR-005 and FR-006 require direct action from comparison while preserving safety guarantees introduced by cart manipulation tools.

Alternatives considered:
- Immediate apply on click: rejected due to accidental mutation risk.
- Ask natural-language confirmation only: rejected as non-deterministic for idempotency and auditability.

## Decision 4: Bind every rendered comparison to a session-scoped context ID

Decision: Create a `comparisonContextId` for each rendered result and require it for follow-up actions so decisions always reference the exact compared set.

Rationale: Prevents mismatches when multiple comparisons happen in one session and satisfies FR-008 session context continuity.

Alternatives considered:
- Infer context from latest assistant message: rejected due to race conditions in streaming and replay.
- Global single active comparison in session: rejected because it blocks natural iterative comparison behavior.

## Decision 5: Include snapshot metadata and stale-state handling in comparison results

Decision: Attach snapshot timestamps and version markers (price/availability checks) to each comparison result, and revalidate before applying follow-up action.

Rationale: Addresses edge cases where product state changes between compare and choose phases and supports FR-009.

Alternatives considered:
- No revalidation after compare: rejected because cart mutation could fail unexpectedly with poor UX.
- Hard lock compared products for session: rejected as not feasible on Shopify storefront.

## Decision 6: Testing strategy should extend existing chat stream and action tests

Decision: Add integration tests for compare->render->choose flow plus unit tests for normalization, recommendation ranking, and invalid request guidance.

Rationale: Existing test architecture already validates storefront chat transport and confirmation behavior; extending it provides high signal with low setup cost.

Alternatives considered:
- Manual QA only: rejected by Constitution Principle V.
- New E2E harness for this slice: rejected for planning scope due to slower feedback and redundant coverage.
