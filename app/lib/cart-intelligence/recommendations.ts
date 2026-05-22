import type { VisualRecommendationPayload } from "../knowledge-graph/colorways";
import type { CartVisualItem, StyleCoherenceResult } from "./style-coherence";

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