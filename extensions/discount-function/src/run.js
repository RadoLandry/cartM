/**
 * CartMind Bundle Discount Function
 *
 * Reads a compact bundle outcome projection from the cart attribute
 * `cartmind_projection`, then applies discounts for selected qualified
 * outcomes. No-discount default applies on any error or malformed data.
 *
 * Constraints (Shopify Function runtime):
 *   - No Node APIs, no Prisma, no fetch, no external calls
 *   - 10 ms CPU budget
 *   - Deterministic ordering
 *   - Rejects unsupported projectionVersion values
 */

const SUPPORTED_PROJECTION_VERSION = 1;

/**
 * @param {object} input - The Shopify Function input
 * @returns {{ discounts: object[], discountApplicationStrategy: string }}
 */
export function run(input) {
  try {
    return applyBundleDiscounts(input);
  } catch {
    return noDiscount();
  }
}

function noDiscount() {
  return {
    discounts: [],
    discountApplicationStrategy: "FIRST",
  };
}

function applyBundleDiscounts(input) {
  const cartAttribute = input?.cart?.attribute?.value;
  if (!cartAttribute) {
    return noDiscount();
  }

  let projection;
  try {
    projection = JSON.parse(cartAttribute);
  } catch {
    return noDiscount();
  }

  if (
    !projection
    || typeof projection !== "object"
    || !Array.isArray(projection.outcomes)
    || !projection.resolution
    || !Array.isArray(projection.resolution.selectedOutcomeIds)
  ) {
    return noDiscount();
  }

  if (projection.projectionVersion !== SUPPORTED_PROJECTION_VERSION) {
    return noDiscount();
  }

  const selectedIds = new Set(projection.resolution.selectedOutcomeIds);
  const cartLineIds = new Set(
    (input?.cart?.lines ?? []).map((line) => line.id),
  );

  const discounts = [];

  for (const outcome of projection.outcomes) {
    if (!selectedIds.has(outcome.outcomeId)) continue;
    if (outcome.status !== "qualified") continue;
    if (!outcome.discount || outcome.discount.value <= 0) continue;
    if (!Array.isArray(outcome.qualifiedLineIds) || outcome.qualifiedLineIds.length === 0) continue;

    const applicableLineIds = outcome.qualifiedLineIds.filter((id) => cartLineIds.has(id));
    if (applicableLineIds.length === 0) continue;

    const discountType = outcome.discount.type === "percentage" ? "PERCENTAGE" : "FIXED_AMOUNT";
    const value =
      discountType === "PERCENTAGE"
        ? { percentage: { value: outcome.discount.value } }
        : { fixedAmount: { amount: String(outcome.discount.value) } };

    discounts.push({
      message: outcome.discount.displayLabel,
      value,
      targets: applicableLineIds.map((lineId) => ({
        cartLine: { id: lineId },
      })),
    });
  }

  if (discounts.length === 0) {
    return noDiscount();
  }

  return {
    discounts,
    discountApplicationStrategy: "FIRST",
  };
}
