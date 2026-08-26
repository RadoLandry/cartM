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

function colorwayOverlap(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) {
    return 0;
  }

  const shared = a.filter((value) => b.includes(value));
  return shared.length / Math.min(a.length, b.length);
}

function getActiveColorwayKeys(item: CartVisualItem): string[] {
  return item.selectedColorwayKey
    ? [item.selectedColorwayKey]
    : item.visualProfile.effectiveColorwayKeys;
}

function getCompatibilityScore(
  item: CartVisualItem,
  peer: CartVisualItem,
  rules: StyleCompatibilityRule[],
  ruleLookup?: Map<string, StyleCompatibilityRule>,
): { score: number; reason: StyleReason | null } {
  const sourceColorwayKeys = getActiveColorwayKeys(item);
  const targetColorwayKeys = getActiveColorwayKeys(peer);

  for (const sourceColorwayKey of sourceColorwayKeys) {
    for (const targetColorwayKey of targetColorwayKeys) {
      const match = ruleLookup
        ? ruleLookup.get(`${sourceColorwayKey}|${targetColorwayKey}`)
        : rules.find(
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

  const collectionKeysA = item.visualProfile.effectiveCollections.map((collection) => collection.key);
  const collectionKeysB = peer.visualProfile.effectiveCollections.map((collection) => collection.key);
  const sharedCollections = collectionKeysA.filter((key) => collectionKeysB.includes(key));
  if (sharedCollections.length > 0) {
    return {
      score: 0.9,
      reason: reason("same_collection", 0.9, "SYSTEM", "Items belong to the same coordinated collection.", { sharedCollections }),
    };
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

function buildCompatibilityRuleLookup(rules: StyleCompatibilityRule[]): Map<string, StyleCompatibilityRule> {
  const map = new Map<string, StyleCompatibilityRule>();
  for (const rule of rules) {
    map.set(`${rule.sourceColorwayKey}|${rule.targetColorwayKey}`, rule);
  }

  return map;
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

  // Pre-index rules once; avoids O(rules) scan per pair comparison
  const ruleLookup = buildCompatibilityRuleLookup(compatibilityRules);
  const reasons: StyleReason[] = [];
  let pairCount = 0;
  let pairScoreSum = 0;

  // Cap pair evaluation at 15 items to bound O(n²) growth for unexpectedly large carts
  const scoredItems = items.slice(0, 15);
  for (let index = 0; index < scoredItems.length; index += 1) {
    for (let peerIndex = index + 1; peerIndex < scoredItems.length; peerIndex += 1) {
      const result = getCompatibilityScore(scoredItems[index], scoredItems[peerIndex], compatibilityRules, ruleLookup);
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

  // Skip candidate pipeline entirely when no candidates were provided
  if (status !== "cohesive" && candidateProducts.length > 0) {
    const cartProductIds = new Set(items.map((item) => item.productId));
    const collectionCounts = new Map<string, number>();
    for (const item of items) {
      for (const collection of item.visualProfile.effectiveCollections) {
        collectionCounts.set(collection.key, (collectionCounts.get(collection.key) ?? 0) + 1);
      }
    }

    const rankedCollections = Array.from(collectionCounts.entries()).sort((a, b) => b[1] - a[1]);
    const primaryCollection = rankedCollections[0];
    const secondaryCollection = rankedCollections[1];
    const hasAmbiguousTheme = Boolean(
      primaryCollection
      && secondaryCollection
      && primaryCollection[1] >= 2
      && primaryCollection[1] === secondaryCollection[1],
    );

    if (!hasAmbiguousTheme && primaryCollection && primaryCollection[1] >= 2) {
      const cartColorwayKeys = new Set(
        items.flatMap((item) => item.visualProfile.effectiveColorwayKeys),
      );
      const addCandidate = candidateProducts
        .filter(
          (candidate) =>
            candidate.availableForSale &&
            !cartProductIds.has(candidate.productId) &&
            candidate.visualProfile.effectiveCollections.some((collection) => collection.key === primaryCollection[0]),
        )
        .map((candidate) => {
          const collectionBoost = candidate.visualProfile.effectiveCollections.some(
            (collection) => collection.key === primaryCollection[0],
          )
            ? 0.55
            : 0;
          const colorwayBoost = colorwayOverlap(
            candidate.visualProfile.effectiveColorwayKeys,
            Array.from(cartColorwayKeys),
          ) * 0.25;
          const confidenceBoost = (candidate.visualProfile.visualConfidence ?? 0) * 0.2;

          return {
            candidate,
            rankScore: collectionBoost + colorwayBoost + confidenceBoost,
          };
        })
        .sort((left, right) => right.rankScore - left.rankScore)[0]?.candidate;

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

    if (!hasAmbiguousTheme && status === "clashing") {
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
          const remainingCartColorwayKeys = Array.from(new Set(
            items
              .filter((item) => item.productId !== matchingCartItem.productId)
              .flatMap((item) => getActiveColorwayKeys(item)),
          ));
          const variantAlignment = colorwayOverlap(
            getActiveColorwayKeys(candidate),
            remainingCartColorwayKeys,
          );

          return {
            candidate,
            projectedScore,
            rankScore: projectedScore + variantAlignment * 0.05,
          };
        })
        .filter((entry): entry is { candidate: CartVisualItem; projectedScore: number; rankScore: number } => Boolean(entry))
        .sort((a, b) => b.rankScore - a.rankScore || b.projectedScore - a.projectedScore)[0];

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

  const seenSuggestions = new Set<string>();
  const uniqueSuggestions = suggestions.filter((suggestion) => {
    const key = `${suggestion.candidateProductId}:${suggestion.candidateVariantId ?? "default"}`;
    if (seenSuggestions.has(key)) {
      return false;
    }

    seenSuggestions.add(key);
    return true;
  });

  return {
    coherenceScore,
    status,
    reasons,
    suggestions: uniqueSuggestions,
  };
}