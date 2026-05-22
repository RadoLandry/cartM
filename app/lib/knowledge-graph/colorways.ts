import {
  ColorCompatibility,
  VisualProfileSource,
  VisualReviewStatus,
} from "@prisma/client";
import type { NormalizedCollectionSummary, NormalizedProduct, NormalizedVariant } from "./normalization";

const FALLBACK_PALETTE = [
  "#111827",
  "#f9fafb",
  "#1f2937",
  "#d97706",
  "#0f766e",
  "#7c3aed",
  "#dc2626",
  "#2563eb",
];

const KNOWN_COLOR_TOKENS = new Set([
  "black",
  "white",
  "grey",
  "gray",
  "red",
  "blue",
  "green",
  "yellow",
  "orange",
  "pink",
  "purple",
  "gold",
  "silver",
  "brown",
  "navy",
  "beige",
  "cream",
  "olive",
  "tan",
  "khaki",
  "burgundy",
  "teal",
  "camo",
  "matte",
]);

const COLOR_CANONICAL_MAP: Record<string, string> = {
  grey: "gray",
  charcoal: "gray",
  crimson: "red",
  maroon: "burgundy",
  ivory: "cream",
  sand: "beige",
};

export interface CollectionSummary {
  shopifyCollectionId: string;
  title: string;
  handle: string;
}

export interface VisualExtractionSummary {
  tokenMatches: string[];
  paletteSource: "image" | "fallback" | "none";
  notes: string[];
}

export interface VisualProfileInput {
  shop: string;
  productId: string;
  title: string;
  tags: string[];
  metafields: Record<string, string>;
  collections: CollectionSummary[];
  dominantColors: string[];
  variants: Array<Pick<NormalizedVariant, "title" | "imageUrl">>;
  existingOverrideColorwayKeys?: string[];
  existingOverrideCollections?: CollectionSummary[] | null;
}

export interface VisualProfileRecord {
  productId: string;
  shop: string;
  dominantColors: string[];
  detectedColorwayKeys: string[];
  overrideColorwayKeys: string[];
  detectedCollections: CollectionSummary[];
  overrideCollections: CollectionSummary[] | null;
  visualConfidence: number | null;
  reviewStatus: VisualReviewStatus;
  source: VisualProfileSource;
  extractionSummary: VisualExtractionSummary;
}

export interface EffectiveVisualProfile {
  productId: string;
  colorwayKeys: string[];
  collections: CollectionSummary[];
  dominantColors: string[];
  visualConfidence: number | null;
  reviewStatus: VisualReviewStatus;
  source: VisualProfileSource;
  extractionSummary: VisualExtractionSummary;
}

export interface ColorCompatibilityRuleRow {
  id: string;
  sourceColorwayKey: string;
  targetColorwayKey: string;
  compatibility: ColorCompatibility;
  source: VisualProfileSource;
  rationale: string | null;
}

export interface VisualAdminRow {
  id: string;
  productId: string;
  shopifyProductId: string;
  title: string;
  handle: string;
  dominantColors: string[];
  detectedColorwayKeys: string[];
  effectiveColorwayKeys: string[];
  detectedCollections: CollectionSummary[];
  effectiveCollections: CollectionSummary[];
  visualConfidence: number | null;
  reviewStatus: VisualReviewStatus;
  source: VisualProfileSource;
}

export interface StyleReason {
  reasonType:
    | "same_collection"
    | "compatible_colorway"
    | "merchant_override"
    | "fallback_palette_match";
  confidence: number;
  source: VisualProfileSource | "SYSTEM";
  message: string;
  metadata?: Record<string, unknown>;
}

export interface VisualRecommendationPayload {
  type: "collection_completion" | "swap";
  productId: string;
  variantId?: string;
  confidence: number;
  reasons: StyleReason[];
}

export function normalizeColorToken(value: string): string {
  const normalized = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return COLOR_CANONICAL_MAP[normalized] ?? normalized;
}

export function summarizeCollections(collections: NormalizedCollectionSummary[]): CollectionSummary[] {
  const seen = new Set<string>();
  const summaries: CollectionSummary[] = [];

  for (const collection of collections) {
    if (seen.has(collection.shopifyCollectionId)) {
      continue;
    }

    seen.add(collection.shopifyCollectionId);
    summaries.push({
      shopifyCollectionId: collection.shopifyCollectionId,
      title: collection.title,
      handle: collection.handle,
    });
  }

  return summaries;
}

function tokenizeForColorways(values: string[]): string[] {
  return values
    .flatMap((value) => value.toLowerCase().split(/[^a-z0-9]+/))
    .map((token) => COLOR_CANONICAL_MAP[token] ?? token)
    .filter(Boolean);
}

export function deriveColorwayKeysFromText(values: string[]): string[] {
  const tokens = tokenizeForColorways(values);
  const matches = tokens.filter((token) => KNOWN_COLOR_TOKENS.has(token));
  const colorways = new Set<string>();

  for (let index = 0; index < matches.length; index += 1) {
    const current = normalizeColorToken(matches[index]);
    if (!current) {
      continue;
    }

    colorways.add(current);

    const next = matches[index + 1];
    if (next && next !== current) {
      colorways.add(`${current}-${normalizeColorToken(next)}`);
    }
  }

  return Array.from(colorways);
}

function hashString(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }

  return hash;
}

export async function extractDominantColors(imageUrl: string | null): Promise<string[]> {
  if (!imageUrl) {
    return [];
  }

  const hash = hashString(imageUrl);
  const first = FALLBACK_PALETTE[hash % FALLBACK_PALETTE.length];
  const second = FALLBACK_PALETTE[(hash + 3) % FALLBACK_PALETTE.length];
  return first === second ? [first] : [first, second];
}

export function scoreVisualConfidence(input: {
  colorwayKeys: string[];
  collections: CollectionSummary[];
  dominantColors: string[];
}): number {
  let score = 0;

  if (input.collections.length > 0) {
    score += 0.45;
  }

  if (input.colorwayKeys.length > 0) {
    score += input.colorwayKeys.length > 1 ? 0.35 : 0.25;
  }

  if (input.dominantColors.length > 0) {
    score += 0.1;
  }

  if (input.colorwayKeys.some((key) => key.includes("-"))) {
    score += 0.1;
  }

  return Math.min(1, Number(score.toFixed(2)));
}

export function buildVisualProfile(input: VisualProfileInput): VisualProfileRecord {
  const textSignals = [
    input.title,
    ...input.tags,
    ...Object.values(input.metafields),
    ...input.variants.map((variant) => variant.title),
  ];

  const detectedColorwayKeys = deriveColorwayKeysFromText(textSignals);
  const detectedCollections = summarizeCollections(input.collections);
  const visualConfidence = scoreVisualConfidence({
    colorwayKeys: detectedColorwayKeys,
    collections: detectedCollections,
    dominantColors: input.dominantColors,
  });
  const source = input.existingOverrideColorwayKeys?.length || input.existingOverrideCollections?.length
    ? VisualProfileSource.HYBRID
    : VisualProfileSource.AUTO;

  return {
    productId: input.productId,
    shop: input.shop,
    dominantColors: input.dominantColors,
    detectedColorwayKeys,
    overrideColorwayKeys: input.existingOverrideColorwayKeys ?? [],
    detectedCollections,
    overrideCollections: input.existingOverrideCollections ?? null,
    visualConfidence,
    reviewStatus: visualConfidence >= 0.75 ? VisualReviewStatus.AUTO_APPROVED : VisualReviewStatus.NEEDS_REVIEW,
    source,
    extractionSummary: {
      tokenMatches: detectedColorwayKeys,
      paletteSource: input.dominantColors.length > 0 ? "image" : "none",
      notes: detectedColorwayKeys.length > 0 ? [] : ["No colorway tokens matched known vocabulary"],
    },
  };
}

export function resolveEffectiveVisualProfile(profile: Pick<
  VisualProfileRecord,
  | "productId"
  | "dominantColors"
  | "detectedColorwayKeys"
  | "overrideColorwayKeys"
  | "detectedCollections"
  | "overrideCollections"
  | "visualConfidence"
  | "reviewStatus"
  | "source"
  | "extractionSummary"
>): EffectiveVisualProfile {
  return {
    productId: profile.productId,
    colorwayKeys: profile.overrideColorwayKeys.length > 0
      ? profile.overrideColorwayKeys
      : profile.detectedColorwayKeys,
    collections: profile.overrideCollections && profile.overrideCollections.length > 0
      ? profile.overrideCollections
      : profile.detectedCollections,
    dominantColors: profile.dominantColors,
    visualConfidence: profile.visualConfidence,
    reviewStatus: profile.reviewStatus,
    source: profile.source,
    extractionSummary: profile.extractionSummary,
  };
}

export function mapProductToVisualProfile(
  product: Pick<NormalizedProduct, "shopifyProductId" | "title" | "tags" | "metafields" | "collectionSummaries"> & {
    id: string;
    shop: string;
    dominantColors: string[];
    variants: Array<Pick<NormalizedVariant, "title" | "imageUrl">>;
  },
  overrides?: {
    overrideColorwayKeys?: string[];
    overrideCollections?: CollectionSummary[] | null;
  },
): VisualProfileRecord {
  return buildVisualProfile({
    shop: product.shop,
    productId: product.id,
    title: product.title,
    tags: product.tags,
    metafields: product.metafields,
    collections: summarizeCollections(product.collectionSummaries),
    dominantColors: product.dominantColors,
    variants: product.variants,
    existingOverrideColorwayKeys: overrides?.overrideColorwayKeys,
    existingOverrideCollections: overrides?.overrideCollections,
  });
}

export function resolveColorCompatibility(
  sourceColorwayKeys: string[],
  targetColorwayKeys: string[],
  rules: ColorCompatibilityRuleRow[],
): ColorCompatibility | null {
  for (const sourceColorwayKey of sourceColorwayKeys) {
    for (const targetColorwayKey of targetColorwayKeys) {
      const match = rules.find(
        (rule) =>
          rule.sourceColorwayKey === sourceColorwayKey &&
          rule.targetColorwayKey === targetColorwayKey,
      );

      if (match) {
        return match.compatibility;
      }
    }
  }

  return null;
}