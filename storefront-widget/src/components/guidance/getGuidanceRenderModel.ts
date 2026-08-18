import type { StructuredGuidanceBlock } from "../../types";

export function getGuidanceRenderModel(block: StructuredGuidanceBlock) {
  if (block.type === "recommendation_list") {
    return {
      kind: "recommendation_list" as const,
      title: block.title,
      summary: block.summary,
      items: block.items.map((item) => ({
        title: item.title,
        action: item.action,
        priorityLabel: item.priorityLabel,
        safetyCritical: item.safetyCritical,
        reason: item.reason,
        meta: [item.priceLabel, item.availability].filter(Boolean).join(" | "),
      })),
    };
  }

  if (block.type === "comparison_table") {
    return {
      kind: "comparison_table" as const,
      title: block.title,
      summary: block.summary,
      headings: block.columns.map((column) => column.title),
      rows: block.rows,
    };
  }

  if (block.type === "size_summary") {
    return {
      kind: "size_summary" as const,
      title: block.title,
      summary: block.summary,
      confidenceLabel: `${Math.round(block.confidence * 100)}% confidence`,
      highlights: block.highlights,
    };
  }

  return {
    kind: "fallback_notice" as const,
    title: block.title,
    summary: block.summary,
  };
}