import { describe, it, expect } from "vitest";
import { VisualReviewStatus } from "@prisma/client";
import {
  buildVisualProfile,
  deriveColorwayKeysFromText,
  extractDominantColors,
  normalizeColorToken,
  resolveEffectiveVisualProfile,
  resolveSelectedColorwayKey,
  summarizeCollections,
} from "../../../app/lib/knowledge-graph/colorways";

describe("Colorways Extractor", () => {
  it("returns an empty array if imageUrl is null", async () => {
    const result = await extractDominantColors(null);
    expect(result).toEqual([]);
  });

  it("returns a deterministic fallback palette for a given image url", async () => {
    const resultA = await extractDominantColors("https://example.com/bad-image.jpg");
    const resultB = await extractDominantColors("https://example.com/bad-image.jpg");
    expect(resultA).toEqual(resultB);
    expect(resultA.length).toBeGreaterThan(0);
  });
});

describe("colorway normalization helpers", () => {
  it("normalizes synonymous color tokens", () => {
    expect(normalizeColorToken("Grey")).toBe("gray");
    expect(normalizeColorToken("Black / Gold")).toBe("black-gold");
  });

  it("derives normalized colorway keys from product text signals", () => {
    const result = deriveColorwayKeysFromText([
      "Matte Black Gold Gloves",
      "Limited edition",
      "navy",
    ]);

    expect(result).toContain("matte");
    expect(result).toContain("black");
    expect(result).toContain("black-gold");
    expect(result).toContain("navy");
  });

  it("deduplicates collection summary rows", () => {
    const result = summarizeCollections([
      { shopifyCollectionId: "gid://shopify/Collection/1", title: "Pro", handle: "pro" },
      { shopifyCollectionId: "gid://shopify/Collection/1", title: "Pro", handle: "pro" },
    ]);

    expect(result).toEqual([
      { shopifyCollectionId: "gid://shopify/Collection/1", title: "Pro", handle: "pro" },
    ]);
  });
});

describe("visual profile derivation", () => {
  it("builds a profile with confidence and auto-approval for rich signals", () => {
    const profile = buildVisualProfile({
      shop: "test.myshopify.com",
      productId: "prod-1",
      title: "Matte Black Gold Gloves",
      tags: ["navy"],
      metafields: { "custom.color": "black gold" },
      collections: [{ shopifyCollectionId: "col-1", title: "Pro", handle: "pro" }],
      dominantColors: ["#111827", "#d97706"],
      variants: [{ title: "Default Title", imageUrl: null }],
    });

    expect(profile.detectedColorwayKeys).toContain("black-gold");
    expect(profile.detectedCollections).toHaveLength(1);
    expect(profile.visualConfidence).toBeGreaterThanOrEqual(0.75);
    expect(profile.reviewStatus).toBe(VisualReviewStatus.AUTO_APPROVED);
  });

  it("prefers merchant overrides when resolving the effective profile", () => {
    const effective = resolveEffectiveVisualProfile({
      productId: "prod-1",
      dominantColors: ["#111827"],
      detectedColorwayKeys: ["black-gold"],
      overrideColorwayKeys: ["black"],
      detectedCollections: [{ shopifyCollectionId: "col-1", title: "Pro", handle: "pro" }],
      overrideCollections: [{ shopifyCollectionId: "col-2", title: "Legacy", handle: "legacy" }],
      visualConfidence: 0.82,
      reviewStatus: VisualReviewStatus.MERCHANT_REVIEWED,
      source: "HYBRID",
      extractionSummary: {
        tokenMatches: ["black-gold"],
        paletteSource: "image",
        notes: [],
      },
    });

    expect(effective.colorwayKeys).toEqual(["black"]);
    expect(effective.collections).toEqual([
      { shopifyCollectionId: "col-2", title: "Legacy", handle: "legacy" },
    ]);
  });

  it("keeps merchant override colorways authoritative over variant title tokens", () => {
    const selectedColorwayKey = resolveSelectedColorwayKey(
      "Red / Small",
      ["black-gold"],
      { preferFallback: true },
    );

    expect(selectedColorwayKey).toBe("black-gold");
  });
});