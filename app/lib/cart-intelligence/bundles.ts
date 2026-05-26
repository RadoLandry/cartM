import {
  BundleComponentMatchMode,
  BundleDiscountType,
} from "@prisma/client";

import {
  buildBundleDetectionRequest,
  createBundleReason,
  sortBundleComponents,
  type BundleMatchReason,
  type BundleRuleComponentDefinition,
  type BundleRuleRecord,
  type CartBundleItem,
} from "../knowledge-graph/bundles";

export type BundleMatchStatus = "qualified" | "nearly_complete" | "partial" | "not_applicable";

export interface BundleDetectionRequest {
  shop: string;
  cartItems: CartBundleItem[];
  bundleRules: BundleRuleRecord[];
}

export interface BundleComponentCoverage {
  componentKey: string;
  label: string;
  requiredQuantity: number;
  matchedQuantity: number;
  matchedCartItemIds: string[];
}

export interface BundleMissingComponent {
  componentKey: string;
  label: string;
  requiredQuantity: number;
  remainingQuantity: number;
  isRequired: boolean;
}

export interface BundleMatch {
  bundleKey: string;
  label: string;
  priority: number;
  status: BundleMatchStatus;
  coverageRatio: number;
  matchedComponents: BundleComponentCoverage[];
  missingComponents: BundleMissingComponent[];
  qualifiedCartItemIds: string[];
  competitionGroupKeys: string[];
  savings: {
    discountType: BundleDiscountType;
    discountValue: string;
  };
  reasons: BundleMatchReason[];
}

export interface BundleDetectionResult {
  matches: BundleMatch[];
  summary: {
    qualifiedCount: number;
    nearCompleteCount: number;
    competingOfferCount: number;
  };
}

function round(value: number): number {
  return Number(value.toFixed(2));
}

export function matchesBundleComponent(
  component: BundleRuleComponentDefinition,
  item: CartBundleItem,
): boolean {
  switch (component.matchMode) {
    case BundleComponentMatchMode.VARIANT:
      return component.acceptedShopifyVariantIds.includes(item.shopifyVariantId);
    case BundleComponentMatchMode.PRODUCT:
      return component.acceptedShopifyProductIds.includes(item.shopifyProductId);
    case BundleComponentMatchMode.CATEGORY:
      return component.acceptedCategoryTags.some((tag) => item.categoryTags.includes(tag));
    case BundleComponentMatchMode.CATEGORY_OR_PRODUCT:
      return component.acceptedShopifyProductIds.includes(item.shopifyProductId)
        || component.acceptedCategoryTags.some((tag) => item.categoryTags.includes(tag));
    default:
      return false;
  }
}

export function buildBundleComponentCoverage(
  component: BundleRuleComponentDefinition,
  cartItems: CartBundleItem[],
): BundleComponentCoverage {
  const matchedItems = cartItems.filter((item) => matchesBundleComponent(component, item));

  return {
    componentKey: component.componentKey,
    label: component.label,
    requiredQuantity: component.minQuantity,
    matchedQuantity: matchedItems.reduce((sum, item) => sum + item.quantity, 0),
    matchedCartItemIds: matchedItems.map((item) => item.productId),
  };
}

export function buildBundleMissingComponent(
  component: BundleRuleComponentDefinition,
  coverage: BundleComponentCoverage,
): BundleMissingComponent | null {
  const remainingQuantity = Math.max(0, component.minQuantity - coverage.matchedQuantity);
  if (remainingQuantity <= 0) {
    return null;
  }

  return {
    componentKey: component.componentKey,
    label: component.label,
    requiredQuantity: component.minQuantity,
    remainingQuantity,
    isRequired: component.isRequired,
  };
}

export function calculateCoverageRatio(
  components: BundleRuleComponentDefinition[],
  coverages: BundleComponentCoverage[],
): number {
  const requiredComponents = components.filter((component) => component.isRequired);
  if (requiredComponents.length === 0) {
    return 0;
  }

  const satisfiedRequired = requiredComponents.filter((component) => {
    const coverage = coverages.find((candidate) => candidate.componentKey === component.componentKey);
    return coverage && coverage.matchedQuantity >= component.minQuantity;
  }).length;

  return round(satisfiedRequired / requiredComponents.length);
}

export function classifyBundleStatus(input: {
  coverageRatio: number;
  hasAnyMatchedEvidence: boolean;
  hasMissingRequired: boolean;
  completionThreshold: number;
}): BundleMatchStatus {
  const { coverageRatio, hasAnyMatchedEvidence, hasMissingRequired, completionThreshold } = input;

  if (!hasAnyMatchedEvidence) {
    return "not_applicable";
  }

  if (!hasMissingRequired && coverageRatio >= 1) {
    return "qualified";
  }

  if (coverageRatio >= completionThreshold) {
    return "nearly_complete";
  }

  return "partial";
}

function buildBundleReasons(
  status: BundleMatchStatus,
  rule: BundleRuleRecord,
  missingComponents: BundleMissingComponent[],
): BundleMatchReason[] {
  if (status === "qualified") {
    return [
      createBundleReason(
        "qualified",
        0.95,
        rule.source,
        `${rule.label} is fully qualified by the current cart.`,
      ),
    ];
  }

  if (status === "nearly_complete") {
    return [
      createBundleReason(
        "near_complete",
        0.85,
        rule.source,
        `${rule.label} is close to qualification with ${missingComponents.length} missing component(s).`,
        {
          missingComponentKeys: missingComponents.map((component) => component.componentKey),
        },
      ),
    ];
  }

  if (status === "partial") {
    return [
      createBundleReason(
        "partial_match",
        0.65,
        rule.source,
        `${rule.label} has partial bundle evidence but does not meet the completion threshold yet.`,
      ),
    ];
  }

  return [];
}

function hasQualifiedEvidenceOverlap(left: BundleMatch, right: BundleMatch): boolean {
  if (left.qualifiedCartItemIds.length === 0 || right.qualifiedCartItemIds.length === 0) {
    return false;
  }

  const leftIds = new Set(left.qualifiedCartItemIds);
  return right.qualifiedCartItemIds.some((itemId) => leftIds.has(itemId));
}

function attachCompetitionGroups(matches: BundleMatch[]): BundleMatch[] {
  return matches.map((match) => {
    const competitionGroupKeys = matches
      .filter((candidate) => candidate.bundleKey !== match.bundleKey)
      .filter((candidate) => hasQualifiedEvidenceOverlap(match, candidate))
      .map((candidate) => candidate.bundleKey)
      .sort();

    if (competitionGroupKeys.length === 0) {
      return match;
    }

    return {
      ...match,
      competitionGroupKeys,
      reasons: [
        ...match.reasons,
        createBundleReason(
          "overlap",
          0.75,
          "AUTO",
          `${match.label} overlaps with ${competitionGroupKeys.length} competing bundle offer(s).`,
          { competitionGroupKeys },
        ),
      ],
    } satisfies BundleMatch;
  });
}

export function detectBundles(input: BundleDetectionRequest): BundleDetectionResult {
  const { cartItems, bundleRules } = input;

  if (cartItems.length === 0 || bundleRules.length === 0) {
    return {
      matches: [],
      summary: {
        qualifiedCount: 0,
        nearCompleteCount: 0,
        competingOfferCount: 0,
      },
    };
  }

  const matches = attachCompetitionGroups(bundleRules.map((rule) => {
    const components = sortBundleComponents(rule.components);
    const matchedComponents = components.map((component) => buildBundleComponentCoverage(component, cartItems));
    const missingComponents = components
      .map((component) => buildBundleMissingComponent(
        component,
        matchedComponents.find((coverage) => coverage.componentKey === component.componentKey)!,
      ))
      .filter((component): component is BundleMissingComponent => component !== null);

    const requiredMissing = missingComponents.some((component) => component.isRequired);
    const coverageRatio = calculateCoverageRatio(components, matchedComponents);
    const status = classifyBundleStatus({
      coverageRatio,
      hasAnyMatchedEvidence: matchedComponents.some((component) => component.matchedQuantity > 0),
      hasMissingRequired: requiredMissing,
      completionThreshold: rule.completionThreshold,
    });

    return {
      bundleKey: rule.key,
      label: rule.label,
      priority: rule.priority,
      status,
      coverageRatio,
      matchedComponents,
      missingComponents,
      qualifiedCartItemIds: Array.from(new Set(matchedComponents.flatMap((component) => component.matchedCartItemIds))),
      competitionGroupKeys: [],
      savings: {
        discountType: rule.discountType,
        discountValue: rule.discountValue,
      },
      reasons: buildBundleReasons(status, rule, missingComponents),
    } satisfies BundleMatch;
  }));

  return {
    matches,
    summary: {
      qualifiedCount: matches.filter((match) => match.status === "qualified").length,
      nearCompleteCount: matches.filter((match) => match.status === "nearly_complete").length,
      competingOfferCount: matches.filter((match) => match.competitionGroupKeys.length > 0).length,
    },
  };
}

export async function detectBundlesForShop(
  shop: string,
  cartItems: CartBundleItem[],
): Promise<BundleDetectionResult> {
  const input = await buildBundleDetectionRequest(shop, cartItems);
  return detectBundles(input);
}