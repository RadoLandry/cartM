import { createHash } from "node:crypto";

import type { LayoutProfile } from "./templates";
import type { StorefrontKitPreviewSnapshot } from "../shopify/storefront-cart";

export type OmissionReasonCode =
  | "missing_image"
  | "unsupported_type"
  | "fetch_failed"
  | "invalid_variant";

export interface OmissionEntry {
  lineId: string;
  reasonCode: OmissionReasonCode;
  reasonDetail?: string;
}

export interface KitPreviewAsset {
  assetUrl: string | null;
  mimeType: "image/png" | "image/webp" | null;
  width: number | null;
  height: number | null;
  reused: boolean;
}

export interface KitCompositionResult {
  status: "ok" | "partial" | "fallback" | "error";
  preview: KitPreviewAsset;
  context: {
    inferredDiscipline: string | null;
    layoutId: string;
    templateVersion: string;
  };
  omissions: OmissionEntry[];
  diagnostics: {
    cacheKey: string;
    generationMs: number | null;
  };
}

interface CacheRecord {
  key: string;
  preview: KitPreviewAsset;
  createdAt: number;
}

interface ComposeKitPreviewInput {
  snapshot: StorefrontKitPreviewSnapshot;
  layoutProfile: LayoutProfile;
  forceRegenerate?: boolean;
  outputFormat?: "png" | "webp";
}

const previewCache = new Map<string, CacheRecord>();

export function buildPreviewCacheKey(input: {
  snapshotSignature: string;
  layoutId: string;
  templateVersion: string;
  outputFormat?: "png" | "webp";
}): string {
  const format = input.outputFormat ?? "webp";
  const raw = [
    input.snapshotSignature,
    input.layoutId,
    input.templateVersion,
    format,
  ].join("::");

  return createHash("sha256").update(raw).digest("hex");
}

function buildOmissions(snapshot: StorefrontKitPreviewSnapshot): OmissionEntry[] {
  return snapshot.items
    .filter((item) => !item.renderEligible)
    .map((item) => ({
      lineId: item.lineId,
      reasonCode: item.imageUrl ? "invalid_variant" : "missing_image",
    }));
}

function createAssetUrl(cacheKey: string, outputFormat: "png" | "webp"): string {
  return `/api/ai/kit-preview/assets/${cacheKey}.${outputFormat}`;
}

export function composeKitPreview(input: ComposeKitPreviewInput): KitCompositionResult {
  const startedAt = Date.now();
  const outputFormat = input.outputFormat ?? "webp";

  const cacheKey = buildPreviewCacheKey({
    snapshotSignature: input.snapshot.signatureSeed,
    layoutId: input.layoutProfile.layoutId,
    templateVersion: input.layoutProfile.templateVersion,
    outputFormat,
  });

  const cached = previewCache.get(cacheKey);
  if (cached && !input.forceRegenerate) {
    return {
      status: "ok",
      preview: {
        ...cached.preview,
        reused: true,
      },
      context: {
        inferredDiscipline: input.snapshot.inferredDiscipline,
        layoutId: input.layoutProfile.layoutId,
        templateVersion: input.layoutProfile.templateVersion,
      },
      omissions: buildOmissions(input.snapshot),
      diagnostics: {
        cacheKey,
        generationMs: null,
      },
    };
  }

  const omissions = buildOmissions(input.snapshot);
  const eligibleItems = input.snapshot.items.filter((item) => item.renderEligible);

  if (eligibleItems.length === 0) {
    return {
      status: "fallback",
      preview: {
        assetUrl: null,
        mimeType: null,
        width: null,
        height: null,
        reused: false,
      },
      context: {
        inferredDiscipline: input.snapshot.inferredDiscipline,
        layoutId: input.layoutProfile.layoutId,
        templateVersion: input.layoutProfile.templateVersion,
      },
      omissions,
      diagnostics: {
        cacheKey,
        generationMs: Date.now() - startedAt,
      },
    };
  }

  const mimeType = outputFormat === "png" ? "image/png" : "image/webp";
  const preview: KitPreviewAsset = {
    assetUrl: createAssetUrl(cacheKey, outputFormat),
    mimeType,
    width: 1024,
    height: 1024,
    reused: false,
  };

  previewCache.set(cacheKey, {
    key: cacheKey,
    preview,
    createdAt: Date.now(),
  });

  return {
    status: omissions.length > 0 ? "partial" : "ok",
    preview,
    context: {
      inferredDiscipline: input.snapshot.inferredDiscipline,
      layoutId: input.layoutProfile.layoutId,
      templateVersion: input.layoutProfile.templateVersion,
    },
    omissions,
    diagnostics: {
      cacheKey,
      generationMs: Date.now() - startedAt,
    },
  };
}

export function clearPreviewCache() {
  previewCache.clear();
}
