import type { StructuredGuidanceBlock } from "../../../../app/lib/ai/schemas";
import { getGuidanceRenderModel } from "./getGuidanceRenderModel";

interface SizeSummaryProps {
  block: Extract<StructuredGuidanceBlock, { type: "size_summary" }>;
}

export function SizeSummary({ block }: SizeSummaryProps) {
  const model = getGuidanceRenderModel(block);

  if (model.kind !== "size_summary") {
    return null;
  }

  return (
    <section className="cm-guidance-card">
      <div className="cm-guidance-card__header">
        <h4>{model.title}</h4>
        <span className="cm-pill">{model.confidenceLabel}</span>
      </div>
      <p>{model.summary}</p>
      <ul className="cm-guidance-list">
        {model.highlights.map((highlight) => (
          <li key={highlight}>{highlight}</li>
        ))}
      </ul>
    </section>
  );
}