import type {
  ColorwayPreviewChange,
  ColorwayPreviewComparison,
  ColorwayPreviewRequestInput,
  ColorwayPreviewResult,
} from "./colorway-preview.types";
import { composeColorwayComparison } from "./compositor";
import { buildColorwayPreviewSignature, normalizeColorwaySignatureSeed } from "./colorway-signature";
import { resolveLayoutProfile } from "./templates";
import { normalizeStorefrontCartForPreview } from "../shopify/storefront-cart";

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

// Phase 1 scaffold: orchestration logic will be implemented in Phase 2+
export async function generateColorwayPreview(
  input: ColorwayPreviewRequestInput,
): Promise<ColorwayPreviewResult> {
  const requestId = crypto.randomUUID();

  const snapshot = normalizeStorefrontCartForPreview({
    cartId: input.cartId,
    currencyCode: input.currencyCode,
    items: input.cart.items,
  });

  const layoutProfile = resolveLayoutProfile(
    snapshot.inferredDiscipline,
    snapshot.items.length,
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
      omissions: comparison.omissions.map((entry) => ({
        lineId: entry.lineId,
        scope: "both",
        reasonCode: entry.reasonCode,
        ...(entry.reasonDetail ? { reasonDetail: entry.reasonDetail } : {}),
      })),
      comparison: comparison.comparison,
    },
  );

  return {
    ...mapped,
    change,
  };
}
