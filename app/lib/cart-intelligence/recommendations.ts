import type { VisualRecommendationPayload } from "../knowledge-graph/colorways";
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