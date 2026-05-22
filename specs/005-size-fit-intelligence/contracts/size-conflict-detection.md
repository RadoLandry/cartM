# Contract: Size Conflict Detection Read Model

This contract describes the interface used to check a set of cart items for cross-product size conflicts.

## Consumer

- Cart intelligence layer (`app/lib/cart-intelligence/size-conflicts.ts`)
- Checkout UI Extension (consumes pre-computed results stored in product metafields)

---

## Input

```typescript
interface SizeConflictRequest {
  shop: string;
  cartItems: CartItemForConflict[];
}

interface CartItemForConflict {
  productId: string;      // internal CartMind product ID
  variantId: string;      // internal CartMind variant ID
  categoryTag: string;    // e.g., "clothing", "gloves_oz"
  sizeValue: string;      // selected size label (e.g., "M", "16oz")
  sizeCategory: string;   // same as categoryTag — for compatibility
  isChildProduct: boolean; // true if the SKU is categorized as youth/junior sizing
}
```

## Output

```typescript
interface SizeConflictResult {
  conflicts: SizeConflict[];
  hasErrors: boolean;    // true if any conflict has severity ERROR
  hasWarnings: boolean;  // true if any conflict has severity WARNING
}

interface SizeConflict {
  severity: "ERROR" | "WARNING";
  itemA: ConflictingItem;
  itemB: ConflictingItem;
  message: string;            // human-readable description (e.g., "Medium rashguard may not match XL shorts")
  suggestedCorrection?: string; // e.g., "Change rashguard to XL, or shorts to M"
}

interface ConflictingItem {
  productId: string;
  variantId: string;
  categoryTag: string;
  selectedSize: string;
  expectedSize?: string; // the size the mapping says it should be
}
```

## Behaviour Rules

1. Compare each distinct pair of cart items that have different `categoryTag` values.
2. For each pair, look up `CrossSizeMapping` for `(shop, catA, sizeA, catB)` — if the mapping's `targetSize` ≠ `sizeB`, emit a conflict.
3. If either item has `isChildProduct: true` and the other has `isChildProduct: false`, emit an `ERROR`-level conflict regardless of size mapping.
4. When no `CrossSizeMapping` exists for a pair, skip that pair silently — no conflict is emitted for unmapped categories.
5. A cart with one item or zero items MUST return an empty `conflicts` array.
6. All validation is done against pre-loaded `CrossSizeMapping` rows — no per-request DB writes.

## Error Conditions

| Condition | Behaviour |
|---|---|
| `cartItems` is empty or has one item | Return empty `conflicts`, `hasErrors: false`, `hasWarnings: false` |
| `categoryTag` not present in `CrossSizeMapping` for a pair | Skip pair, no conflict emitted |
| Invalid or missing `sizeValue` | Skip that item for conflict checks; do not crash |
