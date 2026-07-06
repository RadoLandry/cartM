import type { StructuredGuidanceBlock } from "../../../../app/lib/ai/schemas";
import { getGuidanceRenderModel } from "./getGuidanceRenderModel";

interface RecommendationListProps {
  block: Extract<StructuredGuidanceBlock, { type: "recommendation_list" }>;
  showReasonTags?: boolean;
}

export function RecommendationList({ block, showReasonTags = true }: RecommendationListProps) {
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

  const evidenceLabel: Record<
    "profile" | "history" | "size" | "kit" | "threshold" | "availability" | "compatibility" | "safety" | "fallback",
    string
  > = {
    profile: "Profil",
    history: "Historique",
    size: "Taille",
    kit: "Kit",
    threshold: "Seuil",
    availability: "Disponibilite",
    compatibility: "Compatibilite",
    safety: "Securite",
    fallback: "Contexte panier",
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
            {showReasonTags && item.evidenceTags.length > 0 ? (
              <div className="cm-reason-chips" aria-label="Pourquoi cette recommandation">
                <span className="cm-reason-chips__label">Pourquoi:</span>
                {item.evidenceTags.map((tag) => (
                  <span key={`${item.id}-${tag}`} className="cm-pill cm-pill--reason">{evidenceLabel[tag]}</span>
                ))}
              </div>
            ) : null}
            <span>{item.reason}</span>
            {item.shopperOutcome ? <span>{item.shopperOutcome}</span> : null}
            {item.meta ? <small>{item.meta}</small> : null}
          </li>
        ))}
      </ul>
    </section>
  );
}