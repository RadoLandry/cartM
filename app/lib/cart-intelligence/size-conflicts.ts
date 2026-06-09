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
    return buildResult([]);
  }

  for (let i = 0; i < cartItems.length; i++) {
    for (let j = i + 1; j < cartItems.length; j++) {
      const itemA = cartItems[i];
      const itemB = cartItems[j];

      if (shouldSkipPair(itemA, itemB)) {
        continue;
      }

      // Rule 1: child vs adult mismatch → ERROR (regardless of size values)
      if (itemA.isChildProduct !== itemB.isChildProduct) {
        conflicts.push(buildConflict("ERROR", "child_adult_mismatch", itemA, itemB, null, null));
        continue;
      }

      // Rule 2: Cross-size mapping check
      const mappings = await getCrossSizeMappingsForPair(
        shop,
        itemA.categoryTag,
        itemB.categoryTag,
      );

      if (mappings.length === 0) continue; // unmapped pair — skip

      const abMismatch = getMappedSizeMismatch(mappings, itemA, itemB);

      if (abMismatch) {
        conflicts.push(
          buildConflict(
            abMismatch.severity,
            "mapped_size_mismatch",
            itemA,
            itemB,
            abMismatch.expectedTargetSize,
            null,
          ),
        );
        continue;
      }

      const baMismatch = getMappedSizeMismatch(mappings, itemB, itemA);

      if (baMismatch) {
        conflicts.push(
          buildConflict(
            baMismatch.severity,
            "mapped_size_mismatch",
            itemA,
            itemB,
            null,
            baMismatch.expectedTargetSize,
          ),
        );
      }
    }
  }

  return buildResult(conflicts);
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function buildConflict(
  severity: "ERROR" | "WARNING",
  reasonType: "child_adult_mismatch" | "mapped_size_mismatch" | "measurement_rule_mismatch",
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
  let suggestions = [] as SizeConflict["suggestions"];

  if (severity === "ERROR") {
    const childItem = itemA.isChildProduct ? itemA : itemB;
    const adultItem = itemA.isChildProduct ? itemB : itemA;
    message = `Child-sized ${childItem.categoryTag} (${childItem.sizeValue}) mixed with adult-sized ${adultItem.categoryTag} (${adultItem.sizeValue}).`;
    suggestedCorrection = `Ensure both items use the same age range sizing.`;
    suggestions = rankSuggestions([
      createSuggestion(
        itemA.isChildProduct ? "itemB" : "itemA",
        adultItem.variantId,
        adultItem.sizeValue,
        childItem.sizeValue,
        0.95,
        "Use the same age-range sizing across paired protective gear.",
      ),
    ]);
  } else if (expectedSizeForB != null) {
    message = `${itemA.categoryTag} size ${itemA.sizeValue} typically pairs with ${itemB.categoryTag} size ${expectedSizeForB}, but ${itemB.sizeValue} is selected.`;
    suggestedCorrection = `Change ${itemB.categoryTag} to ${expectedSizeForB}, or ${itemA.categoryTag} to match ${itemB.sizeValue}.`;
    suggestions = rankSuggestions([
      createSuggestion(
        "itemB",
        itemB.variantId,
        itemB.sizeValue,
        expectedSizeForB,
        0.85,
        `${itemA.categoryTag} size ${itemA.sizeValue} maps to ${itemB.categoryTag} size ${expectedSizeForB}.`,
      ),
    ]);
  } else {
    message = `${itemB.categoryTag} size ${itemB.sizeValue} typically pairs with ${itemA.categoryTag} size ${expectedSizeForA}, but ${itemA.sizeValue} is selected.`;
    suggestedCorrection = `Change ${itemA.categoryTag} to ${expectedSizeForA}, or ${itemB.categoryTag} to match ${itemA.sizeValue}.`;
    suggestions = rankSuggestions([
      createSuggestion(
        "itemA",
        itemA.variantId,
        itemA.sizeValue,
        expectedSizeForA ?? itemA.sizeValue,
        0.85,
        `${itemB.categoryTag} size ${itemB.sizeValue} maps to ${itemA.categoryTag} size ${expectedSizeForA}.`,
      ),
    ]);
  }

  return {
    conflictKey: buildConflictKey(reasonType, itemA.variantId, itemB.variantId),
    severity,
    reasonType,
    itemA: conflictingA,
    itemB: conflictingB,
    message,
    suggestions,
    suggestedCorrection,
  };
}

function buildConflictKey(
  reasonType: SizeConflict["reasonType"],
  variantA: string,
  variantB: string,
): string {
  const [left, right] = [variantA, variantB].sort();
  return `${reasonType}:${left}:${right}`;
}

function buildResult(conflicts: SizeConflict[]): SizeConflictResult {
  const errorCount = conflicts.filter((conflict) => conflict.severity === "ERROR").length;
  const warningCount = conflicts.length - errorCount;

  return {
    conflicts,
    hasErrors: errorCount > 0,
    hasWarnings: warningCount > 0,
    summary: {
      total: conflicts.length,
      errorCount,
      warningCount,
    },
  };
}

function shouldSkipPair(itemA: CartItemForConflict, itemB: CartItemForConflict): boolean {
  return itemA.categoryTag === itemB.categoryTag || !hasComparableSize(itemA) || !hasComparableSize(itemB);
}

function hasComparableSize(item: CartItemForConflict): boolean {
  return item.sizeValue.trim().length > 0;
}

function getMappedSizeMismatch(
  mappings: Awaited<ReturnType<typeof getCrossSizeMappingsForPair>>,
  sourceItem: CartItemForConflict,
  targetItem: CartItemForConflict,
): { severity: "ERROR" | "WARNING"; expectedTargetSize: string } | null {
  const mapping = mappings.find(
    (row) =>
      row.sourceCategoryTag === sourceItem.categoryTag &&
      row.sourceSize === sourceItem.sizeValue &&
      row.targetCategoryTag === targetItem.categoryTag,
  );

  if (!mapping || mapping.targetSize === targetItem.sizeValue) {
    return null;
  }

  return {
    severity: mapping.severityOnMismatch as "ERROR" | "WARNING",
    expectedTargetSize: mapping.targetSize,
  };
}

function createSuggestion(
  targetItem: "itemA" | "itemB",
  currentVariantId: string,
  currentSize: string,
  suggestedSize: string,
  confidence: number,
  reason: string,
): SizeConflict["suggestions"][number] {
  return {
    targetItem,
    currentVariantId,
    currentSize,
    suggestedSize,
    availability: "unknown",
    confidence,
    reason,
  };
}

function rankSuggestions(
  suggestions: SizeConflict["suggestions"],
): SizeConflict["suggestions"] {
  const availabilityRank = {
    available: 0,
    unknown: 1,
    unavailable: 2,
  } as const;

  return [...suggestions].sort(
    (left, right) =>
      availabilityRank[left.availability] - availabilityRank[right.availability] ||
      right.confidence - left.confidence,
  );
}

// ---------------------------------------------------------------------------
// Checkout warning summaries (T038)
// ---------------------------------------------------------------------------

export interface CheckoutSizeWarningSummary {
  guidanceId: string;
  conflictKey: string;
  severity: "warning" | "critical";
  title: string;
  message: string;
  relatedLineIds: string[];
  suggestedCorrection?: string;
}

const HIGH_CONFIDENCE_SEVERITY_THRESHOLD = 0.8;

/**
 * Maps high-confidence size conflicts from a `SizeConflictResult` to compact
 * checkout warning summaries. Only ERROR conflicts and WARNING conflicts with
 * at least one suggestion >= HIGH_CONFIDENCE_SEVERITY_THRESHOLD are included.
 */
export function mapSizeConflictsToCheckoutWarningSummaries(
  result: SizeConflictResult,
  lineIdMap: Record<string, string[]> = {},
): CheckoutSizeWarningSummary[] {
  return result.conflicts
    .filter((conflict) => {
      if (conflict.severity === "ERROR") return true;
      return conflict.suggestions.some((s) => s.confidence >= HIGH_CONFIDENCE_SEVERITY_THRESHOLD);
    })
    .map((conflict) => {
      const variantIds = [conflict.itemA.variantId, conflict.itemB.variantId];
      const relatedLineIds = variantIds.flatMap((vid) => lineIdMap[vid] ?? []);

      return {
        guidanceId: `checkout-size-warning:${conflict.conflictKey}`,
        conflictKey: conflict.conflictKey,
        severity: conflict.severity === "ERROR" ? "critical" : "warning",
        title: conflict.severity === "ERROR" ? "Size mismatch — review your cart" : "Check size compatibility",
        message: conflict.message,
        relatedLineIds,
        ...(conflict.suggestedCorrection ? { suggestedCorrection: conflict.suggestedCorrection } : {}),
      } satisfies CheckoutSizeWarningSummary;
    });
}
