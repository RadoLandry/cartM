import { describe, expect, it } from "vitest";

import { buildBudgetOptimizationProposal } from "../../../app/lib/cart-intelligence/budget-optimization";

describe("budget optimization ranking", () => {
  it("ranks candidates by safety-first before savings", () => {
    const result = buildBudgetOptimizationProposal({
      optimizationContextId: "bgt_ctx_1",
      requestId: "req_1",
      baselineSubtotal: 120,
      targetBudgetAmount: 90,
      fetchedAt: "2026-06-02T10:00:00.000Z",
      candidates: [
        {
          candidateId: "c_reduced",
          changeType: "remove",
          sourceLineId: "line_1",
          sourceProductId: "prod_safety",
          estimatedSavings: 50,
          safetyCriticalImpact: "reduced_protection",
          rationale: "Large savings but lowers protection.",
          disciplineFitScore: 0.8,
          availability: "available",
        },
        {
          candidateId: "c_safe",
          changeType: "remove",
          sourceLineId: "line_2",
          sourceProductId: "prod_optional",
          estimatedSavings: 20,
          safetyCriticalImpact: "none",
          rationale: "Lower impact optional removal.",
          disciplineFitScore: 0.9,
          availability: "available",
        },
      ],
    });

    expect(result.status).toBe("optimized");
    expect(result.candidates.map((candidate) => candidate.candidateId)).toEqual(["c_safe", "c_reduced"]);
  });

  it("computes projected subtotal and remaining gap for over-budget carts", () => {
    const result = buildBudgetOptimizationProposal({
      optimizationContextId: "bgt_ctx_2",
      requestId: "req_2",
      baselineSubtotal: 150,
      targetBudgetAmount: 100,
      fetchedAt: "2026-06-02T10:00:00.000Z",
      candidates: [
        {
          candidateId: "c_one",
          changeType: "remove",
          sourceLineId: "line_1",
          sourceProductId: "prod_one",
          estimatedSavings: 30,
          safetyCriticalImpact: "none",
          rationale: "Optional accessory",
          disciplineFitScore: 0.8,
          availability: "available",
        },
        {
          candidateId: "c_two",
          changeType: "remove",
          sourceLineId: "line_2",
          sourceProductId: "prod_two",
          estimatedSavings: 25,
          safetyCriticalImpact: "none",
          rationale: "Secondary add-on",
          disciplineFitScore: 0.7,
          availability: "available",
        },
      ],
    });

    expect(result.projectedSubtotal).toBe(95);
    expect(result.projectedGapAmount).toBe(0);
    expect(result.status).toBe("optimized");
  });

  it("excludes critical-removal candidates by default", () => {
    const result = buildBudgetOptimizationProposal({
      optimizationContextId: "bgt_ctx_3",
      requestId: "req_3",
      baselineSubtotal: 150,
      targetBudgetAmount: 100,
      fetchedAt: "2026-06-02T10:00:00.000Z",
      candidates: [
        {
          candidateId: "c_critical",
          changeType: "remove",
          sourceLineId: "line_1",
          sourceProductId: "prod_helmet",
          estimatedSavings: 60,
          safetyCriticalImpact: "critical_removal",
          rationale: "Removing helmet would exceed safety limits.",
          disciplineFitScore: 0.9,
          availability: "available",
        },
        {
          candidateId: "c_optional",
          changeType: "remove",
          sourceLineId: "line_2",
          sourceProductId: "prod_bag",
          estimatedSavings: 20,
          safetyCriticalImpact: "none",
          rationale: "Optional gear bag.",
          disciplineFitScore: 0.6,
          availability: "available",
        },
      ],
    });

    expect(result.candidates.map((candidate) => candidate.candidateId)).not.toContain("c_critical");
    expect(result.status).toBe("constraint_blocked");
    expect(result.projectedGapAmount).toBeGreaterThan(0);
  });

  it("reports insufficient_candidates when no safe candidates remain", () => {
    const result = buildBudgetOptimizationProposal({
      optimizationContextId: "bgt_ctx_4",
      requestId: "req_4",
      baselineSubtotal: 150,
      targetBudgetAmount: 100,
      fetchedAt: "2026-06-02T10:00:00.000Z",
      candidates: [
        {
          candidateId: "c_critical_only",
          changeType: "remove",
          sourceLineId: "line_1",
          sourceProductId: "prod_helmet",
          estimatedSavings: 60,
          safetyCriticalImpact: "critical_removal",
          rationale: "Only candidate would remove a safety-critical item.",
          disciplineFitScore: 0.9,
          availability: "available",
        },
      ],
    });

    expect(result.candidates).toHaveLength(0);
    expect(result.status).toBe("insufficient_candidates");
  });
});
