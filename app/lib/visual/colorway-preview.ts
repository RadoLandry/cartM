import type {
  ColorwayPreviewChange,
  ColorwayPreviewComparison,
  ColorwayPreviewRequestInput,
  ColorwayPreviewResult,
  KitPreviewResult,
} from "./colorway-preview.types";
import { composeColorwayComparison, composeKitPreview } from "./compositor";
import { buildColorwayPreviewSignature, normalizeColorwaySignatureSeed } from "./colorway-signature";
import { resolveLayoutProfile } from "./templates";
import { normalizeStorefrontCartForPreview } from "../shopify/storefront-cart";
import { getColorwayPreviewCache, setColorwayPreviewCache } from "./colorway-preview-cache";
import type { OmissionReasonCode } from "./compositor";

interface ColorwayStateContext {
  requestId: string;
  selectedLineId: string;
  currentVariantId: string;
  proposedVariantId: string;
  inferredDiscipline: string | null;
  layoutId: string;
  templateVersion: string;
  generationMs: number | null;
  omissions?: ColorwayPreviewResult["omissions"];
  comparison?: Partial<ColorwayPreviewComparison>;
}

export function mapColorwayPreviewState(
  status: ColorwayPreviewResult["status"],
  context: ColorwayStateContext,
): ColorwayPreviewResult {
  return {
    status,
    comparison: {
      currentAssetUrl: context.comparison?.currentAssetUrl ?? null,
      proposedAssetUrl: context.comparison?.proposedAssetUrl ?? null,
      comparisonAssetUrl: context.comparison?.comparisonAssetUrl ?? null,
      mimeType: context.comparison?.mimeType ?? null,
      width: context.comparison?.width ?? null,
      height: context.comparison?.height ?? null,
      reused: context.comparison?.reused ?? false,
    },
    change: {
      selectedLineId: context.selectedLineId,
      fromVariantId: context.currentVariantId,
      toVariantId: context.proposedVariantId,
      changedLabel: "Colorway preview",
    },
    context: {
      inferredDiscipline: context.inferredDiscipline,
      layoutId: context.layoutId,
      templateVersion: context.templateVersion,
    },
    omissions: context.omissions ?? [],
    diagnostics: {
      requestId: context.requestId,
      generationMs: context.generationMs,
    },
  };
}

export function buildColorwayChangedItemHighlight(input: {
  selectedLineId: string;
  currentVariantId: string;
  proposedVariantId: string;
  productTitle?: string;
}): ColorwayPreviewChange {
  const title = input.productTitle?.trim() || "Selected item";

  return {
    selectedLineId: input.selectedLineId,
    fromVariantId: input.currentVariantId,
    toVariantId: input.proposedVariantId,
    changedLabel: `${title}: ${input.currentVariantId || "current"} -> ${input.proposedVariantId}`,
  };
}

function classifyOmissionReason(input: {
  line?: {
    lineId?: string;
    productId?: string;
    variantId?: string;
    imageUrl?: string;
  };
  rawReason: OmissionReasonCode;
}): OmissionReasonCode {
  if (!input.line?.imageUrl) {
    return "missing_image";
  }

  if (!/^https?:\/\//i.test(input.line.imageUrl)) {
    return "fetch_failed";
  }

  if (!input.line.productId) {
    return "unsupported_type";
  }

  if (!input.line.variantId) {
    return "invalid_variant";
  }

  return input.rawReason;
}

export async function generateKitPreview(
  input: ColorwayPreviewRequestInput,
): Promise<KitPreviewResult> {
  const requestId = crypto.randomUUID();
  const snapshot = normalizeStorefrontCartForPreview({
    cartId: input.cartId,
    currencyCode: input.currencyCode,
    items: input.cart.items,
  });
  const layoutProfile = resolveLayoutProfile(
    snapshot.inferredDiscipline,
    snapshot.items.length,
    {
      nonComposable: snapshot.items.every((item) => !item.renderEligible),
    },
  );
  const preview = composeKitPreview({
    snapshot,
    layoutProfile,
    forceRegenerate: input.forceRegenerate,
  });

  return {
    status: preview.status,
    preview: preview.preview,
    context: preview.context,
    omissions: preview.omissions.map((entry) => {
      const line = input.cart.items.find((cartLine) => cartLine.lineId === entry.lineId);

      return {
        lineId: entry.lineId,
        scope: "both" as const,
        reasonCode: classifyOmissionReason({
          line,
          rawReason: entry.reasonCode,
        }),
        ...(entry.reasonDetail ? { reasonDetail: entry.reasonDetail } : {}),
      };
    }),
    diagnostics: {
      requestId,
      generationMs: preview.diagnostics.generationMs,
    },
  };
}

// Phase 1 scaffold: orchestration logic will be implemented in Phase 2+
export async function generateColorwayPreview(
  input: ColorwayPreviewRequestInput,
): Promise<ColorwayPreviewResult> {
  const requestId = crypto.randomUUID();

  if (!input.selectedLineId || !input.proposedVariantId) {
    throw new Error("Colorway comparison requires selectedLineId and proposedVariantId.");
  }

  const snapshot = normalizeStorefrontCartForPreview({
    cartId: input.cartId,
    currencyCode: input.currencyCode,
    items: input.cart.items,
  });

  const layoutProfile = resolveLayoutProfile(
    snapshot.inferredDiscipline,
    snapshot.items.length,
    {
      nonComposable: snapshot.items.every((item) => !item.renderEligible),
    },
  );

  const signatureSeed = normalizeColorwaySignatureSeed({
    cartItems: input.cart.items,
    selectedLineId: input.selectedLineId,
    proposedVariantId: input.proposedVariantId,
  });

  const cacheKey = buildColorwayPreviewSignature({
    cartSnapshotSignature: `${snapshot.signatureSeed}::${signatureSeed}`,
    selectedLineId: input.selectedLineId,
    proposedVariantId: input.proposedVariantId,
    layoutId: layoutProfile.layoutId,
    templateVersion: layoutProfile.templateVersion,
  });

  if (!input.forceRegenerate) {
    const cached = getColorwayPreviewCache(cacheKey);

    if (cached) {
      return {
        ...cached,
        comparison: {
          ...cached.comparison,
          reused: true,
        },
        diagnostics: {
          requestId,
          generationMs: null,
        },
      };
    }
  }

  const selectedLine = input.cart.items.find((line) => line.lineId === input.selectedLineId);
  const currentVariantId = selectedLine?.variantId ?? "";

  const comparison = composeColorwayComparison({
    snapshot: {
      ...snapshot,
      signatureSeed: cacheKey,
    },
    layoutProfile,
    selectedLineId: input.selectedLineId,
    currentVariantId,
    proposedVariantId: input.proposedVariantId,
    forceRegenerate: input.forceRegenerate,
  });

  const change = buildColorwayChangedItemHighlight({
    selectedLineId: input.selectedLineId,
    currentVariantId,
    proposedVariantId: input.proposedVariantId,
    productTitle: selectedLine?.productTitle,
  });

  const mapped = mapColorwayPreviewState(
    comparison.status,
    {
      requestId,
      selectedLineId: input.selectedLineId,
      currentVariantId: change.fromVariantId,
      proposedVariantId: change.toVariantId,
      inferredDiscipline: comparison.context.inferredDiscipline,
      layoutId: comparison.context.layoutId,
      templateVersion: comparison.context.templateVersion,
      generationMs: comparison.diagnostics.generationMs,
      omissions: comparison.omissions.map((entry) => {
        const line = input.cart.items.find((cartLine) => cartLine.lineId === entry.lineId);
        const reasonCode = classifyOmissionReason({
          line,
          rawReason: entry.reasonCode,
        });

        return {
          lineId: entry.lineId,
          scope: entry.lineId === input.selectedLineId ? "proposed" : "both",
          reasonCode,
          ...(entry.reasonDetail ? { reasonDetail: entry.reasonDetail } : {}),
        };
      }),
      comparison: comparison.comparison,
    },
  );

  const result = {
    ...mapped,
    change,
  };

  if (result.status !== "error" && result.status !== "invalid") {
    setColorwayPreviewCache(cacheKey, result);
  }

  return result;
}
