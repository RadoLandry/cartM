import { describe, expect, it } from "vitest";

import { buildVisualRecommendations } from "../../../app/lib/cart-intelligence/recommendations";
import {
  makeAdditionCandidates,
  makeClashingCart,
  makeCoordinatedCart,
  makeSwapCandidates,
} from "../../helpers/style-fixtures";

describe("buildVisualRecommendations", () => {
  it("builds a coordinated-addition shopper payload with a dominant collection theme", () => {
    const payload = buildVisualRecommendations(
      {
        coherenceScore: 0.58,
        status: "mixed",
        reasons: [
          {
            reasonType: "same_collection",
            confidence: 0.9,
            source: "SYSTEM",
            message: "Items belong to the same coordinated collection.",
            metadata: { sharedCollections: ["pro-series"] },
          },
        ],
        suggestions: [
          {
            type: "add",
            candidateProductId: "prod-shin-guards-black-gold",
            candidateVariantId: "var-shin-guards-black-gold",
            confidence: 0.84,
            reasons: [
              {
                reasonType: "same_collection",
                confidence: 0.84,
                source: "SYSTEM",
                message: "Completes the coordinated collection already present in the cart.",
              },
            ],
          },
        ],
      },
      makeAdditionCandidates(),
      makeCoordinatedCart(),
    );

    expect(payload.summary).toEqual({
      status: "mixed",
      coherenceScore: "0.58",
      dominantTheme: {
        type: "collection",
        key: "pro-series",
        label: "Pro Series",
        confidence: 0.84,
      },
    });
    expect(payload.opportunities).toEqual([
      {
        type: "collection_completion",
        productId: "prod-shin-guards-black-gold",
        variantId: "var-shin-guards-black-gold",
        title: "Shin Guards",
        confidence: 0.84,
        rank: 1,
        reasonLabel: "Completes the coordinated collection already present in the cart.",
        reasons: [
          {
            reasonType: "same_collection",
            confidence: 0.84,
            source: "SYSTEM",
            message: "Completes the coordinated collection already present in the cart.",
          },
        ],
      },
    ]);
  });

  it("builds shopper-facing swap opportunities with projected coherence scores", () => {
    const payload = buildVisualRecommendations(
      {
        coherenceScore: 0.22,
        status: "clashing",
        reasons: [
          {
            reasonType: "merchant_override",
            confidence: 0.95,
            source: "MERCHANT",
            message: "Merchant rule marks this pairing to avoid.",
          },
        ],
        suggestions: [
          {
            type: "swap",
            candidateProductId: "prod-headgear-black-gold",
            candidateVariantId: "var-headgear-black-gold",
            confidence: 0.9,
            reasons: [
              {
                reasonType: "compatible_colorway",
                confidence: 0.9,
                source: "SYSTEM",
                message: "Alternative improves color compatibility while preserving category intent.",
                metadata: { projectedScore: 0.9 },
              },
            ],
          },
        ],
      },
      makeSwapCandidates(),
      makeClashingCart(),
    );

    expect(payload.summary).toEqual({
      status: "clashing",
      coherenceScore: "0.22",
    });
    expect(payload.opportunities).toEqual([
      {
        type: "swap",
        productId: "prod-headgear-black-gold",
        variantId: "var-headgear-black-gold",
        title: "Replacement Headgear",
        confidence: 0.9,
        rank: 1,
        reasonLabel: "Alternative improves color compatibility while preserving category intent.",
        projectedCoherenceScore: "0.90",
        reasons: [
          {
            reasonType: "compatible_colorway",
            confidence: 0.9,
            source: "SYSTEM",
            message: "Alternative improves color compatibility while preserving category intent.",
            metadata: { projectedScore: 0.9 },
          },
        ],
      },
    ]);
  });
});