import type { VisualRecommendationPayload } from "../knowledge-graph/colorways";
import type { StorefrontGuidancePayload, StructuredGuidanceBlock } from "../ai/schemas";
import type { BundleDetectionResult } from "./bundles";
import type { BundleProjectionRecord } from "../knowledge-graph/bundles";
import type { KitAssessment, KitAssessmentReason } from "../knowledge-graph/kits";
import type { ThresholdEvaluationResult } from "./threshold";
import { formatThresholdPriceLabel } from "../knowledge-graph/thresholds";
import type {
  ShopperSizeConflictCard,
  ShopperSizeConflictSuggestion,
  SizeConflict,
  SizeConflictRecommendationPayload,
  SizeConflictResult,
} from "../knowledge-graph/sizing";
import type { ResolvedCustomerProfile } from "./customer-profile";
import type {
  ReplenishmentActionType,
  ReplenishmentCandidate,
} from "./replenishment";
import type { CartVisualItem, StyleCoherenceResult } from "./style-coherence";

export interface KitRecommendationReason {
  reasonType: KitAssessmentReason["reasonType"];
  source: KitAssessmentReason["source"];
  confidence: number;
  message: string;
}

export interface MissingKitRecommendation {
  requirementKey: string;
  recommendationType: "required_missing" | "optional_missing";
  productId?: string;
  variantId?: string;
  title: string;
  disciplineTag: string;
  priority: number;
  confidence: number;
  reasons: KitRecommendationReason[];
}

export interface KitRecommendationPayload {
  kitKey: string;
  label: string;
  disciplineTag: string;
  completenessScore: number;
  status: "partial" | "complete";
  missingRecommendations: MissingKitRecommendation[];
  summaryReasons: KitRecommendationReason[];
}

export interface BundleCompletionCandidate {
  componentKey: string;
  productId: string;
  variantId?: string;
  title: string;
  availableForSale: boolean;
  confidence: number;
  reason: string;
}

export interface ShopperBundleCompletionAction {
  componentKey: string;
  title: string;
  remainingQuantity: number;
  productId?: string;
  variantId?: string;
  availability: "available" | "unavailable" | "unknown";
  confidence: number;
  reason: string;
}

export interface ShopperBundleOpportunity {
  bundleKey: string;
  label: string;
  status: "qualified" | "nearly_complete";
  priority: number;
  message: string;
  savings: {
    label: string;
    discountType: "PERCENTAGE" | "FIXED";
    discountValue: string;
  };
  completionProgress: {
    matchedRequiredCount: number;
    totalRequiredCount: number;
    coverageRatio: number;
  };
  completionActions: ShopperBundleCompletionAction[];
  isCompetingOffer: boolean;
}

export interface BundleRecommendationPayload {
  summary: {
    qualifiedCount: number;
    nearCompleteCount: number;
    primaryBundleKey?: string;
  };
  opportunities: ShopperBundleOpportunity[];
}

export interface BuildBundleRecommendationsInput {
  detection: BundleDetectionResult;
  completionCandidates?: Record<string, BundleCompletionCandidate[]>;
}

export interface ThresholdRecommendationPayload {
  summary: {
    status: "hidden" | "eligible" | "qualified";
    thresholdKey?: string;
    benefitLabel?: string;
    targetSubtotal?: string;
    gapAmount?: string;
    reason?: string;
  };
  suggestions: Array<{
    productId: string;
    variantId?: string;
    title: string;
    priceLabel?: string;
    rank: number;
    reason: string;
    unlockMessage: string;
    wouldOvershoot: boolean;
  }>;
}

export interface RecommendationPersonalizationPayload {
  profileKey: string;
  identityMode: ResolvedCustomerProfile["identityMode"];
  guidanceMode: ResolvedCustomerProfile["guidanceMode"];
  recencyState: ResolvedCustomerProfile["recencyState"];
  confidence: number;
  purchaseFrequency?: ResolvedCustomerProfile["purchaseFrequency"];
  knownSizes: Record<string, string>;
  disciplinePreferences: ResolvedCustomerProfile["disciplinePreferences"];
  sourceSummary: ResolvedCustomerProfile["sourceSummary"];
}

export interface ReplenishmentRecommendationOpportunityPayload {
  candidateKey: string;
  productId: string;
  variantId?: string;
  categoryTag: string;
  title: string;
  dueState: "approaching" | "due";
  confidence: number;
  expectedReplacementAt: string;
  actionType: ReplenishmentActionType;
  reason: string;
  actionTarget?: {
    productId: string;
    variantId?: string;
    available: boolean;
  };
}

export interface ReplenishmentRecommendationPayload {
  summary: {
    status: "hidden" | "eligible" | "due";
    totalCandidates: number;
    dueCount: number;
    approachingCount: number;
    highestPriorityCategory?: string;
    message?: string;
  };
  opportunities: ReplenishmentRecommendationOpportunityPayload[];
  refreshCart?: {
    suggestionKey: string;
    totalItems: number;
    actions: Array<{
      productId: string;
      variantId?: string;
      quantity: number;
      actionType: ReplenishmentActionType;
    }>;
  };
}

function buildShopperSizeConflictSuggestion(
  suggestion: SizeConflict["suggestions"][number],
): ShopperSizeConflictSuggestion {
  return {
    targetItemVariantId: suggestion.currentVariantId,
    suggestedSize: suggestion.suggestedSize,
    suggestedVariantId: suggestion.suggestedVariantId,
    availability: suggestion.availability,
    confidence: suggestion.confidence,
    label: `Change to ${suggestion.suggestedSize}`,
    reason: suggestion.reason,
  };
}

function buildShopperSizeConflictCard(conflict: SizeConflict): ShopperSizeConflictCard {
  const suggestions = conflict.suggestions
    .map(buildShopperSizeConflictSuggestion)
    .sort((left, right) => {
      const availabilityRank = (value: ShopperSizeConflictSuggestion["availability"]) => {
        switch (value) {
          case "available":
            return 0;
          case "unknown":
            return 1;
          default:
            return 2;
        }
      };

      return availabilityRank(left.availability) - availabilityRank(right.availability) || right.confidence - left.confidence;
    });

  const primarySuggestion = suggestions.find((suggestion) => suggestion.availability === "available");
  const additionalSuggestions = suggestions.filter((suggestion) => suggestion !== primarySuggestion);

  return {
    conflictKey: conflict.conflictKey,
    severity: conflict.severity,
    title: conflict.severity === "ERROR" ? "Critical size conflict" : "Size mismatch detected",
    message: conflict.message,
    affectedItems: [conflict.itemA, conflict.itemB],
    ...(primarySuggestion ? { primarySuggestion } : {}),
    additionalSuggestions,
  };
}

export function buildSizeConflictRecommendations(
  result: SizeConflictResult,
): SizeConflictRecommendationPayload {
  const conflicts = [...result.conflicts]
    .sort((left, right) => {
      if (left.severity !== right.severity) {
        return left.severity === "ERROR" ? -1 : 1;
      }

      return left.conflictKey.localeCompare(right.conflictKey);
    })
    .map(buildShopperSizeConflictCard);

  return {
    summary: {
      totalConflicts: result.summary.total,
      errorCount: result.summary.errorCount,
      warningCount: result.summary.warningCount,
      highestSeverity: result.hasErrors ? "ERROR" : result.hasWarnings ? "WARNING" : null,
    },
    conflicts,
  };
}

function toKitRecommendationReason(reason: KitAssessmentReason): KitRecommendationReason {
  return {
    reasonType: reason.reasonType,
    source: reason.source,
    confidence: reason.confidence,
    message: reason.message,
  };
}

export function buildKitRecommendations(assessments: KitAssessment[]): KitRecommendationPayload[] {
  return assessments
    .filter((assessment) => assessment.status === "partial" && assessment.missingRequirements.length > 0)
    .map((assessment) => ({
      kitKey: assessment.kitKey,
      label: assessment.label,
      disciplineTag: assessment.disciplineTag,
      completenessScore: assessment.completenessScore,
      status: "partial",
      missingRecommendations: [...assessment.missingRequirements]
        .sort((left, right) => {
          if (left.isRequired !== right.isRequired) {
            return left.isRequired ? -1 : 1;
          }

          return left.priority - right.priority;
        })
        .map((requirement) => ({
          requirementKey: requirement.requirementKey,
          recommendationType: requirement.isRequired ? "required_missing" : "optional_missing",
          title: requirement.label,
          disciplineTag: assessment.disciplineTag,
          priority: requirement.priority,
          confidence: Math.max(
            ...requirement.reasons.map((reason) => reason.confidence),
            requirement.isRequired ? 0.9 : 0.65,
          ),
          reasons: requirement.reasons.map(toKitRecommendationReason),
        })),
      summaryReasons: assessment.reasons.map(toKitRecommendationReason),
    }));
}

function formatBundleSavingsLabel(discountType: "PERCENTAGE" | "FIXED", discountValue: string) {
  return discountType === "PERCENTAGE"
    ? `Save ${discountValue}%`
    : `Save $${discountValue}`;
}

function buildBundleCompletionActions(
  opportunity: BundleDetectionResult["matches"][number],
  completionCandidates: Record<string, BundleCompletionCandidate[]>,
): ShopperBundleCompletionAction[] {
  if (opportunity.status !== "nearly_complete") {
    return [];
  }

  return opportunity.missingComponents
    .filter((component) => component.isRequired)
    .map((component) => {
      const candidate = completionCandidates[component.componentKey]?.[0];

      return {
        componentKey: component.componentKey,
        title: candidate?.title ?? component.label,
        remainingQuantity: component.remainingQuantity,
        productId: candidate?.productId,
        variantId: candidate?.variantId,
        availability: candidate
          ? candidate.availableForSale
            ? "available"
            : "unavailable"
          : "unknown",
        confidence: candidate?.confidence ?? 0.5,
        reason: candidate?.reason ?? `${component.label} is still needed to qualify this bundle.`,
      };
    });
}

export function buildBundleRecommendations(
  input: BuildBundleRecommendationsInput,
): BundleRecommendationPayload {
  const surfacedMatches = [...input.detection.matches]
    .filter((match): match is typeof match & { status: "qualified" | "nearly_complete" } => (
      match.status === "qualified" || match.status === "nearly_complete"
    ))
    .sort((left, right) => left.priority - right.priority || left.bundleKey.localeCompare(right.bundleKey));
  const completionCandidates = input.completionCandidates ?? {};

  return {
    summary: {
      qualifiedCount: surfacedMatches.filter((match) => match.status === "qualified").length,
      nearCompleteCount: surfacedMatches.filter((match) => match.status === "nearly_complete").length,
      ...(surfacedMatches[0] ? { primaryBundleKey: surfacedMatches[0].bundleKey } : {}),
    },
    opportunities: surfacedMatches.map((match) => {
      const requiredMissingKeys = new Set(
        match.missingComponents
          .filter((component) => component.isRequired)
          .map((component) => component.componentKey),
      );
      const totalRequiredCount = match.matchedComponents.filter(
        (component) => component.requiredQuantity > 0,
      ).length - match.missingComponents.filter((component) => !component.isRequired).length;
      const matchedRequiredCount = match.matchedComponents.filter(
        (component) => component.matchedQuantity >= component.requiredQuantity
          && !requiredMissingKeys.has(component.componentKey),
      ).length;

      return {
        bundleKey: match.bundleKey,
        label: match.label,
        status: match.status,
        priority: match.priority,
        message: match.status === "qualified"
          ? `${match.label} is unlocked in the current cart.`
          : `${match.label} is nearly complete and can be finished with a few additions.`,
        savings: {
          label: formatBundleSavingsLabel(match.savings.discountType, match.savings.discountValue),
          discountType: match.savings.discountType,
          discountValue: match.savings.discountValue,
        },
        completionProgress: {
          matchedRequiredCount,
          totalRequiredCount,
          coverageRatio: match.coverageRatio,
        },
        completionActions: buildBundleCompletionActions(match, completionCandidates),
        isCompetingOffer: match.competitionGroupKeys.length > 0,
      } satisfies ShopperBundleOpportunity;
    }),
  };
}

// ---------------------------------------------------------------------------
// Compact active bundle rule projection feed (022 T025/T033)
// ---------------------------------------------------------------------------

export const ACTIVE_BUNDLE_RULE_PROJECTION_VERSION = 1;

export interface ActiveBundleRuleProjectionFeed {
  shop: string;
  generatedAt: string;
  projectionVersion: number;
  rules: BundleProjectionRecord[];
  degraded?: boolean;
}

/**
 * Builds the compact ACTIVE-only bundle rule projection for downstream consumers.
 * Falls back to the last known-good feed when rule generation is unavailable
 * (e.g. empty/undefined input from an upstream failure) instead of emitting an
 * empty feed that would wipe out cart-transform/checkout projections.
 */
export function buildActiveBundleRuleProjectionFeed(input: {
  shop: string;
  rules: BundleProjectionRecord[] | null | undefined;
  previousFeed?: ActiveBundleRuleProjectionFeed | null;
  now?: Date;
}): ActiveBundleRuleProjectionFeed {
  const { shop, rules, previousFeed = null } = input;
  const now = input.now ?? new Date();

  if (!rules) {
    if (previousFeed) {
      return { ...previousFeed, degraded: true };
    }

    return {
      shop,
      generatedAt: now.toISOString(),
      projectionVersion: ACTIVE_BUNDLE_RULE_PROJECTION_VERSION,
      rules: [],
      degraded: true,
    };
  }

  return {
    shop,
    generatedAt: now.toISOString(),
    projectionVersion: ACTIVE_BUNDLE_RULE_PROJECTION_VERSION,
    rules: [...rules].sort((left, right) => left.priority - right.priority || left.key.localeCompare(right.key)),
  };
}

export function isSupportedActiveBundleRuleProjectionVersion(version: number): boolean {
  return version === ACTIVE_BUNDLE_RULE_PROJECTION_VERSION;
}

export function buildThresholdRecommendations(
  result: ThresholdEvaluationResult,
): ThresholdRecommendationPayload {
  if (result.status === "qualified") {
    return {
      summary: {
        status: "qualified",
        thresholdKey: result.selectedRule?.key,
        benefitLabel: result.selectedRule?.benefitLabel,
        targetSubtotal: result.selectedRule ? `${result.selectedRule.targetSubtotal.toFixed(2)}` : undefined,
        gapAmount: result.gapAmount !== null ? `${result.gapAmount.toFixed(2)}` : undefined,
        reason: "The current cart already qualifies for this threshold.",
      },
      suggestions: [],
    };
  }

  if (result.status !== "eligible" || !result.selectedRule) {
    return {
      summary: {
        status: "hidden",
        reason: result.suppressionReason,
      },
      suggestions: [],
    };
  }

  return {
    summary: {
      status: "eligible",
      thresholdKey: result.selectedRule.key,
      benefitLabel: result.selectedRule.benefitLabel,
      targetSubtotal: `${result.selectedRule.targetSubtotal.toFixed(2)}`,
      gapAmount: result.gapAmount !== null ? `${result.gapAmount.toFixed(2)}` : undefined,
      reason: result.selectedRule.selectionReason
        ?? `Add a relevant item to unlock ${result.selectedRule.benefitLabel.toLowerCase()}.`,
    },
    suggestions: result.candidates.map((candidate, index) => ({
      productId: candidate.productId,
      variantId: candidate.variantId,
      title: candidate.title,
      priceLabel: formatThresholdPriceLabel(candidate.unitPrice),
      rank: index + 1,
      reason: candidate.reasoning[0] ?? "Relevant to the current cart.",
      unlockMessage: result.unlockMessage
        ?? `Helps close the remaining gap toward ${result.selectedRule?.benefitLabel.toLowerCase()}.`,
      wouldOvershoot: candidate.wouldOvershoot,
    })),
  };
}

export function buildVisualRecommendations(
  result: StyleCoherenceResult,
  candidates: CartVisualItem[],
  cartItems: CartVisualItem[] = [],
): VisualRecommendationPayload {
  const opportunities = result.suggestions.map((suggestion, index) => {
    const candidate = candidates.find((item) => item.productId === suggestion.candidateProductId);
    const opportunityType: "collection_completion" | "swap" = suggestion.type === "add"
      ? "collection_completion"
      : "swap";

    return {
      type: opportunityType,
      productId: suggestion.candidateProductId,
      variantId: suggestion.candidateVariantId,
      title: candidate?.title ?? suggestion.candidateProductId,
      confidence: suggestion.confidence,
      rank: index + 1,
      reasonLabel: suggestion.reasons[0]?.message ?? "Supports the current cart theme.",
      ...(typeof suggestion.reasons[0]?.metadata?.projectedScore === "number"
        ? {
            projectedCoherenceScore: suggestion.reasons[0].metadata.projectedScore.toFixed(2),
          }
        : {}),
      reasons: suggestion.reasons,
    };
  }).slice(0, 3);

  const collectionCounts = new Map<string, { label: string; count: number }>();
  for (const item of cartItems) {
    for (const collection of item.visualProfile.effectiveCollections) {
      const current = collectionCounts.get(collection.key);
      collectionCounts.set(collection.key, {
        label: collection.label,
        count: (current?.count ?? 0) + 1,
      });
    }
  }

  const dominantCollection = Array.from(collectionCounts.entries())
    .sort((left, right) => right[1].count - left[1].count)[0];
  const shouldHide = opportunities.length === 0;
  const hiddenReason = result.status === "cohesive"
    ? "The cart is already visually coordinated."
    : "No clear style recommendation is warranted right now.";

  return {
    summary: {
      status: shouldHide ? "hidden" : result.status,
      coherenceScore: result.coherenceScore.toFixed(2),
      ...(!shouldHide && dominantCollection && dominantCollection[1].count >= 2
        ? {
            dominantTheme: {
              type: "collection",
              key: dominantCollection[0],
              label: dominantCollection[1].label,
              confidence: opportunities[0]?.confidence ?? result.coherenceScore,
            },
          }
        : {}),
      ...(shouldHide
        ? { reason: hiddenReason }
        : {}),
    },
    opportunities,
  };
}

export function buildRecommendationPersonalization(
  profile: ResolvedCustomerProfile,
): RecommendationPersonalizationPayload {
  return {
    profileKey: profile.profileKey,
    identityMode: profile.identityMode,
    guidanceMode: profile.guidanceMode,
    recencyState: profile.recencyState,
    confidence: profile.confidence,
    ...(profile.purchaseFrequency ? { purchaseFrequency: profile.purchaseFrequency } : {}),
    knownSizes: profile.knownSizes,
    disciplinePreferences: profile.disciplinePreferences,
    sourceSummary: profile.sourceSummary,
  };
}

export function buildReplenishmentRecommendations(
  candidates: ReplenishmentCandidate[],
): ReplenishmentRecommendationPayload | undefined {
  if (candidates.length === 0) {
    return undefined;
  }

  const visibleCandidates = candidates.filter(
    (candidate): candidate is ReplenishmentCandidate & { dueState: "approaching" | "due" } => (
      candidate.dueState === "approaching" || candidate.dueState === "due"
    ),
  );
  const dueCount = visibleCandidates.filter((candidate) => candidate.dueState === "due").length;
  const approachingCount = visibleCandidates.filter((candidate) => candidate.dueState === "approaching").length;
  const topCandidate = visibleCandidates[0] ?? candidates[0];

  return {
    summary: {
      status: dueCount > 0 ? "due" : visibleCandidates.length > 0 ? "eligible" : "hidden",
      totalCandidates: candidates.length,
      dueCount,
      approachingCount,
      ...(topCandidate ? { highestPriorityCategory: topCandidate.categoryTag } : {}),
      message: dueCount > 0
        ? "Some previously purchased gear looks ready for replacement."
        : visibleCandidates.length > 0
          ? "Some previously purchased gear is approaching its expected refresh window."
          : "No replenishment items are ready yet.",
    },
    opportunities: visibleCandidates.map((candidate) => ({
      candidateKey: candidate.candidateKey,
      productId: candidate.productId,
      ...(candidate.variantId ? { variantId: candidate.variantId } : {}),
      categoryTag: candidate.categoryTag,
      title: candidate.title,
      dueState: candidate.dueState,
      confidence: candidate.confidence,
      expectedReplacementAt: candidate.expectedReplacementAt,
      actionType: candidate.preferredAction,
      reason: candidate.reasons[0] ?? "This item is within its replacement window.",
      ...((candidate.preferredAction === "reorder" ? candidate.reorderTarget : candidate.upgradeTarget)
        ? {
            actionTarget: candidate.preferredAction === "reorder"
              ? candidate.reorderTarget
              : candidate.upgradeTarget,
          }
        : {}),
    })),
  };
}

export function buildStorefrontGuidanceFromBlocks(input: {
  payloadId: string;
  generatedAt: string;
  cartId?: string;
  blocks: StructuredGuidanceBlock[];
  bootstrapPath?: string;
}): StorefrontGuidancePayload {
  const recommendations = input.blocks.flatMap((block) => {
    if (block.type !== "recommendation_list") {
      return [];
    }

    return block.items.map((item, index) => ({
      guidanceId: `${block.blockId}:${index}`,
      title: item.title,
      message: item.reason,
      priority: block.priority + index,
      action: item.action,
      ...(item.productId ? { productId: item.productId } : {}),
      ...(item.variantId ? { variantId: item.variantId } : {}),
      ...(item.priceLabel ? { priceLabel: item.priceLabel } : {}),
    }));
  });
  const sizeWarnings = input.blocks.flatMap((block) => {
    if (block.type !== "size_summary") {
      return [];
    }

    return [{
      warningId: block.blockId,
      title: block.title,
      message: block.summary,
      severity: block.confidence >= 0.85 ? "warning" as const : "info" as const,
      relatedLineIds: [],
    }];
  });
  const fallbackBlock = input.blocks.find((block) => block.type === "fallback_notice");

  return {
    payloadId: input.payloadId,
    generatedAt: input.generatedAt,
    ...(input.cartId ? { cartId: input.cartId } : {}),
    recommendations,
    sizeWarnings,
    chatEntry: {
      available: true,
      ...(input.bootstrapPath ? { bootstrapPath: input.bootstrapPath } : {}),
    },
    ...(fallbackBlock && fallbackBlock.type === "fallback_notice"
      ? {
          fallbackNotice: {
            title: fallbackBlock.title,
            message: fallbackBlock.summary,
          },
        }
      : {}),
  };
}