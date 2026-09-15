import { describe, expect, it } from "vitest";

import { resolveBudgetOptimizationStreamOutcome } from "../../../app/lib/ai/storefront-chat";
import type { BudgetOptimizationResult } from "../../../app/lib/ai/schemas";

function buildResult(overrides: Partial<BudgetOptimizationResult>): BudgetOptimizationResult {
  return {
    optimizationContextId: "bgt_ctx_1",
    requestId: "req_1",
    generatedAt: "2026-06-02T10:00:00.000Z",
    baselineSubtotal: 100,
    targetBudgetAmount: 50,
    projectedSubtotal: 50,
    projectedGapAmount: 0,
    status: "optimized",
    candidates: [],
    constraints: [],
    freshness: {
      priceCheckedAt: "2026-06-02T10:00:00.000Z",
      availabilityCheckedAt: "2026-06-02T10:00:00.000Z",
    },
    ...overrides,
  };
}

describe("resolveBudgetOptimizationStreamOutcome", () => {
  it("maps insufficient_candidates status to a NO_ELIGIBLE_CANDIDATES error", () => {
    const outcome = resolveBudgetOptimizationStreamOutcome({
      optimizationContextId: "bgt_ctx_1",
      result: buildResult({ status: "insufficient_candidates", candidates: [] }),
    });

    expect(outcome.kind).toBe("error");
    if (outcome.kind === "error") {
      expect(outcome.error.code).toBe("NO_ELIGIBLE_CANDIDATES");
      expect(outcome.error.optimizationContextId).toBe("bgt_ctx_1");
    }
  });

  it("passes through constraint_blocked results as a successful stream part", () => {
    const outcome = resolveBudgetOptimizationStreamOutcome({
      optimizationContextId: "bgt_ctx_1",
      result: buildResult({ status: "constraint_blocked", projectedGapAmount: 10 }),
    });

    expect(outcome.kind).toBe("result");
    if (outcome.kind === "result") {
      expect(outcome.result.status).toBe("constraint_blocked");
    }
  });

  it("passes through optimized and within_budget results unchanged", () => {
    const optimized = resolveBudgetOptimizationStreamOutcome({
      optimizationContextId: "bgt_ctx_1",
      result: buildResult({ status: "optimized" }),
    });
    const withinBudget = resolveBudgetOptimizationStreamOutcome({
      optimizationContextId: "bgt_ctx_1",
      result: buildResult({ status: "within_budget" }),
    });

    expect(optimized.kind).toBe("result");
    expect(withinBudget.kind).toBe("result");
  });
});
