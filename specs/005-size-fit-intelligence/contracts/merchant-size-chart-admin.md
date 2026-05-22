# Contract: Merchant Size Chart Admin API

This contract describes the admin-facing actions used by the size chart editor tab in the knowledge-graph admin route.

## Consumer

- `app/routes/app.knowledge-graph.tsx` (Remix action/loader pattern)

---

## Loader Response

**Route**: `GET /app/knowledge-graph?tab=sizing`

```typescript
interface SizingAdminLoaderData {
  sizeCharts: SizeChartRow[];
  crossSizeMappings: CrossSizeMappingRow[];
  categoryTags: string[];  // all distinct categoryTag values from ProductVariant for this shop
}

interface SizeChartRow {
  id: string;
  categoryTag: string;
  sizeSystem: string;
  breakpoints: SizeBreakpoint[];         // auto-generated baseline
  overrideBreakpoints: SizeBreakpoint[] | null; // null = no merchant override
  source: "AUTO" | "MERCHANT";
  version: number;
  updatedAt: string; // ISO 8601
}

interface SizeBreakpoint {
  label: string;
  attributeType: string;
  min: number;
  max: number;
  note?: string;
}

interface CrossSizeMappingRow {
  id: string;
  sourceCategoryTag: string;
  sourceSize: string;
  targetCategoryTag: string;
  targetSize: string;
  severityOnMismatch: "WARNING" | "ERROR";
  source: "AUTO" | "MERCHANT";
}
```

## Actions

### Save size chart override

**Intent**: `"save-size-chart-override"`

```typescript
interface SaveSizeChartOverrideInput {
  intent: "save-size-chart-override";
  sizeChartId: string;
  overrideBreakpoints: SizeBreakpoint[]; // must be non-empty array
}
```

**Validation rules**: `overrideBreakpoints` must be a valid JSON array with at least one entry; each entry must have `label` (non-empty string), `attributeType` (from allowed enum), `min` (number), `max` (number ≥ min). On success returns `{ ok: true }`.

---

### Reset size chart override

**Intent**: `"reset-size-chart-override"`

```typescript
interface ResetSizeChartOverrideInput {
  intent: "reset-size-chart-override";
  sizeChartId: string;
}
```

Sets `overrideBreakpoints` to `null`, reverting to the auto-generated baseline. Returns `{ ok: true }`.

---

### Create cross-size mapping

**Intent**: `"create-cross-size-mapping"`

```typescript
interface CreateCrossSizeMappingInput {
  intent: "create-cross-size-mapping";
  sourceCategoryTag: string;
  sourceSize: string;
  targetCategoryTag: string;
  targetSize: string;
  severityOnMismatch: "WARNING" | "ERROR";
}
```

**Validation rules**: `sourceCategoryTag` and `targetCategoryTag` must be distinct non-empty strings. Uniqueness constraint: `(shop, sourceCategoryTag, sourceSize, targetCategoryTag)` must not already exist.

---

### Delete cross-size mapping

**Intent**: `"delete-cross-size-mapping"`

```typescript
interface DeleteCrossSizeMappingInput {
  intent: "delete-cross-size-mapping";
  mappingId: string;
}
```

Hard-deletes the mapping record. Returns `{ ok: true }`.

---

## Security

All actions are served through the authenticated Shopify App admin route. `shopify.authenticate.admin(request)` MUST be called at the top of the action handler. The `shop` parameter is always derived from the authenticated session, never from user input.
