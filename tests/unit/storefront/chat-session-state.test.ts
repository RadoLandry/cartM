import { describe, expect, it } from "vitest";

import {
  buildChatThreadMessage,
  canSubmitChatMessage,
  createInitialChatSessionState,
  reduceChatSessionState,
} from "../../../storefront-widget/src/hooks/useChatSessionState";
import { makeStorefrontChatSessionState } from "../../helpers/storefront-chat-fixtures";

describe("storefront chat session state", () => {
  it("preserves the thread when the panel closes and reopens in the same session", () => {
    const initialState = createInitialChatSessionState({
      shop: "test.myshopify.com",
      surface: "cart_drawer",
      sessionId: "browser-session-123",
      cartId: "gid://shopify/Cart/123",
      currencyCode: "USD",
    });
    const withThread = reduceChatSessionState(
      reduceChatSessionState(
        reduceChatSessionState(initialState, { type: "panel_opened" }),
        {
          type: "user_message_added",
          message: buildChatThreadMessage("user-1", "user", "Can I spar with these gloves?"),
        },
      ),
      { type: "assistant_message_started", messageId: "assistant-1" },
    );
    const closedState = reduceChatSessionState(withThread, { type: "panel_closed" });
    const reopenedState = reduceChatSessionState(closedState, { type: "panel_opened" });

    expect(reopenedState.isOpen).toBe(true);
    expect(reopenedState.messages).toHaveLength(2);
    expect(reopenedState.messages[0].content).toBe("Can I spar with these gloves?");
  });

  it("prevents duplicate submits while a stream is active and allows retry once the stream fails", () => {
    const streamingState = makeStorefrontChatSessionState({ status: "streaming" });

    expect(canSubmitChatMessage(streamingState, "Any size concerns?")).toBe(false);

    const erroredState = reduceChatSessionState(
      makeStorefrontChatSessionState({
        status: "streaming",
        messages: [buildChatThreadMessage("assistant-1", "assistant", "", "streaming")],
      }),
      {
        type: "stream_failed",
        messageId: "assistant-1",
        error: "Session expired.",
        retryableMessage: "Any size concerns?",
      },
    );
    const retryReadyState = reduceChatSessionState(erroredState, { type: "retry_requested" });

    expect(retryReadyState.status).toBe("ready");
    expect(retryReadyState.messages).toHaveLength(0);
    expect(canSubmitChatMessage(retryReadyState, "Any size concerns?")).toBe(true);
  });

  it("appends streamed assistant text and guidance blocks before completion", () => {
    const startedState = reduceChatSessionState(
      makeStorefrontChatSessionState({ messages: [buildChatThreadMessage("user-1", "user", "Compare these.")] }),
      { type: "assistant_message_started", messageId: "assistant-1" },
    );
    const withText = reduceChatSessionState(startedState, {
      type: "assistant_text_delta",
      messageId: "assistant-1",
      text: "Here is a quick comparison.",
    });
    const completedState = reduceChatSessionState(withText, {
      type: "assistant_message_completed",
      messageId: "assistant-1",
    });

    expect(completedState.status).toBe("ready");
    expect(completedState.messages[1]).toMatchObject({
      content: "Here is a quick comparison.",
      state: "complete",
    });
  });
});