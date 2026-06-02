import { z } from "zod";

export type ColorwayPreviewStatus =
  | "ok"
  | "partial"
  | "invalid"
  | "fallback"
  | "error";

export type ColorwayOmissionReasonCode =
  | "missing_image"
  | "unsupported_type"
  | "fetch_failed"
  | "invalid_variant";

export interface ColorwayPreviewRequestInput {
  shopDomain: string;
  sessionId: string;
  cartId: string;
  selectedLineId: string;
  proposedVariantId: string;
  availableVariantIds?: string[];
  currencyCode: string;
  surface: "cart_drawer" | "cart_page" | "chat";
  viewportHint?: "mobile" | "desktop" | "unknown";
  forceRegenerate?: boolean;
  cart: {
    items: ColorwayPreviewCartLineInput[];
  };
}

export interface ColorwayPreviewCartLineInput {
  lineId?: string;
  productId?: string;
  variantId?: string;
  productTitle?: string;
  variantTitle?: string;
  quantity?: number;
  imageUrl?: string;
  discipline?: string;
}

export interface ColorwayPreviewChange {
  selectedLineId: string;
  fromVariantId: string;
  toVariantId: string;
  changedLabel: string;
}

export interface ColorwayPreviewComparison {
  currentAssetUrl: string | null;
  proposedAssetUrl: string | null;
  comparisonAssetUrl: string | null;
  mimeType: "image/png" | "image/webp" | null;
  width: number | null;
  height: number | null;
  reused: boolean;
}

export interface ColorwayPreviewOmission {
  lineId: string;
  scope: "current" | "proposed" | "both";
  reasonCode: ColorwayOmissionReasonCode;
  reasonDetail?: string;
}

export interface ColorwayPreviewResult {
  status: ColorwayPreviewStatus;
  comparison: ColorwayPreviewComparison;
  change: ColorwayPreviewChange;
  context: {
    inferredDiscipline: string | null;
    layoutId: string;
    templateVersion: string;
  };
  omissions: ColorwayPreviewOmission[];
  diagnostics: {
    requestId: string;
    generationMs: number | null;
  };
}

export const ColorwayPreviewLineInputSchema = z.object({
  lineId: z.string().min(1).optional(),
  productId: z.string().min(1).optional(),
  variantId: z.string().min(1).optional(),
  productTitle: z.string().min(1).optional(),
  variantTitle: z.string().min(1).optional(),
  quantity: z.coerce.number().int().min(1).optional(),
  imageUrl: z.string().url().optional(),
  discipline: z.string().min(1).optional(),
});

export const ColorwayPreviewRequestSchema = z.object({
  shopDomain: z.string().min(1),
  sessionId: z.string().min(1),
  cartId: z.string().min(1),
  selectedLineId: z.string().min(1),
  proposedVariantId: z.string().min(1),
  availableVariantIds: z.array(z.string().min(1)).optional(),
  currencyCode: z.string().min(3).max(3).default("USD"),
  surface: z.enum(["cart_drawer", "cart_page", "chat"]),
  viewportHint: z.enum(["mobile", "desktop", "unknown"]).optional(),
  forceRegenerate: z.boolean().optional(),
  cart: z.object({
    items: z.array(ColorwayPreviewLineInputSchema).default([]),
  }),
});

export function parseColorwayPreviewRequestInput(payload: unknown): ColorwayPreviewRequestInput {
  return ColorwayPreviewRequestSchema.parse(payload);
}
