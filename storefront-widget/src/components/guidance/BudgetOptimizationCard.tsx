import type { StructuredGuidanceBlock } from "../../../../app/lib/ai/schemas";
import { getGuidanceRenderModel } from "./getGuidanceRenderModel";

interface BudgetOptimizationCardProps {
  block: Extract<StructuredGuidanceBlock, { type: "budget_optimization" }>;
}

function formatMoney(value: number, currencyCode: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currencyCode,
    maximumFractionDigits: 2,
  }).format(value);
}

function getStatusLabel(status: ReturnType<typeof getGuidanceRenderModel> extends infer M
  ? M extends { kind: "budget_optimization"; status: infer S }
    ? S
    : never
  : never,
) {
  switch (status) {
    case "within_budget":
      return "Already within budget";
    case "optimized":
      return "Optimized to target";
    case "constraint_blocked":
      return "Partially optimized";
    case "insufficient_candidates":
      return "No viable changes";
  }
}

export function BudgetOptimizationCard({ block }: BudgetOptimizationCardProps) {
  const model = getGuidanceRenderModel(block);

  if (model.kind !== "budget_optimization") {
    return null;
  }

  return (
    <section className="cm-guidance-card">
      <div className="cm-guidance-card__header">
        <h4>{model.title}</h4>
        <span className="cm-pill">{getStatusLabel(model.status)}</span>
      </div>
      <p>{model.summary}</p>
      <ul className="cm-guidance-list">
        <li>Baseline: {formatMoney(model.baselineSubtotal, model.currencyCode)}</li>
        <li>Target: {formatMoney(model.targetBudgetAmount, model.currencyCode)}</li>
        <li>Projected: {formatMoney(model.projectedSubtotal, model.currencyCode)}</li>
        <li>Remaining gap: {formatMoney(model.projectedGapAmount, model.currencyCode)}</li>
      </ul>
      {model.candidates.length > 0 ? (
        <ul className="cm-guidance-list">
          {model.candidates.map((candidate) => (
            <li key={candidate.candidateId}>
              <strong>{candidate.changeType.toUpperCase()}</strong>
              <span>
                {candidate.sourceProductId}
                {candidate.targetProductId ? ` -> ${candidate.targetProductId}` : ""}
              </span>
              <small>
                Saves {formatMoney(candidate.estimatedSavings, model.currencyCode)}
                {candidate.safetyCriticalImpact !== "none" ? ` · ${candidate.safetyCriticalImpact}` : ""}
              </small>
              <span>{candidate.rationale}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {model.constraints.length > 0 ? (
        <ul className="cm-guidance-list">
          {model.constraints.map((constraint) => (
            <li key={constraint}>{constraint}</li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
