import type { StructuredGuidanceBlock } from "../../../../app/lib/ai/schemas";
import { getGuidanceRenderModel } from "./getGuidanceRenderModel";

interface RecommendationListProps {
  block: Extract<StructuredGuidanceBlock, { type: "recommendation_list" }>;
}

export function RecommendationList({ block }: RecommendationListProps) {
  const model = getGuidanceRenderModel(block);

  return (
    <section className="cm-guidance-card">
      <h4>{model.title}</h4>
      <p>{model.summary}</p>
      <ul className="cm-guidance-list">
        {model.items.map((item) => (
          <li key={item.id}>
            <strong>{item.title}</strong>
            <span>{item.reason}</span>
            {item.meta ? <small>{item.meta}</small> : null}
          </li>
        ))}
      </ul>
    </section>
  );
}