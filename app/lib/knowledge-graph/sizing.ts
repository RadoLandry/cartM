import {
  getSizeChartForCategory,
  getUnprocessedReturnsByCategoryForShop,
  markReturnRecordsProcessed,
  upsertSizeChart,
} from "../db/queries";

// Re-export conflict detection so cart intelligence consumers can import
// from a single knowledge-graph module entry point.
export { detectSizeConflicts } from "../cart-intelligence/size-conflicts";

// ---------------------------------------------------------------------------
// Shared TypeScript interfaces — Size & Fit Intelligence
// ---------------------------------------------------------------------------

export interface SizeBreakpoint {
  label: string;
  attributeType: "weightKg" | "chestCm" | "waistCm" | "weightClass" | string;
  min: number | null;
  max: number | null;
  note?: string;
}

export interface SizeRecommendationRequest {
  shop: string;
  productId: string;
  categoryTag: string;
  sizeSystem: string;
  customerAttributes?: {
    weightKg?: number;
    chestCm?: number;
    waistCm?: number;
    weightClass?: string;
  };
  knownSizes?: Record<string, string>;
}

export interface SizeRecommendationResult {
  recommended: string | null;
  rationale: string | null;
  confidence: "high" | "medium" | "low";
  source: "profile" | "chart" | "none";
  alternatives?: string[];
}

export interface CartItemForConflict {
  productId: string;
  variantId: string;
  categoryTag: string;
  sizeValue: string;
  sizeCategory: string;
  isChildProduct: boolean;
}

export interface SizeConflictRequest {
  shop: string;
  cartItems: CartItemForConflict[];
}

export interface ConflictingItem {
  productId: string;
  variantId: string;
  categoryTag: string;
  selectedSize: string;
  expectedSize?: string;
}

export interface SizeConflict {
  severity: "ERROR" | "WARNING";
  itemA: ConflictingItem;
  itemB: ConflictingItem;
  message: string;
  suggestedCorrection?: string;
}

export interface SizeConflictResult {
  conflicts: SizeConflict[];
  hasErrors: boolean;
  hasWarnings: boolean;
}

// ---------------------------------------------------------------------------
// Size Recommendation
// ---------------------------------------------------------------------------

/**
 * Return a size recommendation for a given product + customer profile.
 *
 * Resolution order:
 *  1. Known size from customer profile (knownSizes[categoryTag]) → source "profile", confidence "high"
 *  2. SizeChart breakpoint lookup using customerAttributes → source "chart"
 *     - Exact match within (min, max] → confidence "high"
 *     - Falls exactly on a boundary between two breakpoints → larger size, confidence "medium"
 *  3. No chart or attributes available → recommended null, source "none", confidence "low"
 *
 * Merchant overrideBreakpoints always take precedence over system breakpoints.
 */
export async function getSizeRecommendation(
  request: SizeRecommendationRequest,
): Promise<SizeRecommendationResult> {
  const { shop, categoryTag, sizeSystem, customerAttributes, knownSizes } = request;

  // Step 1 — profile hit
  if (knownSizes && knownSizes[categoryTag]) {
    return {
      recommended: knownSizes[categoryTag],
      rationale: "Based on your saved size profile.",
      confidence: "high",
      source: "profile",
    };
  }

  // Step 2 — chart lookup
  const chart = await getSizeChartForCategory(shop, categoryTag, sizeSystem);
  if (chart && customerAttributes) {
    const rawBreakpoints = (chart.overrideBreakpoints ?? chart.breakpoints) as unknown as SizeBreakpoint[];

    if (Array.isArray(rawBreakpoints) && rawBreakpoints.length > 0) {
      const result = lookupBreakpoints(rawBreakpoints, customerAttributes);
      if (result) {
        return result;
      }
    }
  }

  // Step 3 — no data available
  return {
    recommended: null,
    rationale: null,
    confidence: "low",
    source: "none",
  };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

type CustomerAttributes = NonNullable<SizeRecommendationRequest["customerAttributes"]>;

function lookupBreakpoints(
  breakpoints: SizeBreakpoint[],
  attrs: CustomerAttributes,
): SizeRecommendationResult | null {
  // Find breakpoints with matching attributeType that have a relevant customer value
  const relevant = breakpoints.filter((bp) => {
    const val = getAttrValue(attrs, bp.attributeType);
    return val !== undefined;
  });

  if (relevant.length === 0) return null;

  // Use the first matching attributeType group
  const attrType = relevant[0].attributeType;
  const group = breakpoints.filter((bp) => bp.attributeType === attrType);
  const value = getAttrValue(attrs, attrType) as number | string;

  if (typeof value === "string") {
    // weightClass — exact string match
    const match = group.find((bp) => bp.label === value || bp.note === value);
    if (match) {
      return {
        recommended: match.label,
        rationale: `Matched your ${attrType}: ${value}.`,
        confidence: "high",
        source: "chart",
      };
    }
    return null;
  }

  // Numeric breakpoint lookup: breakpoints must be ordered by min ascending
  const sorted = [...group].sort((a, b) => (a.min ?? -Infinity) - (b.min ?? -Infinity));

  let onBoundary = false;
  let boundaryIndex = -1;

  for (let i = 0; i < sorted.length; i++) {
    const bp = sorted[i];
    const lo = bp.min ?? -Infinity;
    const hi = bp.max ?? Infinity;

    // Exact boundary between this and previous breakpoint
    if (i > 0 && value === lo) {
      onBoundary = true;
      boundaryIndex = i; // index of the larger breakpoint
      break;
    }

    if (value >= lo && value < hi) {
      return {
        recommended: bp.label,
        rationale: `Recommended for your ${attrType} of ${value}.`,
        confidence: "high",
        source: "chart",
      };
    }

    // Exact match at upper boundary of last breakpoint
    if (i === sorted.length - 1 && value === hi) {
      return {
        recommended: bp.label,
        rationale: `Recommended for your ${attrType} of ${value}.`,
        confidence: "high",
        source: "chart",
      };
    }
  }

  if (onBoundary && boundaryIndex > 0) {
    const larger = sorted[boundaryIndex];
    const smaller = sorted[boundaryIndex - 1];
    return {
      recommended: larger.label,
      rationale: `Your ${attrType} of ${value} falls on the boundary — recommending the larger size.`,
      confidence: "medium",
      source: "chart",
      alternatives: [smaller.label, larger.label],
    };
  }

  return null;
}

function getAttrValue(
  attrs: CustomerAttributes,
  attrType: string,
): number | string | undefined {
  switch (attrType) {
    case "weightKg": return attrs.weightKg;
    case "chestCm": return attrs.chestCm;
    case "waistCm": return attrs.waistCm;
    case "weightClass": return attrs.weightClass;
    default: return undefined;
  }
}

// ---------------------------------------------------------------------------
// Return-data size chart adjustment
// ---------------------------------------------------------------------------

export interface SizeAdjustmentResult {
  categoryTag: string;
  sizeSystem: string;
  adjusted: boolean;
  reason: string;
  processedRecordIds: string[];
}

/**
 * Examine unprocessed return records for a category and shift breakpoints
 * when a statistically significant bias is detected.
 *
 * Rules:
 * - Minimum `minSamples` records required before any adjustment is made.
 * - Only adjusts the AUTO breakpoints (never touches overrideBreakpoints).
 * - A size is "too large" when >60% of returns for that size cite "too_large" reason.
 * - Adjustment: shrink the `max` of that size's breakpoint by 5% (rounded).
 */
export async function adjustSizeChartFromReturns(
  shop: string,
  categoryTag: string,
  sizeSystem: string,
  minSamples = 10,
): Promise<SizeAdjustmentResult> {
  const records = await getUnprocessedReturnsByCategoryForShop(shop, categoryTag);
  const noOp: SizeAdjustmentResult = {
    categoryTag,
    sizeSystem,
    adjusted: false,
    reason: "",
    processedRecordIds: [],
  };

  if (records.length < minSamples) {
    return { ...noOp, reason: `Insufficient samples (${records.length} < ${minSamples})` };
  }

  const chart = await getSizeChartForCategory(shop, categoryTag, sizeSystem);
  if (!chart) {
    return { ...noOp, reason: "No SizeChart found for this category/sizeSystem" };
  }

  // Never adjust overrideBreakpoints
  if (chart.overrideBreakpoints != null) {
    await markReturnRecordsProcessed(records.map((r) => r.id));
    return {
      ...noOp,
      adjusted: false,
      reason: "Merchant override active — auto adjustment skipped",
      processedRecordIds: records.map((r) => r.id),
    };
  }

  const breakpoints = (chart.breakpoints as unknown as SizeBreakpoint[]).map((bp) => ({ ...bp }));

  // Tally "too_large" reasons per returned size
  const tooLargeCountBySize = new Map<string, number>();
  const totalCountBySize = new Map<string, number>();
  for (const rec of records) {
    totalCountBySize.set(rec.returnedSize, (totalCountBySize.get(rec.returnedSize) ?? 0) + 1);
    if (rec.returnReason === "too_large") {
      tooLargeCountBySize.set(rec.returnedSize, (tooLargeCountBySize.get(rec.returnedSize) ?? 0) + 1);
    }
  }

  let adjusted = false;
  for (const bp of breakpoints) {
    const total = totalCountBySize.get(bp.label) ?? 0;
    const tooLarge = tooLargeCountBySize.get(bp.label) ?? 0;
    if (total >= minSamples && tooLarge / total > 0.6 && bp.max != null) {
      bp.max = Math.round(bp.max * 0.95 * 100) / 100;
      adjusted = true;
    }
  }

  if (adjusted) {
    await upsertSizeChart({ shop, categoryTag, sizeSystem, breakpoints });
  }

  await markReturnRecordsProcessed(records.map((r) => r.id));

  return {
    categoryTag,
    sizeSystem,
    adjusted,
    reason: adjusted ? "Breakpoints adjusted based on return data" : "No significant bias detected",
    processedRecordIds: records.map((r) => r.id),
  };
}
