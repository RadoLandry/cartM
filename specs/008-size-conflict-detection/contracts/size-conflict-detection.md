# Contract: Size Conflict Detection

This contract defines the canonical request and result shape for cart-level size conflict analysis.

## Consumers

- `app/lib/cart-intelligence/size-conflicts.ts`
- `app/lib/cart-intelligence/recommendations.ts`
- Storefront cart consumers that render pre-computed conflict payloads
- Checkout consumers that display warnings from backend-generated analysis

## Input

```ts
interface SizeConflictRequest {
  shop: string;
  cartItems: CartItemForConflict[];
}

interface CartItemForConflict {
  productId: string;
  variantId: string;
  categoryTag: string;
  sizeValue: string;
  sizeCategory: string;
  isChildProduct: boolean;
  title?: string;
  inventoryQuantity?: number | null;
  sizeNumeric?: number | null;
}
```

## Output

```ts
interface SizeConflictResult {
  conflicts: SizeConflict[];
  hasErrors: boolean;
  hasWarnings: boolean;
  summary: {
    total: number;
    errorCount: number;
    warningCount: number;
  };
}

interface SizeConflict {
  conflictKey: string;
  severity: "ERROR" | "WARNING";
  reasonType: "child_adult_mismatch" | "mapped_size_mismatch" | "measurement_rule_mismatch";
  itemA: ConflictingItem;
  itemB: ConflictingItem;
  message: string;
  suggestions: SizeConflictSuggestion[];
}

interface ConflictingItem {
  productId: string;
  variantId: string;
  categoryTag: string;
  selectedSize: string;
  expectedSize?: string;
}

interface SizeConflictSuggestion {
  targetItem: "itemA" | "itemB";
  currentVariantId: string;
  currentSize: string;
  suggestedSize: string;
  suggestedVariantId?: string;
  availability: "available" | "unavailable" | "unknown";
  confidence: number;
  reason: string;
}
```

## Behaviour Rules

1. Compare each distinct pair of cart items that can be evaluated with deterministic evidence.
2. If one item is child-sized and the other is adult-sized, emit an `ERROR` conflict immediately.
3. If a `CrossSizeMapping` exists for the category pair and the mapped expected size differs from the selected size, emit a conflict using the mapping's severity.
4. If the category pair relies on a supported normalized size rule from `SizeChart`, the detector may use that rule to explain or classify the mismatch.
5. When neither a mapping nor supported normalization rule exists, skip the pair silently.
6. A cart with zero or one size-relevant item MUST return no conflicts.
7. Each conflict MUST have a stable `conflictKey` so downstream consumers can reconcile state across reruns.
8. `suggestions` MAY be empty when a mismatch is real but no safe corrective action can be inferred.
9. A suggestion with `availability: "unavailable"` or `"unknown"` MUST NOT be promoted as the primary shopper action.
10. Multiple unrelated conflicts in the same cart MUST be returned separately.

## Error Conditions

| Condition | Behaviour |
|---|---|
| Empty cart or single size-relevant item | Return empty `conflicts`, `hasErrors: false`, `hasWarnings: false` |
| Missing `sizeValue` on either item | Skip the pair, no conflict emitted |
| No mapping or supported normalization rule for the pair | Skip the pair, no conflict emitted |
| Expected corrective size exists but has no available variant | Keep the conflict, include at most a non-primary unavailable suggestion |
| Invalid cart item payload | Reject at the boundary before calling detection logic |
