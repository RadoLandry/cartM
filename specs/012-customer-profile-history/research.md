# Research: Customer Profile & History

## Reuse the existing CustomerProfile row

### Decision
Extend the existing `CustomerProfile` Prisma model instead of introducing a second persistence model for personalization.

### Rationale
The repo already persists shopper-linked size information in `CustomerProfile` and resolves it by `shopifyCustomerId` or `sessionId`. That row is already the natural identity boundary for both anonymous and recognized shoppers. Expanding it with broader summary fields keeps the feature lightweight and avoids duplicating merge logic across multiple tables.

### Alternatives considered
- Add a dedicated `PersonalizationProfile` table: rejected because it would duplicate identity resolution that already exists in `CustomerProfile`.
- Store all profile context only in ephemeral request memory: rejected because the feature explicitly requires reuse across sessions for identified shoppers.

## Create a dedicated customer-profile resolution module

### Decision
Introduce `app/lib/cart-intelligence/customer-profile.ts` as the owning module for signal normalization, explicit-input precedence, confidence scoring, and anonymous-to-identified merge behavior.

### Rationale
Today, the DB layer only exposes size-profile reads and writes. The broader customer-profile feature needs business logic that decides how to combine stored signals, session activity, explicit shopper input, and purchase summaries into one recommendation-ready context. That is recommendation-domain logic, not raw persistence, so it belongs in cart-intelligence rather than only in `queries.ts`.

### Alternatives considered
- Put all merge logic in `app/lib/db/queries.ts`: rejected because it would mix persistence concerns with recommendation-domain policy.
- Put all logic directly in `api.ai.recommendations.tsx`: rejected because the route should stay thin and reusable tests need a library surface.

## Keep purchase-history hydration out of the shopper request path

### Decision
Resolve customer profiles from locally persisted summary data during recommendation requests and refresh purchase-history summaries asynchronously or outside the shopper request path.

### Rationale
The constitution and PRD both emphasize low-latency shopper experiences. Live Shopify Admin API reads for customer orders on every recommendation request would add latency, increase rate-limit exposure, and complicate anonymous session handling. A summarized local representation keeps personalization deterministic and preserves room for future webhook- or job-based refresh flows.

### Alternatives considered
- Query Shopify Admin for order history during every recommendation request: rejected because it is too slow and too expensive for the cart path.
- Ignore purchase history entirely in v1: rejected because the feature explicitly requires returning-shopper context and repeat-customer noise reduction.

## Identity precedence and merge behavior

### Decision
Resolve customer context by `shopifyCustomerId` first, fall back to `sessionId` for anonymous sessions, and support merging anonymous session observations into the identified row once a shopper becomes known.

### Rationale
This matches the repo's current size-profile read/write behavior and satisfies the spec requirement that anonymous personalization remain session-scoped until a reliable identity exists. It also prevents shopper history from being split permanently when the same visitor begins anonymously and later signs in.

### Alternatives considered
- Treat anonymous and identified profiles as fully separate forever: rejected because it loses useful same-journey context after sign-in.
- Key all personalization only by session: rejected because it cannot preserve cross-session continuity for returning shoppers.

## Explicit input precedence and low-confidence suppression

### Decision
Treat explicit shopper-provided attributes as authoritative for the matching profile field, and downgrade personalization intensity when signals are sparse, stale, or conflicting.

### Rationale
The spec explicitly requires a correction path for gift buyers, mixed-discipline shoppers, and changed needs. Explicit inputs are the strongest available signal for the corresponding attribute. Separately, the feature must avoid presumptive guidance when the system cannot form a reliable view of the shopper.

### Alternatives considered
- Blend explicit inputs with inferred signals at equal weight: rejected because it can leave shopper-provided corrections diluted by stale history.
- Always personalize strongly if any historical data exists: rejected because it would overfit shared-device or changed-intent scenarios.

## Integrate personalization through the existing recommendation route

### Decision
Extend the recommendation request contract and payload shaping layer to consume personalization context, rather than building a separate cart-profile route for the same shopper flow.

### Rationale
The repo already exposes shopper-facing cart recommendation behavior through `api.ai.recommendations.tsx` and centralizes payload formatting in `app/lib/cart-intelligence/recommendations.ts`. Personalization should enrich those existing outputs so future bundle, threshold, size, and style recommendations can all consume the same resolved context.

### Alternatives considered
- Build a separate customer-profile route and have cart surfaces fan out to multiple APIs: rejected because it adds orchestration complexity and splits business logic.
- Keep personalization only as an internal DB concern: rejected because downstream recommendation builders need a stable, typed profile context.