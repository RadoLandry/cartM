/**
 * CartMind Bundle Presentation (Cart Transform) Function
 *
 * Reads a compact bundle outcome projection from the cart attribute
 * `cartmind_projection`, then merges or labels cart lines for selected
 * qualified bundles where `presentation.lineMergeEligible` is true.
 *
 * Constraints (Shopify Function runtime):
 *   - No Node APIs, no Prisma, no fetch, no external calls
 *   - 10 ms CPU budget
 *   - Deterministic ordering
 *   - Returns no-op on any error or malformed data
 */

const SUPPORTED_PROJECTION_VERSION = 1;

/**
 * @param {object} input - The Shopify Function input
 * @returns {{ operations: object[] }}
 */
export function run(input) {
  try {
    return applyBundlePresentation(input);
  } catch {
    return noOp();
  }
}

function noOp() {
  return { operations: [] };
}

function getCartLines(input) {
  const lines = input?.cart?.lines;
  if (Array.isArray(lines)) return lines;
  if (Array.isArray(lines?.nodes)) return lines.nodes;
  return [];
}

function applyBundlePresentation(input) {
  const cartAttribute = input?.cart?.attribute?.value;
  if (!cartAttribute) {
    return noOp();
  }

  let projection;
  try {
    projection = JSON.parse(cartAttribute);
  } catch {
    return noOp();
  }

  if (
    !projection
    || typeof projection !== "object"
    || !Array.isArray(projection.outcomes)
    || !projection.resolution
    || !Array.isArray(projection.resolution.selectedOutcomeIds)
  ) {
    return noOp();
  }

  if (projection.projectionVersion !== SUPPORTED_PROJECTION_VERSION) {
    return noOp();
  }

  const selectedIds = new Set(projection.resolution.selectedOutcomeIds);
  const cartLineMap = new Map(
    getCartLines(input).map((line) => [line.id, line]),
  );

  const operations = [];

  for (const outcome of projection.outcomes) {
    if (!selectedIds.has(outcome.outcomeId)) continue;
    if (outcome.status !== "qualified") continue;
    if (!outcome.presentation?.lineMergeEligible) continue;
    if (!Array.isArray(outcome.qualifiedLineIds) || outcome.qualifiedLineIds.length < 2) continue;

    const presentLine = outcome.qualifiedLineIds[0];
    const remainingLines = outcome.qualifiedLineIds.slice(1);

    const presentLineInCart = cartLineMap.has(presentLine);
    if (!presentLineInCart) continue;

    const linesToMerge = remainingLines.filter((id) => cartLineMap.has(id));
    if (linesToMerge.length === 0) continue;

    operations.push({
      linesMerge: {
        parentVariantId: cartLineMap.get(presentLine).merchandise.id,
        cartLines: outcome.qualifiedLineIds
          .filter((id) => cartLineMap.has(id))
          .map((id) => ({
            cartLineId: id,
            quantity: cartLineMap.get(id).quantity,
          })),
        title: outcome.presentation.bundleTitle,
        image: null,
        price: null,
      },
    });
  }

  if (operations.length === 0) {
    return noOp();
  }

  return { operations };
}
