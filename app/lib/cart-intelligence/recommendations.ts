import type { VisualRecommendationPayload } from "../knowledge-graph/colorways";
import type { BundleDetectionResult } from "./bundles";
import type { KitAssessment, KitAssessmentReason } from "../knowledge-graph/kits";
import type {
  ShopperSizeConflictCard,
  ShopperSizeConflictSuggestion,
  SizeConflict,
  SizeConflictRecommendationPayload,
  SizeConflictResult,
} from "../knowledge-graph/sizing";
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

export function buildVisualRecommendations(
  result: StyleCoherenceResult,
  candidates: CartVisualItem[],
): VisualRecommendationPayload[] {
  return result.suggestions.map((suggestion) => {
    const candidate = candidates.find((item) => item.productId === suggestion.candidateProductId);
    const matchedCollectionKeys = candidate?.visualProfile.effectiveCollections.map((collection) => collection.key) ?? [];
    const matchedColorwayKeys = candidate?.visualProfile.effectiveColorwayKeys ?? [];

    return {
      type: suggestion.type === "add" ? "collection_completion" : "swap",
      productId: suggestion.candidateProductId,
      variantId: suggestion.candidateVariantId,
      confidence: suggestion.confidence,
      reasons: suggestion.reasons,
    } satisfies VisualRecommendationPayload & {
      visualContext?: {
        matchedCollectionKeys: string[];
        matchedColorwayKeys: string[];
        currentCoherenceScore: number;
        projectedCoherenceScore?: number;
      };
    };
  });
}