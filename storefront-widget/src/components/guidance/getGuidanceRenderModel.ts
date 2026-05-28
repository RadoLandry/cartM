import type { StructuredGuidanceBlock } from "../../../../app/lib/ai/schemas";

export type GuidanceRenderModel =
  | {
      kind: "recommendation_list";
      title: string;
      summary: string;
      items: Array<{
        id: string;
        title: string;
        reason: string;
        meta?: string;
      }>;
    }
  | {
      kind: "comparison_table";
      title: string;
      summary: string;
      headings: string[];
      rows: Array<{
        label: string;
        values: string[];
      }>;
    }
  | {
      kind: "size_summary";
      title: string;
      summary: string;
      confidenceLabel: string;
      highlights: string[];
    }
  | {
      kind: "fallback_notice";
      title: string;
      summary: string;
    };

export function getGuidanceRenderModel(block: StructuredGuidanceBlock): GuidanceRenderModel {
  switch (block.type) {
    case "recommendation_list":
      return {
        kind: "recommendation_list",
        title: block.title,
        summary: block.summary,
        items: block.items.map((item, index) => ({
          id: item.variantId || item.productId || `${block.blockId}-${index}`,
          title: item.title,
          reason: item.reason,
          meta: [item.priceLabel, item.availability].filter(Boolean).join(" • ") || undefined,
        })),
      };
    case "comparison_table":
      return {
        kind: "comparison_table",
        title: block.title,
        summary: block.summary,
        headings: block.columns.map((column) => column.title),
        rows: block.rows,
      };
    case "size_summary":
      return {
        kind: "size_summary",
        title: block.title,
        summary: block.summary,
        confidenceLabel: `${Math.round(block.confidence * 100)}% confidence`,
        highlights: block.highlights,
      };
    case "fallback_notice":
      return {
        kind: "fallback_notice",
        title: block.title,
        summary: block.summary,
      };
  }
}