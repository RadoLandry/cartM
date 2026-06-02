import type { BudgetOptimizationCandidate, BudgetOptimizationResult } from "../ai/schemas";

export interface BudgetOptimizationCandidateInput {
  candidateId: string;
  changeType: BudgetOptimizationCandidate["changeType"];
  sourceLineId: string;
  sourceProductId: string;
  sourceVariantId?: string;
  targetProductId?: string;
  targetVariantId?: string;
  estimatedSavings: number;
  safetyCriticalImpact: BudgetOptimizationCandidate["safetyCriticalImpact"];
  rationale: string;
  disciplineFitScore: number;
  availability: BudgetOptimizationCandidate["availability"];
}

export interface BuildBudgetOptimizationProposalInput {
  optimizationContextId: string;
  requestId: string;
  baselineSubtotal: number;
  targetBudgetAmount: number;
  candidates: BudgetOptimizationCandidateInput[];
  fetchedAt: string;
}

function clampCurrency(value: number) {
  return Math.round(value * 100) / 100;
}

export function rankBudgetOptimizationCandidates(candidates: BudgetOptimizationCandidateInput[]): BudgetOptimizationCandidate[] {
  return candidates
    .filter((candidate) => candidate.availability !== "unavailable")
    .filter((candidate) => candidate.safetyCriticalImpact !== "critical_removal")
    .sort((a, b) => {
      const safetyRank = {
        none: 0,
        reduced_protection: 1,
        critical_removal: 2,
      } as const;

      if (safetyRank[a.safetyCriticalImpact] !== safetyRank[b.safetyCriticalImpact]) {
        return safetyRank[a.safetyCriticalImpact] - safetyRank[b.safetyCriticalImpact];
      }

      if (b.estimatedSavings !== a.estimatedSavings) {
        return b.estimatedSavings - a.estimatedSavings;
      }

      return b.disciplineFitScore - a.disciplineFitScore;
    });
}

function selectCandidatesForTarget(
  rankedCandidates: BudgetOptimizationCandidate[],
  baselineSubtotal: number,
  targetBudgetAmount: number,
) {
  const selected: BudgetOptimizationCandidate[] = [];
  let projectedSubtotal = baselineSubtotal;

  for (const candidate of rankedCandidates) {
    if (projectedSubtotal <= targetBudgetAmount) {
      break;
    }

    selected.push(candidate);
    projectedSubtotal = Math.max(projectedSubtotal - candidate.estimatedSavings, 0);
  }

  return {
    selectedCandidates: selected,
    projectedSubtotal: clampCurrency(projectedSubtotal),
  };
}

export function buildBudgetOptimizationProposal(
  input: BuildBudgetOptimizationProposalInput,
): BudgetOptimizationResult {
  const rankedCandidates = rankBudgetOptimizationCandidates(input.candidates);

  if (input.baselineSubtotal <= input.targetBudgetAmount) {
    return {
      optimizationContextId: input.optimizationContextId,
      requestId: input.requestId,
      generatedAt: new Date().toISOString(),
      baselineSubtotal: clampCurrency(input.baselineSubtotal),
      targetBudgetAmount: clampCurrency(input.targetBudgetAmount),
      projectedSubtotal: clampCurrency(input.baselineSubtotal),
      projectedGapAmount: 0,
      status: "within_budget",
      candidates: [],
      constraints: [],
      freshness: {
        priceCheckedAt: input.fetchedAt,
        availabilityCheckedAt: input.fetchedAt,
      },
    };
  }

  const selection = selectCandidatesForTarget(
    rankedCandidates,
    input.baselineSubtotal,
    input.targetBudgetAmount,
  );
  const projectedSubtotal = selection.projectedSubtotal;
  const projectedGapAmount = clampCurrency(Math.max(projectedSubtotal - input.targetBudgetAmount, 0));

  const status: BudgetOptimizationResult["status"] = selection.selectedCandidates.length === 0
    ? "insufficient_candidates"
    : projectedGapAmount > 0
      ? "constraint_blocked"
      : "optimized";

  const constraints = [
    "Safety-critical products are protected from removal.",
    "Only in-stock alternatives are considered for automatic proposals.",
  ];

  return {
    optimizationContextId: input.optimizationContextId,
    requestId: input.requestId,
    generatedAt: new Date().toISOString(),
    baselineSubtotal: clampCurrency(input.baselineSubtotal),
    targetBudgetAmount: clampCurrency(input.targetBudgetAmount),
    projectedSubtotal,
    projectedGapAmount,
    status,
    candidates: selection.selectedCandidates,
    constraints,
    freshness: {
      priceCheckedAt: input.fetchedAt,
      availabilityCheckedAt: input.fetchedAt,
    },
  };
}
