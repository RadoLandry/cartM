import type { StructuredGuidanceBlock } from "../../types";
import {
  formatBudgetOptimizationCandidateTradeOff,
  recomputeBudgetOptimizationSelection,
} from "../../../../app/lib/ai/storefront-chat-client";

export interface BudgetOptimizationCardProps {
  block: Extract<StructuredGuidanceBlock, { type: "budget_optimization" }>;
  selectedCandidateIds?: string[];
  onCandidateDecision?: (candidateId: string, accepted: boolean) => void;
}

export function BudgetOptimizationCard(props: BudgetOptimizationCardProps) {
  const { block } = props;
  const allCandidateIds = block.candidates.map((candidate) => candidate.candidateId);
  const selectedCandidateIds = props.selectedCandidateIds ?? allCandidateIds;
  const selected = new Set(selectedCandidateIds);
  const formatter = new Intl.NumberFormat(undefined, { style: "currency", currency: block.currencyCode });

  const hasCustomSelection = selectedCandidateIds.length !== allCandidateIds.length
    || selectedCandidateIds.some((id) => !allCandidateIds.includes(id));
  const recomputed = hasCustomSelection
    ? recomputeBudgetOptimizationSelection({
      result: {
        baselineSubtotal: block.baselineSubtotal,
        targetBudgetAmount: block.targetBudgetAmount,
        candidates: block.candidates,
      },
      selectedCandidateIds,
    })
    : null;

  const displayProjectedSubtotal = recomputed?.projectedSubtotal ?? block.projectedSubtotal;
  const displayGapAmount = recomputed?.projectedGapAmount ?? block.projectedGapAmount;
  const displayStatus = recomputed?.status ?? block.status;
  const isBlocked = displayStatus === "constraint_blocked";

  return (
    <section aria-label={block.title}>
      <h3>{block.title}</h3>
      <p>{block.summary}</p>
      {isBlocked ? (
        <p role="status">
          Safety constraints kept some items in your cart, so the target budget could not be fully reached.
        </p>
      ) : null}
      <p>
        {formatter.format(displayProjectedSubtotal)} projected of {formatter.format(block.targetBudgetAmount)} target
        {displayGapAmount > 0 ? `, ${formatter.format(displayGapAmount)} remaining gap` : ""}
        {recomputed ? " (recalculated)" : ""}
      </p>
      <ul>
        {block.candidates.map((candidate) => (
          <li key={candidate.candidateId}>
            {formatBudgetOptimizationCandidateTradeOff(candidate, block.currencyCode)}
            {candidate.safetyCriticalImpact !== "none" ? (
              <span role="note"> Safety impact: {candidate.safetyCriticalImpact === "reduced_protection" ? "reduced protection" : candidate.safetyCriticalImpact}.</span>
            ) : null}
            <button type="button" onClick={() => props.onCandidateDecision?.(candidate.candidateId, !selected.has(candidate.candidateId))}>
              {selected.has(candidate.candidateId) ? "Keep" : "Restore"}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
