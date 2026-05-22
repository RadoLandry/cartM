# Contract: Merchant Visual Admin

## Purpose

Define the loader and action contract for the `Colorways` tab inside the knowledge-graph admin route.

## Loader shape

```ts
type VisualAdminRow = {
  productId: string;
  shopifyProductId: string;
  title: string;
  handle: string;
  detectedColorwayKeys: string[];
  effectiveColorwayKeys: string[];
  detectedCollections: Array<{ key: string; label: string }>;
  effectiveCollections: Array<{ key: string; label: string }>;
  visualConfidence: number | null;
  reviewStatus: "NEEDS_REVIEW" | "AUTO_APPROVED" | "MERCHANT_REVIEWED";
  source: "AUTO" | "MERCHANT" | "HYBRID";
};

type ColorCompatibilityRuleRow = {
  id: string;
  sourceColorwayKey: string;
  targetColorwayKey: string;
  compatibility: "MATCHING" | "COMPLEMENTARY" | "NEUTRAL" | "AVOID";
  rationale?: string | null;
};

type VisualAdminLoaderData = {
  products: VisualAdminRow[];
  lowConfidenceCount: number;
  compatibilityRules: ColorCompatibilityRuleRow[];
};
```

## Supported actions

### `save-visual-override`

```ts
{
  intent: "save-visual-override";
  productId: string;
  overrideColorwayKeys: string[];
  overrideCollections: Array<{ key: string; label: string }>;
}
```

Behavior:
- Validates the payload with Zod.
- Upserts the merchant override fields on the product visual profile.
- Marks `reviewStatus = MERCHANT_REVIEWED`.

### `reset-visual-override`

```ts
{
  intent: "reset-visual-override";
  productId: string;
}
```

Behavior:
- Clears merchant overrides.
- Reverts the effective values to detected values.

### `save-compatibility-rule`

```ts
{
  intent: "save-compatibility-rule";
  sourceColorwayKey: string;
  targetColorwayKey: string;
  compatibility: "MATCHING" | "COMPLEMENTARY" | "NEUTRAL" | "AVOID";
  rationale?: string;
}
```

### `delete-compatibility-rule`

```ts
{
  intent: "delete-compatibility-rule";
  ruleId: string;
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