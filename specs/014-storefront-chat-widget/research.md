# Research: Chat Interface (Storefront Widget)

## Decision 1: Stream chat over a direct backend endpoint, not App Proxy

**Decision**: Use a direct `api.ai.chat` endpoint for streamed responses and reserve Shopify App Proxy for a bootstrap request that issues a short-lived signed shopper token.

**Rationale**: The repository already notes Cloudflare tunnel behavior that buffers streams in local development, and the PRD explicitly calls out that App Proxy is not suitable for streaming chat. Separating bootstrap from streaming keeps storefront authentication intact while allowing SSE or AI SDK data-stream transport to behave correctly.

**Alternatives considered**:
- Stream through App Proxy: rejected because proxy buffering and extra latency make token-by-token chat unreliable.
- Use an unauthenticated public chat endpoint: rejected because it would widen the storefront attack surface and conflict with the security model.

## Decision 2: Introduce a dedicated storefront widget bundle

**Decision**: Create a separate `storefront-widget/` bundle that mounts inside a Shadow DOM host loaded by a Theme App Extension block.

**Rationale**: The current React Router app is an embedded admin application and does not produce theme-safe shopper assets. A dedicated bundle isolates customer-facing dependencies, supports cart drawer/page mounting, and preserves CSS boundaries between merchant themes and the chat UI.

**Alternatives considered**:
- Reuse the admin React bundle on the storefront: rejected because embedded-app assumptions, Polaris dependencies, and build targets do not fit theme rendering.
- Inject raw JavaScript without a theme extension: rejected because it violates the repo constitution and Shopify-first extension model.

## Decision 3: Keep transcript state session-local for v1

**Decision**: Hold conversation history in widget session state and only send the active thread context needed for follow-up turns; do not add a persistent `ChatSession` table in this slice.

**Rationale**: The spec only requires same-session continuity when reopening the panel. Avoiding persistence removes consent, retention, moderation, and analytics overhead from the initial chat-interface slice and keeps the feature tightly scoped.

**Alternatives considered**:
- Persist every chat session in PostgreSQL: rejected because it expands scope into transcript lifecycle and privacy controls not required by the feature spec.
- Keep no local history at all: rejected because it would fail the reopen-and-continue user story.

## Decision 4: Use typed structured-guidance blocks instead of server-generated markup

**Decision**: Model server chat responses as typed message parts plus a discriminated union of guidance blocks such as recommendation cards, comparison tables, and size summaries.

**Rationale**: The repo already favors typed payload builders and Zod validation. Typed blocks allow safe rendering in the widget, preserve testability, and avoid XSS or brittle HTML serialization problems.

**Alternatives considered**:
- Return raw HTML snippets from the model: rejected because they are harder to validate, test, and secure.
- Return plain text only: rejected because it does not satisfy the structured-guidance requirement in the spec.

## Decision 5: Reuse existing recommendation and profile builders for cart-aware context

**Decision**: Assemble chat context and guidance from existing customer-profile and recommendation builder surfaces where possible, then add a dedicated chat orchestrator for prompt assembly and response shaping.

**Rationale**: The current codebase already has validated cart, personalization, replenishment, and style recommendation payloads. Reusing these surfaces reduces duplication and keeps business logic consistent across recommendation cards and chat guidance.

**Alternatives considered**:
- Build an entirely separate chat-specific product-logic layer: rejected because it would duplicate cart intelligence and drift from the existing shopper recommendation model.
- Call Shopify Admin or Storefront APIs directly on every turn: rejected because it adds latency and unnecessary external dependency to the message path.

## Decision 6: Validate with route-focused Vitest coverage plus manual Shopify theme QA

**Decision**: Add automated Vitest coverage for bootstrap contract validation, streaming-route shaping, and widget session-state reducers, then use manual QA in a dev store for drawer/page behavior across screen sizes.

**Rationale**: The repo already uses Vitest for route integration. There is no existing Playwright or browser-extension test harness in the repository, so route/state automation plus focused manual theme validation is the lowest-friction path that still satisfies the constitution.

**Alternatives considered**:
- Add a full end-to-end browser framework in this slice: rejected because it adds setup overhead beyond the feature's immediate planning needs.
- Rely on manual QA only: rejected because constitution rules require new business logic to have automated tests.