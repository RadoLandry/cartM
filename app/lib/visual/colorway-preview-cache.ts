import type { ColorwayPreviewResult } from "./colorway-preview.types";

interface ColorwayPreviewCacheRecord {
  key: string;
  createdAt: number;
  value: ColorwayPreviewResult;
}

const colorwayPreviewCache = new Map<string, ColorwayPreviewCacheRecord>();

export function getColorwayPreviewCache(key: string): ColorwayPreviewResult | null {
  return colorwayPreviewCache.get(key)?.value ?? null;
}

export function setColorwayPreviewCache(key: string, value: ColorwayPreviewResult) {
  colorwayPreviewCache.set(key, {
    key,
    createdAt: Date.now(),
    value,
  });
}

export function clearColorwayPreviewCache() {
  colorwayPreviewCache.clear();
}
