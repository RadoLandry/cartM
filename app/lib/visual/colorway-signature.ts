import { createHash } from "node:crypto";

export interface ColorwaySignatureInput {
  cartSnapshotSignature: string;
  selectedLineId: string;
  proposedVariantId: string;
  layoutId: string;
  templateVersion: string;
  outputFormat?: "png" | "webp";
}

export interface ColorwaySignatureSeedInput {
  cartItems: Array<{
    lineId?: string;
    productId?: string;
    variantId?: string;
    quantity?: number;
    imageUrl?: string;
  }>;
  selectedLineId: string;
  proposedVariantId: string;
}

export function normalizeColorwaySignatureSeed(input: ColorwaySignatureSeedInput): string {
  const normalizedItems = [...input.cartItems]
    .map((item, index) => {
      const lineId = item.lineId?.trim() || `preview-line-${index + 1}`;
      const quantity = Number.isFinite(item.quantity) && (item.quantity ?? 0) > 0
        ? Math.floor(item.quantity as number)
        : 1;

      return {
        lineId,
        productId: item.productId ?? "",
        variantId: item.variantId ?? "",
        quantity,
        imageUrl: item.imageUrl ?? "",
      };
    })
    .sort((a, b) => a.lineId.localeCompare(b.lineId));

  const itemSeed = normalizedItems
    .map((item) => [
      item.lineId,
      item.productId,
      item.variantId,
      item.quantity.toString(),
      item.imageUrl,
    ].join("|"))
    .join("::");

  return [itemSeed, input.selectedLineId, input.proposedVariantId].join("::");
}

export function buildColorwayPreviewSignature(input: ColorwaySignatureInput): string {
  const format = input.outputFormat ?? "webp";
  const raw = [
    input.cartSnapshotSignature,
    input.selectedLineId,
    input.proposedVariantId,
    input.layoutId,
    input.templateVersion,
    format,
  ].join("::");

  return createHash("sha256").update(raw).digest("hex");
}
