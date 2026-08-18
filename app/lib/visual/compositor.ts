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
  mimeType: "image/png" | "image/webp" | "image/svg+xml" | null;
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
  snapshot: StorefrontKitPreviewSnapshot;
  layoutProfile: LayoutProfile;
  outputFormat: "png" | "webp" | "svg";
  createdAt: number;
}

interface ComposeKitPreviewInput {
  snapshot: StorefrontKitPreviewSnapshot;
  layoutProfile: LayoutProfile;
  forceRegenerate?: boolean;
  outputFormat?: "png" | "webp" | "svg";
}

interface ComposeColorwayComparisonInput {
  snapshot: StorefrontKitPreviewSnapshot;
  layoutProfile: LayoutProfile;
  selectedLineId: string;
  currentVariantId: string;
  proposedVariantId: string;
  forceRegenerate?: boolean;
  outputFormat?: "png" | "webp" | "svg";
}

export interface ColorwayComparisonPreview {
  currentAssetUrl: string | null;
  proposedAssetUrl: string | null;
  comparisonAssetUrl: string | null;
  mimeType: "image/png" | "image/webp" | "image/svg+xml" | null;
  width: number | null;
  height: number | null;
  reused: boolean;
}

export interface ColorwayComparisonResult {
  status: "ok" | "partial" | "fallback" | "error";
  comparison: ColorwayComparisonPreview;
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

const previewCache = new Map<string, CacheRecord>();

export function buildPreviewCacheKey(input: {
  snapshotSignature: string;
  layoutId: string;
  templateVersion: string;
  outputFormat?: "png" | "webp" | "svg";
}): string {
  const format = input.outputFormat ?? "svg";
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

function createAssetUrl(cacheKey: string, outputFormat: "png" | "webp" | "svg"): string {
  return `/api/ai/kit-preview/assets/${cacheKey}.${outputFormat}`;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function colorFromText(value: string): string {
  const hash = createHash("sha256").update(value).digest("hex");
  return `#${hash.slice(0, 6)}`;
}

function truncateLabel(value: string, maxLength = 34): string {
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}...` : value;
}

function renderPreviewSvg(record: CacheRecord): string {
  const entries = record.snapshot.items
    .filter((item) => item.renderEligible)
    .slice(0, record.layoutProfile.slots.length)
    .map((item, index) => ({ item, slot: record.layoutProfile.slots[index] }))
    .filter((entry): entry is { item: StorefrontKitPreviewSnapshot["items"][number]; slot: LayoutProfile["slots"][number] } => Boolean(entry.slot));
  const title = record.snapshot.inferredDiscipline
    ? `${record.snapshot.inferredDiscipline.replace(/_/g, " ")} kit preview`
    : "Cart kit preview";
  const itemsMarkup = entries.map(({ item, slot }) => {
    const x = Math.round((slot.x / 100) * 1024);
    const y = Math.round((slot.y / 100) * 1024);
    const width = Math.round((slot.width / 100) * 1024);
    const height = Math.round((slot.height / 100) * 1024);
    const label = escapeXml(truncateLabel(item.productTitle || item.variantTitle || "Cart item"));
    const fill = colorFromText(`${item.productId ?? item.lineId}:${item.variantId ?? ""}`);

    return `
      <g transform="translate(${x} ${y})">
        <rect width="${width}" height="${height}" rx="28" fill="#ffffff" stroke="#d7dee8" stroke-width="4" />
        <rect x="18" y="18" width="${Math.max(1, width - 36)}" height="${Math.max(1, height - 88)}" rx="22" fill="${fill}" opacity="0.10" />
        <image href="${escapeXml(item.imageUrl ?? "")}" x="24" y="24" width="${Math.max(1, width - 48)}" height="${Math.max(1, height - 118)}" preserveAspectRatio="xMidYMid meet" />
        <rect x="18" y="${Math.max(18, height - 58)}" width="${Math.max(1, width - 36)}" height="40" rx="14" fill="#f8fafc" />
        <text x="${width / 2}" y="${Math.max(40, height - 32)}" text-anchor="middle" font-family="Verdana, Geneva, sans-serif" font-size="22" font-weight="700" fill="#223047">${label}</text>
      </g>
    `;
  }).join("");
  const emptyMarkup = entries.length === 0
    ? `<text x="512" y="520" text-anchor="middle" font-family="Verdana, Geneva, sans-serif" font-size="30" fill="#64748b">No product images available</text>`
    : "";

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024" role="img" aria-label="${escapeXml(title)}">
  <defs>
    <linearGradient id="cm-bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#f8fafc" />
      <stop offset="1" stop-color="#e8eef6" />
    </linearGradient>
  </defs>
  <rect width="1024" height="1024" fill="url(#cm-bg)" />
  <text x="48" y="74" font-family="Verdana, Geneva, sans-serif" font-size="34" font-weight="700" fill="#182235">${escapeXml(title)}</text>
  <text x="48" y="112" font-family="Verdana, Geneva, sans-serif" font-size="20" fill="#64748b">${escapeXml(record.layoutProfile.layoutId)} - ${escapeXml(record.layoutProfile.templateVersion)}</text>
  ${itemsMarkup}
  ${emptyMarkup}
</svg>`;
}

export function getPreviewAsset(cacheKey: string) {
  const record = previewCache.get(cacheKey);

  if (!record) {
    return null;
  }

  return {
    body: renderPreviewSvg(record),
    mimeType: "image/svg+xml" as const,
  };
}

export function composeKitPreview(input: ComposeKitPreviewInput): KitCompositionResult {
  const startedAt = Date.now();
  const outputFormat = input.outputFormat ?? "svg";

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

  const mimeType = outputFormat === "png" ? "image/png" : outputFormat === "webp" ? "image/webp" : "image/svg+xml";
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
    snapshot: input.snapshot,
    layoutProfile: input.layoutProfile,
    outputFormat,
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

function withQueryParam(url: string | null, key: string, value: string): string | null {
  if (!url) {
    return null;
  }

  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}${key}=${encodeURIComponent(value)}`;
}

function buildProposedSnapshot(input: ComposeColorwayComparisonInput): StorefrontKitPreviewSnapshot {
  const nextItems = input.snapshot.items.map((item) => {
    if (item.lineId !== input.selectedLineId) {
      return item;
    }

    return {
      ...item,
      variantId: input.proposedVariantId,
    };
  });

  return {
    ...input.snapshot,
    items: nextItems,
    signatureSeed: `${input.snapshot.signatureSeed}::swap:${input.selectedLineId}:${input.currentVariantId}->${input.proposedVariantId}`,
  };
}

export function composeColorwayComparison(input: ComposeColorwayComparisonInput): ColorwayComparisonResult {
  const current = composeKitPreview({
    snapshot: input.snapshot,
    layoutProfile: input.layoutProfile,
    forceRegenerate: input.forceRegenerate,
    outputFormat: input.outputFormat,
  });

  const proposed = composeKitPreview({
    snapshot: buildProposedSnapshot(input),
    layoutProfile: input.layoutProfile,
    forceRegenerate: input.forceRegenerate,
    outputFormat: input.outputFormat,
  });

  const status = [current.status, proposed.status].includes("error")
    ? "error"
    : [current.status, proposed.status].includes("fallback")
      ? "fallback"
      : [current.status, proposed.status].includes("partial")
        ? "partial"
        : "ok";

  return {
    status,
    comparison: {
      currentAssetUrl: current.preview.assetUrl,
      proposedAssetUrl: proposed.preview.assetUrl,
      comparisonAssetUrl: withQueryParam(proposed.preview.assetUrl, "compare_to", "current"),
      mimeType: proposed.preview.mimeType,
      width: proposed.preview.width,
      height: proposed.preview.height,
      reused: current.preview.reused && proposed.preview.reused,
    },
    context: proposed.context,
    omissions: [...current.omissions, ...proposed.omissions],
    diagnostics: {
      cacheKey: proposed.diagnostics.cacheKey,
      generationMs: (current.diagnostics.generationMs ?? 0) + (proposed.diagnostics.generationMs ?? 0),
    },
  };
}

export function clearPreviewCache() {
  previewCache.clear();
}
