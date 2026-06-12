import { describe, expect, it } from "vitest";

import {
  buildChatThreadMessage,
  reduceChatSessionState,
} from "../../../storefront-widget/src/hooks/useChatSessionState";
import { makeStorefrontChatSessionState } from "../../helpers/storefront-chat-fixtures";
import { makeCartToolAction } from "../../helpers/storefront-chat-cart-fixtures";

describe("storefront action confirmation state", () => {
  it("tracks pending confirmation and stores executed action outcome", () => {
    const action = makeCartToolAction({
      actionId: "action-confirm-1",
      toolName: "changeQuantity",
      payload: {
        actionType: "change_quantity",
        lineId: "line-1",
        quantity: 3,
      },
    });

    const withMessage = reduceChatSessionState(
      makeStorefrontChatSessionState(),
      {
        type: "assistant_message_started",
        messageId: "assistant-1",
      },
    );

    const withProposal = reduceChatSessionState(withMessage, {
      type: "tool_action_proposed",
      messageId: "assistant-1",
      action,
    });

    const confirming = reduceChatSessionState(withProposal, {
      type: "action_confirmation_requested",
      actionId: action.actionId,
    });

    expect(confirming.pendingActionId).toBe(action.actionId);

    const withStatus = reduceChatSessionState(confirming, {
      type: "tool_action_status",
      actionId: action.actionId,
      status: "executed",
      summary: "Item quantity updated.",
    });

    const finished = reduceChatSessionState(withStatus, {
      type: "action_confirmation_finished",
      actionId: action.actionId,
    });

    expect(finished.pendingActionId).toBeUndefined();
    expect(finished.actionHistory.find((item) => item.actionId === action.actionId)).toMatchObject({
      status: "executed",
      summary: "Item quantity updated.",
    });
  });

  it("sets error state when confirmation fails", () => {
    const action = makeCartToolAction({ actionId: "action-confirm-2" });

    const withPending = reduceChatSessionState(
      makeStorefrontChatSessionState({
        messages: [buildChatThreadMessage("assistant-1", "assistant", "Review this action")],
      }),
      {
        type: "action_confirmation_requested",
        actionId: action.actionId,
      },
    );

    const failed = reduceChatSessionState(withPending, {
      type: "action_confirmation_failed",
      actionId: action.actionId,
      error: "Unable to confirm this cart action.",
    });

    expect(failed.status).toBe("error");
    expect(failed.lastError).toBe("Unable to confirm this cart action.");
    expect(failed.pendingActionId).toBeUndefined();
  });

  it("tracks failed quantity confirmation outcomes in action history", () => {
    const action = makeCartToolAction({
      actionId: "action-confirm-3",
      toolName: "changeQuantity",
      payload: {
        actionType: "change_quantity",
        lineId: "line-1",
        quantity: 1,
      },
    });

    const withProposal = reduceChatSessionState(
      makeStorefrontChatSessionState(),
      {
        type: "tool_action_proposed",
        messageId: "assistant-1",
        action,
      },
    );

    const withStatus = reduceChatSessionState(withProposal, {
      type: "tool_action_status",
      actionId: action.actionId,
      status: "failed",
      summary: "Requested quantity update is invalid.",
    });

    expect(withStatus.actionHistory.find((item) => item.actionId === action.actionId)).toMatchObject({
      status: "failed",
      summary: "Requested quantity update is invalid.",
    });
  });

  it("preserves distinct action history across add/remove/swap with replay-safe updates", () => {
    const addAction = makeCartToolAction({
      actionId: "action-add",
      toolName: "addToCart",
      payload: {
        actionType: "add",
        merchandiseId: "gid://shopify/ProductVariant/101",
        quantity: 1,
      },
    });
    const removeAction = makeCartToolAction({
      actionId: "action-remove",
      toolName: "removeFromCart",
      payload: {
        actionType: "remove",
        lineId: "line-1",
      },
    });
    const swapAction = makeCartToolAction({
      actionId: "action-swap",
      toolName: "swapVariant",
      payload: {
        actionType: "swap_variant",
        lineId: "line-2",
        newMerchandiseId: "gid://shopify/ProductVariant/202",
        quantity: 1,
      },
    });

    const withProposals = [addAction, removeAction, swapAction].reduce((state, action) => (
      reduceChatSessionState(state, {
        type: "tool_action_proposed",
        messageId: "assistant-1",
        action,
      })
    ), makeStorefrontChatSessionState());

    const withStatuses = reduceChatSessionState(
      reduceChatSessionState(
        reduceChatSessionState(withProposals, {
          type: "tool_action_status",
          actionId: addAction.actionId,
          status: "executed",
          summary: "Added item.",
        }),
        {
          type: "tool_action_status",
          actionId: removeAction.actionId,
          status: "failed",
          summary: "Line was already removed.",
        },
      ),
      {
        type: "tool_action_status",
        actionId: addAction.actionId,
        status: "executed",
        summary: "Added item.",
      },
    );

    expect(withStatuses.actionHistory).toHaveLength(3);
    expect(withStatuses.actionHistory.find((item) => item.actionId === addAction.actionId)).toMatchObject({
      status: "executed",
      summary: "Added item.",
    });
    expect(withStatuses.actionHistory.find((item) => item.actionId === removeAction.actionId)).toMatchObject({
      status: "failed",
      summary: "Line was already removed.",
    });
    expect(withStatuses.actionHistory.find((item) => item.actionId === swapAction.actionId)).toMatchObject({
      status: "proposed",
      summary: "Awaiting confirmation.",
    });
  });
});
