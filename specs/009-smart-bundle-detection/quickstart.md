# Quickstart: Smart Bundle Detection

## What This Feature Adds

- Prisma-backed bundle rule persistence for merchant-authored offers
- Deterministic cart-level bundle matching for qualified and near-complete states
- Shopper-facing bundle opportunity payloads for cart and future checkout consumers
- A dedicated Polaris bundle manager route for CRUD and preview workflows
- A compact active-rule projection for downstream Shopify discount/cart-transform integration

## Local Development Setup

### 1. Apply the Prisma schema changes

This feature adds new bundle models. Apply pending migrations before testing locally:

```bash
npx prisma migrate dev
```

### 2. Start the app

```bash
npm run dev
```

Open the embedded admin and confirm the new **Bundles** route loads with Polaris UI.

### 3. Run focused unit tests

```bash
npx vitest run tests/unit/cart-intelligence/bundle-detection.test.ts
```

After the shopper payload builder is added, run:

```bash
npx vitest run tests/unit/cart-intelligence/bundle-recommendations.test.ts
```

### 4. Run the admin integration slice

```bash
npx vitest run tests/integration/routes/bundle-rule-manager.test.ts
```

### 5. Verify a near-complete bundle manually

Create an active bundle rule such as `boxing-starter-bundle`, add a subset of its required products to a local cart fixture, and confirm:
- the matcher reports `nearly_complete`
- the missing component quantity is correct
- the shopper payload only proposes available completion candidates

## Key Files

| File | Purpose |
|---|---|
| `app/lib/cart-intelligence/bundles.ts` | Core deterministic bundle matcher and overlap handling |
| `app/lib/cart-intelligence/recommendations.ts` | Shopper-facing bundle opportunity payload builder |
| `app/lib/knowledge-graph/bundles.ts` | Shared bundle contracts and seed helpers |
| `app/lib/db/queries.ts` | Bundle rule CRUD, reads, and projection helpers |
| `app/routes/app.bundles.tsx` | Polaris admin surface for bundle rule management |
| `prisma/schema.prisma` | Persisted bundle rule models and enums |
| `tests/unit/cart-intelligence/bundle-detection.test.ts` | Matcher and overlap regression tests |
| `tests/unit/cart-intelligence/bundle-recommendations.test.ts` | Shopper payload prioritization tests |
| `tests/integration/routes/bundle-rule-manager.test.ts` | Admin loader/action integration tests |

## Common Tasks

### Add or adjust a bundle rule

Use the **Bundles** admin route to create or update the rule shell, then add required and optional components. The next cart analysis should use the updated active rule set.

### Validate overlap handling

Create two active rules that share one or more qualifying components and run the bundle detection test slice. Confirm both opportunities are returned but marked as competing offers.

### Confirm unavailable completion paths are suppressed

Mark the preferred missing component candidate as unavailable in local variant data and rerun the recommendation payload tests. The bundle may still be `nearly_complete`, but the shopper payload must not present an unavailable item as an actionable completion step.

### Exercise the function-ready projection

Use active bundle fixtures and the projection helper to verify the emitted payload contains only deterministic rule data required by downstream Shopify runtime consumers.