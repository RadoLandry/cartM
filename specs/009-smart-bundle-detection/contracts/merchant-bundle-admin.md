# Contract: Merchant Bundle Admin

This contract defines the admin route boundary for managing bundle rules in the embedded Shopify app.

## Consumers

- `app/routes/app.bundles.tsx`
- `app/lib/db/queries.ts`
- integration tests covering loader and action behavior

## Loader Contract

```ts
interface BundleAdminLoaderData {
  bundleRules: BundleRuleAdminRow[];
  products: Array<{
    id: string;
    shopifyProductId: string;
    title: string;
    categoryTags: string[];
    disciplineTags: string[];
  }>;
  categoryTags: string[];
}

interface BundleRuleAdminRow {
  id: string;
  key: string;
  label: string;
  description?: string | null;
  status: "ACTIVE" | "DRAFT" | "ARCHIVED";
  priority: number;
  completionThreshold: number;
  discountType: "PERCENTAGE" | "FIXED";
  discountValue: string;
  components: BundleRuleComponentAdminRow[];
}

interface BundleRuleComponentAdminRow {
  id: string;
  componentKey: string;
  label: string;
  isRequired: boolean;
  sortOrder: number;
  minQuantity: number;
  matchMode: "CATEGORY" | "PRODUCT" | "VARIANT" | "CATEGORY_OR_PRODUCT";
  acceptedCategoryTags: string[];
  acceptedShopifyProductIds: string[];
  acceptedShopifyVariantIds: string[];
}
```

## Action Intents

### `save-bundle-rule`

Create or update a bundle rule shell.

```ts
interface SaveBundleRuleInput {
  id?: string;
  key: string;
  label: string;
  description?: string;
  status: "ACTIVE" | "DRAFT" | "ARCHIVED";
  priority: number;
  completionThreshold: number;
  discountType: "PERCENTAGE" | "FIXED";
  discountValue: string;
}
```

### `save-bundle-component`

Create or update a bundle component under a rule.

```ts
interface SaveBundleComponentInput {
  id?: string;
  bundleRuleId: string;
  componentKey: string;
  label: string;
  isRequired: boolean;
  sortOrder: number;
  minQuantity: number;
  matchMode: "CATEGORY" | "PRODUCT" | "VARIANT" | "CATEGORY_OR_PRODUCT";
  acceptedCategoryTags: string[];
  acceptedShopifyProductIds: string[];
  acceptedShopifyVariantIds: string[];
}
```

### `delete-bundle-component`

Remove one component from a rule.

```ts
interface DeleteBundleComponentInput {
  componentId: string;
}
```

### `archive-bundle-rule`

Archive one bundle rule and exclude it from active detection.

```ts
interface ArchiveBundleRuleInput {
  bundleRuleId: string;
}
```

### `preview-bundle-rule`

Run a deterministic preview against a supplied cart fixture without saving shopper state.

```ts
interface PreviewBundleRuleInput {
  bundleRuleId: string;
  cartFixture: Array<{
    productId: string;
    variantId: string;
    quantity: number;
  }>;
}
```

## Behaviour Rules

1. All action payloads must be validated with Zod before any database write or preview execution.
2. A rule may not be set `ACTIVE` unless it has at least one required component and valid discount metadata.
3. Component keys must remain unique within a rule.
4. Preview execution must use the same matcher contract as shopper-facing bundle detection.
5. Archived rules must remain visible in admin lists but excluded from active detection and projection.

## Error Conditions

| Condition | Behaviour |
|---|---|
| Duplicate bundle key for the same shop | Reject with validation or unique-constraint-safe error |
| Invalid threshold outside `0 < threshold <= 1` | Reject at action boundary |
| Active rule with no required components | Reject at action boundary |
| Preview request references unknown rule | Return `ok: false` with route-safe error payload |