# Contract: Merchant Kit Admin

## Purpose

Define the loader and action contract for the `Kits` tab inside the knowledge-graph admin route.

## Loader shape

```ts
type KitRequirementAdminRow = {
  id: string;
  requirementKey: string;
  label: string;
  isRequired: boolean;
  priority: number;
  safetyCritical: boolean;
  matchMode: "CATEGORY" | "PRODUCT" | "CATEGORY_OR_PRODUCT" | "PRODUCT_OR_ALTERNATIVE";
  acceptedCategoryTags: string[];
  acceptedShopifyProductIds: string[];
  acceptedRelationshipTypes: Array<"COMPLEMENTS" | "ALTERNATIVES">;
  minQuantity: number;
};

type KitDefinitionAdminRow = {
  id: string;
  key: string;
  label: string;
  disciplineTag: string;
  description?: string | null;
  source: "AUTO" | "MERCHANT" | "HYBRID";
  status: "ACTIVE" | "DRAFT" | "ARCHIVED";
  requirements: KitRequirementAdminRow[];
};

type KitAdminLoaderData = {
  kits: KitDefinitionAdminRow[];
  availableCategoryTags: string[];
  availableProducts: Array<{
    shopifyProductId: string;
    title: string;
    disciplineTags: string[];
    categoryTags: string[];
  }>;
};
```

## Supported actions

### `save-kit-definition`

```ts
{
  intent: "save-kit-definition";
  kitId?: string;
  key: string;
  label: string;
  disciplineTag: string;
  description?: string;
  status: "ACTIVE" | "DRAFT" | "ARCHIVED";
}
```

Behavior:
- Validates the payload with Zod.
- Creates or updates the top-level kit definition.

### `save-kit-requirement`

```ts
{
  intent: "save-kit-requirement";
  kitId: string;
  requirementId?: string;
  requirementKey: string;
  label: string;
  isRequired: boolean;
  priority: number;
  safetyCritical: boolean;
  matchMode: "CATEGORY" | "PRODUCT" | "CATEGORY_OR_PRODUCT" | "PRODUCT_OR_ALTERNATIVE";
  acceptedCategoryTags: string[];
  acceptedShopifyProductIds: string[];
  acceptedRelationshipTypes: Array<"COMPLEMENTS" | "ALTERNATIVES">;
  minQuantity: number;
}
```

Behavior:
- Validates the payload with Zod.
- Upserts a requirement row for the selected kit.

### `delete-kit-requirement`

```ts
{
  intent: "delete-kit-requirement";
  requirementId: string;
}
```

### `archive-kit-definition`

```ts
{
  intent: "archive-kit-definition";
  kitId: string;
}
```

## Error model

All actions return:

```ts
{ ok: true }
```

or

```ts
{ ok: false; error: string }
```

Validation failures must be returned as non-throwing action errors.