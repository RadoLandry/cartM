# Contract: Merchant Size Compatibility Admin

## Purpose

Define the loader and action contract for the size compatibility controls inside the existing knowledge-graph admin route.

## Loader shape

```ts
type SizeChartAdminRow = {
  id: string;
  categoryTag: string;
  sizeSystem: string;
  source: "AUTO" | "MERCHANT";
  breakpointCount: number;
  hasOverride: boolean;
};

type CrossSizeMappingAdminRow = {
  id: string;
  sourceCategoryTag: string;
  sourceSize: string;
  targetCategoryTag: string;
  targetSize: string;
  severityOnMismatch: "WARNING" | "ERROR";
  source: "AUTO" | "MERCHANT";
};

type CompatibilityPreviewResult = {
  evaluated: boolean;
  severity?: "WARNING" | "ERROR";
  expectedSize?: string;
  message?: string;
};

type SizeCompatibilityAdminLoaderData = {
  sizeCharts: SizeChartAdminRow[];
  crossSizeMappings: CrossSizeMappingAdminRow[];
  categoryTags: string[];
  preview?: CompatibilityPreviewResult;
};
```

## Supported actions

### `save-size-chart-override`

```ts
{
  intent: "save-size-chart-override";
  sizeChartId: string;
  overrideBreakpoints: Array<{
    label: string;
    attributeType: string;
    min: number | null;
    max: number | null;
    note?: string;
  }>;
}
```

Behavior:
- Validates payload with Zod.
- Replaces the existing override breakpoint array for the selected chart.

### `reset-size-chart-override`

```ts
{
  intent: "reset-size-chart-override";
  sizeChartId: string;
}
```

Behavior:
- Removes merchant override breakpoints and returns the chart to `AUTO` source behavior.

### `create-cross-size-mapping`

```ts
{
  intent: "create-cross-size-mapping";
  sourceCategoryTag: string;
  sourceSize: string;
  targetCategoryTag: string;
  targetSize: string;
  severityOnMismatch: "WARNING" | "ERROR";
}
```

Behavior:
- Validates payload with Zod.
- Creates a merchant-owned mapping for the category pair.
- Rejects duplicates with a non-throwing action error.

### `delete-cross-size-mapping`

```ts
{
  intent: "delete-cross-size-mapping";
  mappingId: string;
}
```

Behavior:
- Deletes the selected mapping row.

### `preview-cross-size-conflict`

```ts
{
  intent: "preview-cross-size-conflict";
  sourceCategoryTag: string;
  sourceSize: string;
  targetCategoryTag: string;
  targetSize: string;
}
```

Behavior:
- Validates payload with Zod.
- Runs read-only conflict evaluation for the provided pair.
- Returns an inline preview without persisting changes.

## Error model

All actions return:

```ts
{ ok: true }
```

or

```ts
{ ok: false; error: string }
```

Validation failures and duplicate mappings must be returned as non-throwing action errors.
