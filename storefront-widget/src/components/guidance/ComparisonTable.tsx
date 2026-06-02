import type { StructuredGuidanceBlock } from "../../../../app/lib/ai/schemas";
import { getGuidanceRenderModel } from "./getGuidanceRenderModel";

interface ComparisonTableProps {
  block: Extract<StructuredGuidanceBlock, { type: "comparison_table" }>;
}

export function ComparisonTable({ block }: ComparisonTableProps) {
  const model = getGuidanceRenderModel(block);

  if (model.kind !== "comparison_table") {
    return null;
  }

  return (
    <section className="cm-guidance-card">
      <h4>{model.title}</h4>
      <p>{model.summary}</p>
      <div className="cm-comparison-table" role="table" aria-label={model.title}>
        <div className="cm-comparison-row cm-comparison-row--header" role="row">
          <span role="columnheader">Category</span>
          {model.headings.map((heading, index) => (
            <span key={heading} role="columnheader">
              {heading}
              {model.recommendedColumnIndex === index ? " (Recommended)" : ""}
            </span>
          ))}
        </div>
        {model.rows.map((row) => (
          <div key={row.label} className="cm-comparison-row" role="row">
            <span role="rowheader">{row.label}</span>
            {row.values.map((value, index) => (
              <span key={`${row.label}-${index}`} role="cell">{value}</span>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}