/**
 * Client-safe utilities from the storefront chat module.
 * This file must NEVER import server-only modules (Prisma, DB queries, etc.)
 * — it is bundled into the storefront widget IIFE.
 */
import type {
  BudgetOptimizationResult,
  StructuredGuidanceBlock,
} from "./schemas";

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
