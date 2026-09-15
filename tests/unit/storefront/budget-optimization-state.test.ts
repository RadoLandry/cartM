import { describe, expect, it } from "vitest";

import {
  buildChatThreadMessage,
  createInitialChatSessionState,
  reduceChatSessionState,
} from "../../../storefront-widget/src/hooks/useChatSessionState";
import {
  buildBudgetOptimizationCandidateDecisionAction,
  resolveBudgetOptimizationSelectedCandidateIds,
} from "../../../storefront-widget/src/hooks/useStorefrontChat";
import { mapBudgetOptimizationToGuidanceBlock } from "../../../app/lib/ai/storefront-chat-client";
import type { BudgetOptimizationResult } from "../../../app/lib/ai/schemas";

function baseState() {
  return createInitialChatSessionState({
    shop: "test.myshopify.com",
    surface: "cart_drawer",
    sessionId: "session-1",
    currencyCode: "USD",
  });
}

function buildOptimizationResult(overrides: Partial<BudgetOptimizationResult> = {}): BudgetOptimizationResult {
  return {
    optimizationContextId: "bgt_ctx_1",
    requestId: "req_1",
    generatedAt: "2026-06-02T10:00:00.000Z",
    baselineSubtotal: 100,
    targetBudgetAmount: 60,
    projectedSubtotal: 55,
    projectedGapAmount: 0,
    status: "optimized",
    candidates: [
      {
        candidateId: "c_bag",
        changeType: "remove",
        sourceLineId: "line_1",
        sourceProductId: "prod_bag",
        estimatedSavings: 20,
        safetyCriticalImpact: "none",
        rationale: "Remove optional bag.",
        disciplineFitScore: 0.6,
        availability: "available",
      },
      {
        candidateId: "c_gloves",
        changeType: "remove",
        sourceLineId: "line_2",
        sourceProductId: "prod_gloves",
        estimatedSavings: 25,
        safetyCriticalImpact: "reduced_protection",
        rationale: "Remove secondary gloves.",
        disciplineFitScore: 0.5,
        availability: "available",
      },
    ],
    constraints: [],
    freshness: {
      priceCheckedAt: "2026-06-02T10:00:00.000Z",
      availabilityCheckedAt: "2026-06-02T10:00:00.000Z",
    },
    ...overrides,
  };
}

describe("budget optimization storefront state", () => {
  it("stores latest optimization context and totals", () => {
    const optimization = buildOptimizationResult();
    const block = mapBudgetOptimizationToGuidanceBlock({ optimization, currencyCode: "USD" });

    const state = reduceChatSessionState(baseState(), {
      type: "user_message_added",
      message: buildChatThreadMessage("assistant-1", "assistant", block.summary, "complete"),
    });
    const withBlock = {
      ...state,
      messages: state.messages.map((message) => (
        message.id === "assistant-1" ? { ...message, guidanceBlocks: [block] } : message
      )),
    };

    const stored = withBlock.messages[0]?.guidanceBlocks?.[0] as typeof block;

    expect(stored.optimizationContextId ?? "bgt_ctx_1").toBe("bgt_ctx_1");
    expect(stored.targetBudgetAmount).toBe(60);
    expect(stored.projectedSubtotal).toBe(55);
    expect(resolveBudgetOptimizationSelectedCandidateIds(block, withBlock, "bgt_ctx_1")).toEqual(["c_bag", "c_gloves"]);
  });

  it("applies candidate-level decision updates", () => {
    const optimization = buildOptimizationResult();
    const block = mapBudgetOptimizationToGuidanceBlock({ optimization, currencyCode: "USD" });

    let state = reduceChatSessionState(
      baseState(),
      buildBudgetOptimizationCandidateDecisionAction({
        optimizationContextId: "bgt_ctx_1",
        candidateId: "c_gloves",
        accepted: false,
      }),
    );

    expect(state.budgetOptimizationDecisions["bgt_ctx_1"]).toEqual(["c_gloves"]);
    expect(state.budgetOptimizationDecisionHistory).toHaveLength(1);
    expect(state.budgetOptimizationDecisionHistory[0]).toMatchObject({
      optimizationContextId: "bgt_ctx_1",
      candidateId: "c_gloves",
      accepted: false,
    });
    expect(resolveBudgetOptimizationSelectedCandidateIds(block, state, "bgt_ctx_1")).toEqual(["c_bag"]);

    state = reduceChatSessionState(
      state,
      buildBudgetOptimizationCandidateDecisionAction({
        optimizationContextId: "bgt_ctx_1",
        candidateId: "c_gloves",
        accepted: true,
      }),
    );

    expect(state.budgetOptimizationDecisions["bgt_ctx_1"]).toEqual([]);
    expect(state.budgetOptimizationDecisionHistory).toHaveLength(2);
    expect(resolveBudgetOptimizationSelectedCandidateIds(block, state, "bgt_ctx_1")).toEqual(["c_bag", "c_gloves"]);
  });

  it("handles stale optimization errors gracefully", () => {
    let state = reduceChatSessionState(baseState(), {
      type: "assistant_message_started",
      messageId: "assistant-1",
    });

    state = reduceChatSessionState(state, {
      type: "stream_failed",
      messageId: "assistant-1",
      error: "Budget optimization result is no longer available. Please run optimization again.",
      retryableMessage: "Ask CartMind to re-run budget optimization.",
    });

    expect(state.status).toBe("error");
    expect(state.lastError).toContain("no longer available");
    expect(state.messages[0]?.state).toBe("failed");
    expect(state.budgetOptimizationDecisions).toEqual({});
    expect(resolveBudgetOptimizationSelectedCandidateIds({ candidates: [] }, state, "bgt_ctx_missing")).toEqual([]);
  });
});
