import { useEffect, useRef, type Dispatch } from "react";

import {
  type CartToolAction,
  type ProductComparisonResult,
  StorefrontChatBootstrapResponseSchema,
  StorefrontChatStreamPartSchema,
} from "../../../app/lib/ai/schemas";
import { mapBudgetOptimizationToGuidanceBlock } from "../../../app/lib/ai/storefront-chat";
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

interface KitPreviewResponse {
  ok: boolean;
  status: "ok" | "partial" | "fallback" | "error";
  preview: {
    assetUrl: string | null;
    mimeType: string | null;
    width: number | null;
    height: number | null;
    reused: boolean;
  };
  context: {
    inferredDiscipline: string | null;
    layoutId: string;
    templateVersion: string;
  };
  omissions: Array<{
    lineId: string;
    reasonCode: string;
    reasonDetail?: string;
  }>;
  diagnostics: {
    generationMs: number | null;
  };
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

function toComparisonGuidanceBlock(result: ProductComparisonResult) {
  const productOrder = result.products.map((product) => product.productId);
  const rows = result.dimensions.map((dimension) => ({
    label: dimension.label,
    values: productOrder.map((productId) => String(dimension.values[productId] ?? "not_available")),
  }));

  return {
    blockId: `comparison-${result.comparisonContextId}`,
    type: "comparison_table" as const,
    title: "Product comparison",
    summary: result.recommendation?.rationale || "Side-by-side comparison of requested products.",
    priority: 1,
    columns: result.products.map((product) => ({
      key: product.productId,
      title: product.title,
    })),
    rows: [
      ...rows,
      {
        label: "Recommendation",
        values: productOrder.map((productId) => (
          productId === result.recommendation?.recommendedProductId ? "Recommended" : "-"
        )),
      },
    ],
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
  const lastPreviewFingerprintRef = useRef("");
  const lastKitPreviewResultRef = useRef<KitPreviewResponse | null>(null);

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

  async function requestKitPreview(cart: StorefrontCartSnapshot, forceRegenerate = false) {
    const requestUrl = new URL(config.bootstrapUrl);
    const previewUrl = new URL("/api/ai/kit-preview", requestUrl.origin);

    const response = await fetchImpl(previewUrl.toString(), {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        shop: config.shop,
        sessionId: stateRef.current.sessionId,
        cartId: cart.cartId || "anonymous-cart",
        surface: config.surface,
        viewportHint: "unknown",
        currencyCode: cart.currencyCode,
        forceRegenerate,
        cart: {
          items: cart.items.map((item) => ({
            lineId: item.lineId,
            productId: item.productId,
            variantId: item.variantId,
            productTitle: item.productTitle,
            variantTitle: item.variantTitle,
            quantity: item.quantity,
          })),
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Kit preview request failed with status ${response.status}.`);
    }

    const payload = await response.json() as KitPreviewResponse;
    lastKitPreviewResultRef.current = payload;
    return payload;
  }

  async function streamAssistantReply(assistantMessageId: string, pendingUserMessage: string) {
    const currentState = stateRef.current;
    const currentCart = await getCurrentCartSnapshot();
    const currentFingerprint = JSON.stringify(currentCart.items.map((item) => [item.productId, item.variantId, item.quantity]));

    if (lastCartFingerprintRef.current && lastCartFingerprintRef.current !== currentFingerprint) {
      dispatch({ type: "bootstrap_reset" });

      if (lastPreviewFingerprintRef.current !== currentFingerprint) {
        void requestKitPreview(currentCart, true).catch(() => undefined);
        lastPreviewFingerprintRef.current = currentFingerprint;
      }
    }

    lastCartFingerprintRef.current = currentFingerprint;

    if (!lastPreviewFingerprintRef.current) {
      void requestKitPreview(currentCart).catch(() => undefined);
      lastPreviewFingerprintRef.current = currentFingerprint;
    }

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
          case "tool-action-proposed":
            dispatch({ type: "tool_action_proposed", messageId: assistantMessageId, action: part.action });
            break;
          case "tool-action-status":
            dispatch({
              type: "tool_action_status",
              actionId: part.actionId,
              status: part.status,
              summary: part.summary,
            });
            break;
          case "comparison.proposed":
            dispatch({
              type: "comparison_context_upsert",
              context: {
                comparisonContextId: part.comparison.comparisonContextId,
                requestId: part.comparison.request.requestId,
                generatedAt: part.comparison.request.requestedAt,
                status: "generated",
                summary: "Comparison requested.",
              },
            });
            break;
          case "comparison.result":
            dispatch({
              type: "comparison_context_upsert",
              context: {
                comparisonContextId: part.comparison.comparisonContextId,
                requestId: part.comparison.requestId,
                generatedAt: part.comparison.generatedAt,
                status: "generated",
                summary: part.comparison.recommendation?.rationale,
                result: part.comparison,
              },
            });
            dispatch({
              type: "guidance_block_added",
              messageId: assistantMessageId,
              block: toComparisonGuidanceBlock(part.comparison),
            });
            break;
          case "comparison.error":
            dispatch({
              type: "comparison_context_failed",
              comparisonContextId: part.error.comparisonContextId,
              summary: part.error.message,
            });
            dispatch({
              type: "guidance_block_added",
              messageId: assistantMessageId,
              block: {
                blockId: `comparison-error-${part.error.comparisonContextId}`,
                type: "fallback_notice",
                title: "Comparison unavailable",
                summary: part.error.suggestedNextStep || part.error.message,
                priority: 1,
              },
            });
            break;
          case "budget-optimization.proposed":
            break;
          case "budget-optimization.result":
            dispatch({
              type: "guidance_block_added",
              messageId: assistantMessageId,
              block: mapBudgetOptimizationToGuidanceBlock({
                optimization: part.optimization,
                currencyCode: currentCart.currencyCode,
              }),
            });
            break;
          case "budget-optimization.error":
            dispatch({
              type: "guidance_block_added",
              messageId: assistantMessageId,
              block: {
                blockId: `budget-error-${part.error.optimizationContextId}`,
                type: "fallback_notice",
                title: "Budget optimization unavailable",
                summary: part.error.suggestedNextStep || part.error.message,
                priority: 1,
              },
            });
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

  async function submitActionConfirmation(
    action: CartToolAction,
    decision: "approve" | "decline",
    selection?: { productId: string; variantId?: string },
  ) {
    const currentCart = await getCurrentCartSnapshot();
    const requestUrl = new URL(config.bootstrapUrl);
    const confirmationUrl = new URL("/api/ai/chat/actions/confirm", requestUrl.origin);

    dispatch({ type: "action_confirmation_requested", actionId: action.actionId });

    try {
      const response = await fetchImpl(confirmationUrl.toString(), {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          shop: config.shop,
          sessionKey: action.sessionKey,
          actionId: action.actionId,
          confirmationToken: action.confirmationToken,
          decision,
          ...(action.payload.actionType === "comparison_select"
            ? {
                actionType: "comparison_select",
                comparisonContextId: action.payload.comparisonContextId,
                selectedProductId: selection?.productId || action.payload.recommended.productId,
                selectedVariantId: selection?.variantId || action.payload.recommended.variantId,
              }
            : action.payload.actionType === "budget_optimization_select"
              ? {
                  actionType: "budget_optimization_select",
                  optimizationContextId: action.payload.optimizationContextId,
                  candidateIds: action.payload.candidateIds,
                }
            : {}),
          cart: currentCart,
        }),
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error?.message || `Confirmation failed with status ${response.status}.`);
      }

      dispatch({
        type: "tool_action_status",
        actionId: payload.result.actionId,
        status: payload.result.status,
        summary: payload.result.summary,
      });
      dispatch({ type: "action_confirmation_finished", actionId: action.actionId });
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to confirm this cart action.";
      dispatch({
        type: "tool_action_status",
        actionId: action.actionId,
        status: "failed",
        summary: message,
      });
      dispatch({ type: "action_confirmation_failed", actionId: action.actionId, error: message });
      return false;
    }
  }

  return {
    submitMessage,
    retryLastMessage,
    submitActionConfirmation,
    requestKitPreview,
    getLastKitPreviewResult: () => lastKitPreviewResultRef.current,
  };
}