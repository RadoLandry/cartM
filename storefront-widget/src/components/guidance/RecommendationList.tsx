import type { StructuredGuidanceBlock } from "../../../../app/lib/ai/schemas";
import { getGuidanceRenderModel } from "./getGuidanceRenderModel";

interface RecommendationListProps {
  block: Extract<StructuredGuidanceBlock, { type: "recommendation_list" }>;
}

export function RecommendationList({ block }: RecommendationListProps) {
  const model = getGuidanceRenderModel(block);

  if (model.kind !== "recommendation_list") {
    return null;
  }

  const actionLabel: Record<"keep" | "add" | "remove" | "swap" | "size_adjust", string> = {
    keep: "Keep",
    add: "Add",
    remove: "Remove",
    swap: "Swap",
    size_adjust: "Size",
  };

  return (
    <section className="cm-guidance-card">
      <h4>{model.title}</h4>
      <p>{model.summary}</p>
      <ul className="cm-guidance-list">
        {model.items.map((item) => (
          <li key={item.id}>
            <strong>{item.title}</strong>
            <small>{actionLabel[item.action]} · {item.priorityLabel.toUpperCase()}{item.safetyCritical ? " · Safety" : ""}</small>
            <span>{item.reason}</span>
            {item.shopperOutcome ? <span>{item.shopperOutcome}</span> : null}
            {item.meta ? <small>{item.meta}</small> : null}
          </li>
        ))}
      </ul>
    </section>
  );
}