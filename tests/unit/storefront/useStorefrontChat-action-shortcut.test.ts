import { describe, expect, it } from "vitest";

import { buildChatThreadMessage, reduceChatSessionState } from "../../../storefront-widget/src/hooks/useChatSessionState";
import { resolveBudgetApprovalShortcut } from "../../../storefront-widget/src/hooks/useStorefrontChat";
import { makeStorefrontChatSessionState } from "../../helpers/storefront-chat-fixtures";
import { makeCartToolAction } from "../../helpers/storefront-chat-cart-fixtures";

describe("storefront budget action shortcut", () => {
  it("resolves latest pending budget action for optimizeBudget command", () => {
    const budgetAction = makeCartToolAction({
      actionId: "budget-action-1",
      toolName: "optimizeBudget",
      payload: {
        actionType: "budget_optimization_select",
        optimizationContextId: "bgt_ctx_1",
        candidateIds: ["c1", "c2"],
      },
    });

    const base = makeStorefrontChatSessionState();
    const withAssistant = reduceChatSessionState(base, {
      type: "assistant_message_started",
      messageId: "assistant-1",
    });
    const withProposal = reduceChatSessionState(withAssistant, {
      type: "tool_action_proposed",
      messageId: "assistant-1",
      action: budgetAction,
    });

    const resolved = resolveBudgetApprovalShortcut(withProposal, "optimizeBudget");

    expect(resolved?.actionId).toBe("budget-action-1");
  });

  it("does not resolve shortcut for already executed budget actions", () => {
    const budgetAction = makeCartToolAction({
      actionId: "budget-action-2",
      toolName: "optimizeBudget",
      payload: {
        actionType: "budget_optimization_select",
        optimizationContextId: "bgt_ctx_2",
        candidateIds: ["c1"],
      },
    });

    const withMessage = makeStorefrontChatSessionState({
      messages: [
        {
          ...buildChatThreadMessage("assistant-1", "assistant", "Ready to apply budget plan"),
          actionProposals: [budgetAction],
        },
      ],
      actionHistory: [
        {
          actionId: budgetAction.actionId,
          toolName: budgetAction.toolName,
          status: "executed",
          summary: "Applied budget optimization.",
          proposedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
    });

    const resolved = resolveBudgetApprovalShortcut(withMessage, "apply budget plan");

    expect(resolved).toBeNull();
  });

  it("returns null for unrelated text", () => {
    const state = makeStorefrontChatSessionState();
    const resolved = resolveBudgetApprovalShortcut(state, "what is my cart total?");
    expect(resolved).toBeNull();
  });
});
