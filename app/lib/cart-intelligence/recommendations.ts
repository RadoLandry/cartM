import type { VisualRecommendationPayload } from "../knowledge-graph/colorways";
import type { KitAssessment, KitAssessmentReason } from "../knowledge-graph/kits";
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
    .filter((assessment) => assessment.status !== "none")
    .map((assessment) => ({
      kitKey: assessment.kitKey,
      label: assessment.label,
      disciplineTag: assessment.disciplineTag,
      completenessScore: assessment.completenessScore,
      status: assessment.status === "complete" ? "complete" : "partial",
      missingRecommendations:
        assessment.status === "complete"
          ? []
          : assessment.missingRequirements.map((requirement) => ({
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