import { useEffect, useRef, type Dispatch } from "react";

import {
  StorefrontChatBootstrapResponseSchema,
  StorefrontChatStreamPartSchema,
} from "../../../app/lib/ai/schemas";
import type { StorefrontChatMountConfig } from "../types";
import {
  buildChatThreadMessage,
  canSubmitChatMessage,
  type ChatSessionAction,
  type ChatSessionState,
  type ChatThreadMessage,
} from "./useChatSessionState";
import type { StorefrontCartSnapshot } from "../types";

type RequestMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

interface UseStorefrontChatOptions {
  config: StorefrontChatMountConfig;
  state: ChatSessionState;
  dispatch: Dispatch<ChatSessionAction>;
  fetchImpl?: typeof fetch;
  resolveCartSnapshot?: () => Promise<StorefrontCartSnapshot>;
}

function buildBootstrapRequest(config: StorefrontChatMountConfig, state: ChatSessionState, cart: StorefrontCartSnapshot) {
  return {
    shop: config.shop,
    cartId: cart.cartId,
    surface: config.surface,
    sessionId: state.sessionId,
    currencyCode: cart.currencyCode,
  };
}

function buildRequestMessages(messages: ChatThreadMessage[], pendingUserMessage: string): RequestMessage[] {
  return [
    ...messages
      .filter((message) => message.state !== "failed" && message.content.trim().length > 0)
      .map((message) => ({
        role: message.role,
        content: message.content,
      })),
    {
      role: "user",
      content: pendingUserMessage,
    },
  ];
}

function extractSsePayloads(buffer: string) {
  const frames = buffer.split("\n\n");
  const remainder = frames.pop() ?? "";
  const payloads = frames.flatMap((frame) => frame
    .split("\n")
    .filter((line) => line.startsWith("data: "))
    .map((line) => line.slice(6)));

  return {
    payloads,
    remainder,
  };
}

async function readJsonError(response: Response) {
  const payload = await response.json().catch(() => null);
  return payload?.error?.message || `Chat request failed with status ${response.status}.`;
}

export function useStorefrontChat({
  config,
  state,
  dispatch,
  fetchImpl = fetch,
  resolveCartSnapshot,
}: UseStorefrontChatOptions) {
  const stateRef = useRef(state);
  const lastCartFingerprintRef = useRef("");

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  async function ensureBootstrap(cart: StorefrontCartSnapshot) {
    const currentState = stateRef.current;
    const cartIdChanged = Boolean(currentState.cartId && cart.cartId && currentState.cartId !== cart.cartId);

    if (cartIdChanged) {
      dispatch({ type: "bootstrap_reset" });
    }

    if (!cartIdChanged && currentState.streamToken && currentState.chatUrl && currentState.sessionKey) {
      return {
        chatUrl: currentState.chatUrl,
        sessionKey: currentState.sessionKey,
        streamToken: currentState.streamToken,
      };
    }

    dispatch({ type: "bootstrap_requested" });

    const response = await fetchImpl(config.bootstrapUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(buildBootstrapRequest(config, currentState, cart)),
    });

    if (!response.ok) {
      const errorMessage = await readJsonError(response);
      dispatch({ type: "bootstrap_failed", error: errorMessage });
      throw new Error(errorMessage);
    }

    const payload = StorefrontChatBootstrapResponseSchema.parse(await response.json());
    dispatch({ type: "bootstrap_succeeded", bootstrap: payload.bootstrap });

    return {
      chatUrl: payload.bootstrap.chatUrl,
      sessionKey: payload.bootstrap.sessionKey,
      streamToken: payload.bootstrap.streamToken,
    };
  }

  async function getCurrentCartSnapshot() {
    if (resolveCartSnapshot) {
      return await resolveCartSnapshot();
    }

    return config.cart;
  }

  async function streamAssistantReply(assistantMessageId: string, pendingUserMessage: string) {
    const currentState = stateRef.current;
    const currentCart = await getCurrentCartSnapshot();
    const currentFingerprint = JSON.stringify(currentCart.items.map((item) => [item.productId, item.variantId, item.quantity]));

    if (lastCartFingerprintRef.current && lastCartFingerprintRef.current !== currentFingerprint) {
      dispatch({ type: "bootstrap_reset" });
    }

    lastCartFingerprintRef.current = currentFingerprint;

    const bootstrap = await ensureBootstrap(currentCart);
    const response = await fetchImpl(bootstrap.chatUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        shop: config.shop,
        sessionKey: bootstrap.sessionKey,
        streamToken: bootstrap.streamToken,
        cart: currentCart,
        messages: buildRequestMessages(currentState.messages, pendingUserMessage),
      }),
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      const errorMessage = payload?.error?.message || `Chat request failed with status ${response.status}.`;

      if (payload?.error?.code === "TOKEN_EXPIRED") {
        dispatch({ type: "session_invalidated", error: errorMessage });
      }

      throw new Error(errorMessage);
    }

    if (!response.body) {
      throw new Error("The chat stream returned no response body.");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { value, done } = await reader.read();

      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const { payloads, remainder } = extractSsePayloads(buffer);
      buffer = remainder;

      for (const payload of payloads) {
        const part = StorefrontChatStreamPartSchema.parse(JSON.parse(payload));

        switch (part.type) {
          case "text-delta":
            dispatch({ type: "assistant_text_delta", messageId: assistantMessageId, text: part.text });
            break;
          case "guidance-block":
            dispatch({ type: "guidance_block_added", messageId: assistantMessageId, block: part.block });
            break;
          case "message-complete":
            dispatch({ type: "assistant_message_completed", messageId: assistantMessageId });
            break;
          case "error":
            throw new Error(part.message);
        }
      }
    }
  }

  async function submitMessage(draft: string) {
    const currentState = stateRef.current;
    const trimmedDraft = draft.trim();

    if (!canSubmitChatMessage(currentState, trimmedDraft)) {
      return false;
    }

    const timestamp = Date.now();
    const userMessageId = `user-${timestamp}`;
    const assistantMessageId = `assistant-${timestamp}`;

    dispatch({
      type: "user_message_added",
      message: buildChatThreadMessage(userMessageId, "user", trimmedDraft),
    });
    dispatch({ type: "assistant_message_started", messageId: assistantMessageId });

    try {
      await streamAssistantReply(assistantMessageId, trimmedDraft);
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to complete the chat request.";
      dispatch({
        type: "stream_failed",
        messageId: assistantMessageId,
        error: message,
        retryableMessage: trimmedDraft,
      });
      return false;
    }
  }

  async function retryLastMessage() {
    const currentState = stateRef.current;
    const retryMessage = currentState.retryableMessage
      || [...currentState.messages].reverse().find((message) => message.role === "user")?.content;

    if (!retryMessage) {
      return false;
    }

    dispatch({ type: "retry_requested" });
    return await submitMessage(retryMessage);
  }

  return {
    submitMessage,
    retryLastMessage,
  };
}