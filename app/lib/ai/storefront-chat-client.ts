/**
 * Client-safe utilities from the storefront chat module.
 * This file must NEVER import server-only modules (Prisma, DB queries, etc.)
 * — it is bundled into the storefront widget IIFE.
 */
import type {
  BudgetOptimizationCandidate,
  BudgetOptimizationResult,
  StructuredGuidanceBlock,
} from "./schemas";

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100;
}

export interface MinimalBudgetOptimizationCandidate {
  candidateId: string;
  estimatedSavings: number;
  safetyCriticalImpact: BudgetOptimizationCandidate["safetyCriticalImpact"];
  rationale: string;
}

export function formatBudgetOptimizationCandidateTradeOff(
  candidate: MinimalBudgetOptimizationCandidate,
  currencyCode: string,
): string {
  const formatter = new Intl.NumberFormat(undefined, { style: "currency", currency: currencyCode });
  const safetyNote = candidate.safetyCriticalImpact === "reduced_protection"
    ? " This reduces protective coverage."
    : candidate.safetyCriticalImpact === "critical_removal"
      ? " This would remove a safety-critical item."
      : "";

  return `${candidate.rationale} Saves ${formatter.format(candidate.estimatedSavings)}.${safetyNote}`;
}

export interface RecomputedBudgetOptimizationSelection {
  selectedCandidateIds: string[];
  projectedSubtotal: number;
  projectedGapAmount: number;
  status: BudgetOptimizationResult["status"];
}

/**
 * Recomputes the projected subtotal/gap/status for a subset of previously proposed
 * candidates, so a shopper can accept/decline individual candidates and see an
 * updated plan without re-running the full optimization.
 */
export function recomputeBudgetOptimizationSelection(input: {
  result: {
    baselineSubtotal: number;
    targetBudgetAmount: number;
    candidates: Array<Pick<MinimalBudgetOptimizationCandidate, "candidateId" | "estimatedSavings">>;
  };
  selectedCandidateIds: string[];
}): RecomputedBudgetOptimizationSelection {
  const availableIds = new Set(input.result.candidates.map((candidate) => candidate.candidateId));
  const selectedCandidateIds = input.selectedCandidateIds.filter((candidateId) => availableIds.has(candidateId));
  const selectedCandidates = input.result.candidates.filter((candidate) => (
    selectedCandidateIds.includes(candidate.candidateId)
  ));

  const totalSavings = selectedCandidates.reduce((sum, candidate) => sum + candidate.estimatedSavings, 0);
  const projectedSubtotal = roundCurrency(Math.max(input.result.baselineSubtotal - totalSavings, 0));
  const projectedGapAmount = roundCurrency(Math.max(projectedSubtotal - input.result.targetBudgetAmount, 0));

  const status: BudgetOptimizationResult["status"] = projectedSubtotal <= input.result.targetBudgetAmount
    ? "optimized"
    : selectedCandidates.length === 0
      ? "insufficient_candidates"
      : "constraint_blocked";

  return {
    selectedCandidateIds,
    projectedSubtotal,
    projectedGapAmount,
    status,
  };
}

export function mapBudgetOptimizationToGuidanceBlock(input: {
  optimization: BudgetOptimizationResult;
  currencyCode: string;
}): Extract<StructuredGuidanceBlock, { type: "budget_optimization" }> {
  const summaryByStatus: Record<BudgetOptimizationResult["status"], string> = {
    within_budget: "Your current cart already fits the target budget.",
    optimized: "This ranked plan reaches your target budget.",
    constraint_blocked: "This plan reduces total cost, but constraints prevent fully reaching the target.",
    insufficient_candidates: "No viable candidate changes were found to reduce this cart safely.",
  };

  return {
    blockId: `budget-${input.optimization.optimizationContextId}`,
    type: "budget_optimization",
    title: "Budget optimization plan",
    summary: summaryByStatus[input.optimization.status],
    priority: 1,
    status: input.optimization.status,
    currencyCode: input.currencyCode,
    baselineSubtotal: input.optimization.baselineSubtotal,
    targetBudgetAmount: input.optimization.targetBudgetAmount,
    projectedSubtotal: input.optimization.projectedSubtotal,
    projectedGapAmount: input.optimization.projectedGapAmount,
    constraints: input.optimization.constraints,
    candidates: input.optimization.candidates.map((candidate) => ({
      candidateId: candidate.candidateId,
      changeType: candidate.changeType,
      sourceProductId: candidate.sourceProductId,
      ...(candidate.targetProductId ? { targetProductId: candidate.targetProductId } : {}),
      estimatedSavings: candidate.estimatedSavings,
      safetyCriticalImpact: candidate.safetyCriticalImpact,
      rationale: candidate.rationale,
    })),
  };
}
