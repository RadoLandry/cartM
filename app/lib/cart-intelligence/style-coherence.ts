import { ColorCompatibility, VisualProfileSource } from "@prisma/client";
import type { StyleReason } from "../knowledge-graph/colorways";

export interface CartVisualCollection {
  key: string;
  label: string;
  source: "shopify" | "merchant";
}

export interface CartVisualProfile {
  dominantColors: string[];
  effectiveColorwayKeys: string[];
  effectiveCollections: CartVisualCollection[];
  visualConfidence: number | null;
}

export interface CartVisualItem {
  productId: string;
  title: string;
  categoryTags: string[];
  availableForSale: boolean;
  selectedVariantId?: string;
  selectedColorwayKey?: string | null;
  visualProfile: CartVisualProfile;
}

export interface StyleCompatibilityRule {
  sourceColorwayKey: string;
  targetColorwayKey: string;
  compatibility: ColorCompatibility;
}

export interface StyleSuggestion {
  type: "add" | "swap";
  candidateProductId: string;
  candidateVariantId?: string;
  confidence: number;
  reasons: StyleReason[];
}

export interface StyleCoherenceInput {
  shop: string;
  items: CartVisualItem[];
  compatibilityRules: StyleCompatibilityRule[];
  candidateProducts?: CartVisualItem[];
}

export interface StyleCoherenceResult {
  coherenceScore: number;
  status: "cohesive" | "mixed" | "clashing";
  reasons: StyleReason[];
  suggestions: StyleSuggestion[];
}

function reason(
  reasonType: StyleReason["reasonType"],
  confidence: number,
  source: StyleReason["source"],
  message: string,
  metadata?: Record<string, unknown>,
): StyleReason {
  return { reasonType, confidence, source, message, metadata };
}

function paletteOverlap(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const shared = a.filter((value) => b.includes(value));
  return shared.length / Math.min(a.length, b.length);
}

function getCompatibilityScore(
  item: CartVisualItem,
  peer: CartVisualItem,
  rules: StyleCompatibilityRule[],
): { score: number; reason: StyleReason | null } {
  const collectionKeysA = item.visualProfile.effectiveCollections.map((collection) => collection.key);
  const collectionKeysB = peer.visualProfile.effectiveCollections.map((collection) => collection.key);
  const sharedCollections = collectionKeysA.filter((key) => collectionKeysB.includes(key));
  if (sharedCollections.length > 0) {
    return {
      score: 0.9,
      reason: reason("same_collection", 0.9, "SYSTEM", "Items belong to the same coordinated collection.", { sharedCollections }),
    };
  }

  for (const sourceColorwayKey of item.visualProfile.effectiveColorwayKeys) {
    for (const targetColorwayKey of peer.visualProfile.effectiveColorwayKeys) {
      const match = rules.find(
        (rule) =>
          rule.sourceColorwayKey === sourceColorwayKey &&
          rule.targetColorwayKey === targetColorwayKey,
      );
      if (match) {
        if (match.compatibility === ColorCompatibility.AVOID) {
          return {
            score: 0.1,
            reason: reason("merchant_override", 0.95, VisualProfileSource.MERCHANT, "Merchant rule marks this pairing to avoid.", {
              sourceColorwayKey,
              targetColorwayKey,
            }),
          };
        }

        const score = match.compatibility === ColorCompatibility.MATCHING
          ? 0.85
          : match.compatibility === ColorCompatibility.COMPLEMENTARY
            ? 0.75
            : 0.55;
        return {
          score,
          reason: reason("compatible_colorway", score, VisualProfileSource.MERCHANT, "Colorway compatibility rule supports this pairing.", {
            sourceColorwayKey,
            targetColorwayKey,
            compatibility: match.compatibility,
          }),
        };
      }
    }
  }

  const paletteScore = paletteOverlap(item.visualProfile.dominantColors, peer.visualProfile.dominantColors);
  if (paletteScore > 0) {
    return {
      score: Math.max(0.3, paletteScore * 0.6),
      reason: reason("fallback_palette_match", Math.max(0.3, paletteScore * 0.6), "SYSTEM", "Palette overlap provides a soft visual match.", {
        paletteScore,
      }),
    };
  }

  return { score: 0.25, reason: null };
}

export function scoreStyleCoherence(input: StyleCoherenceInput): StyleCoherenceResult {
  const { items, compatibilityRules, candidateProducts = [] } = input;
  if (items.length <= 1) {
    return {
      coherenceScore: 1,
      status: "cohesive",
      reasons: [],
      suggestions: [],
    };
  }

  const reasons: StyleReason[] = [];
  let pairCount = 0;
  let pairScoreSum = 0;

  for (let index = 0; index < items.length; index += 1) {
    for (let peerIndex = index + 1; peerIndex < items.length; peerIndex += 1) {
      const result = getCompatibilityScore(items[index], items[peerIndex], compatibilityRules);
      pairCount += 1;
      pairScoreSum += result.score;
      if (result.reason) {
        reasons.push(result.reason);
      }
    }
  }

  const coherenceScore = Number((pairScoreSum / Math.max(1, pairCount)).toFixed(2));
  const status = coherenceScore >= 0.7 ? "cohesive" : coherenceScore >= 0.4 ? "mixed" : "clashing";
  const suggestions: StyleSuggestion[] = [];

  if (status !== "cohesive") {
    const cartProductIds = new Set(items.map((item) => item.productId));
    const collectionCounts = new Map<string, number>();
    for (const item of items) {
      for (const collection of item.visualProfile.effectiveCollections) {
        collectionCounts.set(collection.key, (collectionCounts.get(collection.key) ?? 0) + 1);
      }
    }

    const primaryCollection = Array.from(collectionCounts.entries()).sort((a, b) => b[1] - a[1])[0];
    if (primaryCollection && primaryCollection[1] >= 2) {
      const addCandidate = candidateProducts.find(
        (candidate) =>
          candidate.availableForSale &&
          !cartProductIds.has(candidate.productId) &&
          candidate.visualProfile.effectiveCollections.some((collection) => collection.key === primaryCollection[0]),
      );

      if (addCandidate) {
        suggestions.push({
          type: "add",
          candidateProductId: addCandidate.productId,
          candidateVariantId: addCandidate.selectedVariantId,
          confidence: 0.82,
          reasons: [
            reason("same_collection", 0.82, "SYSTEM", "Completes the coordinated collection already present in the cart.", {
              collectionKey: primaryCollection[0],
            }),
          ],
        });
      }
    }

    if (status === "clashing") {
      const bestCandidate = candidateProducts
        .filter((candidate) => candidate.availableForSale)
        .map((candidate) => {
          const matchingCartItem = items.find((item) =>
            item.categoryTags.some((category) => candidate.categoryTags.includes(category)),
          );

          if (!matchingCartItem) {
            return null;
          }

          const compatibility = items
            .filter((item) => item.productId !== matchingCartItem.productId)
            .map((item) => getCompatibilityScore(candidate, item, compatibilityRules));
          const projectedScore = compatibility.reduce((sum, entry) => sum + entry.score, 0) / Math.max(1, compatibility.length);

          return {
            candidate,
            projectedScore,
          };
        })
        .filter((entry): entry is { candidate: CartVisualItem; projectedScore: number } => Boolean(entry))
        .sort((a, b) => b.projectedScore - a.projectedScore)[0];

      if (bestCandidate && bestCandidate.projectedScore > coherenceScore) {
        suggestions.push({
          type: "swap",
          candidateProductId: bestCandidate.candidate.productId,
          candidateVariantId: bestCandidate.candidate.selectedVariantId,
          confidence: Number(Math.min(0.9, bestCandidate.projectedScore).toFixed(2)),
          reasons: [
            reason("compatible_colorway", Number(Math.min(0.9, bestCandidate.projectedScore).toFixed(2)), "SYSTEM", "Alternative improves color compatibility while preserving category intent.", {
              projectedScore: bestCandidate.projectedScore,
            }),
          ],
        });
      }
    }
  }

  return {
    coherenceScore,
    status,
    reasons,
    suggestions,
  };
}