import { getCrossSizeMappingsForPair } from "../db/queries";
import type {
  CartItemForConflict,
  SizeConflict,
  SizeConflictRequest,
  SizeConflictResult,
  ConflictingItem,
} from "../knowledge-graph/sizing";

export type {
  CartItemForConflict,
  SizeConflict,
  SizeConflictRequest,
  SizeConflictResult,
  ConflictingItem,
};

/**
 * Detect cross-product size conflicts in a cart.
 *
 * For each distinct pair of cart items with different categoryTags:
 * 1. If isChildProduct differs → emit ERROR (adult vs child sizing mismatch).
 * 2. Look up CrossSizeMapping for (shop, catA, sizeA, catB).
 *    If the mapping's targetSize ≠ actual sizeB → emit WARNING.
 * 3. No mapping for the pair → skip silently.
 *
 * A cart with 0 or 1 items always returns empty conflicts.
 */
export async function detectSizeConflicts(
  request: SizeConflictRequest,
): Promise<SizeConflictResult> {
  const { shop, cartItems } = request;
  const conflicts: SizeConflict[] = [];

  if (!cartItems || cartItems.length <= 1) {
    return { conflicts: [], hasErrors: false, hasWarnings: false };
  }

  for (let i = 0; i < cartItems.length; i++) {
    for (let j = i + 1; j < cartItems.length; j++) {
      const itemA = cartItems[i];
      const itemB = cartItems[j];

      // Only compare items with different category tags
      if (itemA.categoryTag === itemB.categoryTag) continue;

      // Skip if sizeValue is missing or empty on either item
      if (!itemA.sizeValue || !itemB.sizeValue) continue;

      // Rule 1: child vs adult mismatch → ERROR (regardless of size values)
      if (itemA.isChildProduct !== itemB.isChildProduct) {
        conflicts.push(buildConflict("ERROR", itemA, itemB, null, null));
        continue;
      }

      // Rule 2: Cross-size mapping check
      const mappings = await getCrossSizeMappingsForPair(
        shop,
        itemA.categoryTag,
        itemB.categoryTag,
      );

      if (mappings.length === 0) continue; // unmapped pair — skip

      // Check mapping from A→B
      const abMapping = mappings.find(
        (m) =>
          m.sourceCategoryTag === itemA.categoryTag &&
          m.sourceSize === itemA.sizeValue &&
          m.targetCategoryTag === itemB.categoryTag,
      );

      if (abMapping && abMapping.targetSize !== itemB.sizeValue) {
        conflicts.push(
          buildConflict(
            abMapping.severityOnMismatch as "ERROR" | "WARNING",
            itemA,
            itemB,
            abMapping.targetSize,
            null,
          ),
        );
        continue;
      }

      // Check mapping from B→A
      const baMapping = mappings.find(
        (m) =>
          m.sourceCategoryTag === itemB.categoryTag &&
          m.sourceSize === itemB.sizeValue &&
          m.targetCategoryTag === itemA.categoryTag,
      );

      if (baMapping && baMapping.targetSize !== itemA.sizeValue) {
        conflicts.push(
          buildConflict(
            baMapping.severityOnMismatch as "ERROR" | "WARNING",
            itemA,
            itemB,
            null,
            baMapping.targetSize,
          ),
        );
      }
    }
  }

  return {
    conflicts,
    hasErrors: conflicts.some((c) => c.severity === "ERROR"),
    hasWarnings: conflicts.some((c) => c.severity === "WARNING"),
  };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function buildConflict(
  severity: "ERROR" | "WARNING",
  itemA: CartItemForConflict,
  itemB: CartItemForConflict,
  /** Expected size for itemB (from A→B mapping) */
  expectedSizeForB: string | null,
  /** Expected size for itemA (from B→A mapping) */
  expectedSizeForA: string | null,
): SizeConflict {
  const conflictingA: ConflictingItem = {
    productId: itemA.productId,
    variantId: itemA.variantId,
    categoryTag: itemA.categoryTag,
    selectedSize: itemA.sizeValue,
    ...(expectedSizeForA != null ? { expectedSize: expectedSizeForA } : {}),
  };

  const conflictingB: ConflictingItem = {
    productId: itemB.productId,
    variantId: itemB.variantId,
    categoryTag: itemB.categoryTag,
    selectedSize: itemB.sizeValue,
    ...(expectedSizeForB != null ? { expectedSize: expectedSizeForB } : {}),
  };

  let message: string;
  let suggestedCorrection: string | undefined;

  if (severity === "ERROR") {
    const childItem = itemA.isChildProduct ? itemA : itemB;
    const adultItem = itemA.isChildProduct ? itemB : itemA;
    message = `Child-sized ${childItem.categoryTag} (${childItem.sizeValue}) mixed with adult-sized ${adultItem.categoryTag} (${adultItem.sizeValue}).`;
    suggestedCorrection = `Ensure both items use the same age range sizing.`;
  } else if (expectedSizeForB != null) {
    message = `${itemA.categoryTag} size ${itemA.sizeValue} typically pairs with ${itemB.categoryTag} size ${expectedSizeForB}, but ${itemB.sizeValue} is selected.`;
    suggestedCorrection = `Change ${itemB.categoryTag} to ${expectedSizeForB}, or ${itemA.categoryTag} to match ${itemB.sizeValue}.`;
  } else {
    message = `${itemB.categoryTag} size ${itemB.sizeValue} typically pairs with ${itemA.categoryTag} size ${expectedSizeForA}, but ${itemA.sizeValue} is selected.`;
    suggestedCorrection = `Change ${itemA.categoryTag} to ${expectedSizeForA}, or ${itemB.categoryTag} to match ${itemA.sizeValue}.`;
  }

  return {
    severity,
    itemA: conflictingA,
    itemB: conflictingB,
    message,
    suggestedCorrection,
  };
}
