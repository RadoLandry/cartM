import { useEffect, useReducer } from "react";

import type {
  CartToolAction,
  CartToolActionStatus,
  ProductComparisonResult,
  StorefrontChatBootstrap,
  StorefrontChatSurface,
  StructuredGuidanceBlock,
} from "../../../app/lib/ai/schemas";

export type ChatSessionStatus = "idle" | "bootstrapping" | "ready" | "streaming" | "error";
export type ChatMessageState = "complete" | "streaming" | "failed";

export interface ChatThreadMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  state: ChatMessageState;
  guidanceBlocks: StructuredGuidanceBlock[];
  actionProposals: CartToolAction[];
}

export interface ChatActionHistoryItem {
  actionId: string;
  toolName: CartToolAction["toolName"];
  status: CartToolActionStatus;
  summary?: string;
  proposedAt: string;
  updatedAt: string;
}

export interface ChatComparisonContext {
  comparisonContextId: string;
  requestId: string;
  generatedAt: string;
  status: "generated" | "failed" | "expired" | "action_pending" | "action_executed" | "action_failed";
  summary?: string;
  result?: ProductComparisonResult;
}

export interface ChatSessionState {
  shop: string;
  surface: StorefrontChatSurface;
  sessionId: string;
  cartId?: string;
  currencyCode: string;
  isOpen: boolean;
  isCollapsed: boolean;
  status: ChatSessionStatus;
  draft: string;
  messages: ChatThreadMessage[];
  lastError?: string;
  retryableMessage?: string;
  sessionKey?: string;
  streamToken?: string;
  streamTokenExpiresAt?: string;
  chatUrl?: string;
  actionHistory: ChatActionHistoryItem[];
  comparisonContexts: ChatComparisonContext[];
  latestComparisonContextId?: string;
  pendingActionId?: string;
}

interface CreateInitialChatSessionStateInput {
  shop: string;
  surface: StorefrontChatSurface;
  sessionId: string;
  cartId?: string;
  currencyCode: string;
  persistedState?: Partial<ChatSessionState> | null;
}

export type ChatSessionAction =
  | { type: "draft_changed"; draft: string }
  | { type: "panel_opened" }
  | { type: "panel_closed" }
  | { type: "panel_collapsed" }
  | { type: "panel_expanded" }
  | { type: "bootstrap_requested" }
  | { type: "bootstrap_reset" }
  | { type: "bootstrap_succeeded"; bootstrap: StorefrontChatBootstrap }
  | { type: "bootstrap_failed"; error: string }
  | { type: "session_invalidated"; error?: string }
  | { type: "user_message_added"; message: ChatThreadMessage }
  | { type: "assistant_message_started"; messageId: string }
  | { type: "assistant_text_delta"; messageId: string; text: string }
  | { type: "guidance_block_added"; messageId: string; block: StructuredGuidanceBlock }
  | { type: "tool_action_proposed"; messageId: string; action: CartToolAction }
  | { type: "tool_action_status"; actionId: string; status: CartToolActionStatus; summary?: string }
  | { type: "comparison_context_upsert"; context: ChatComparisonContext }
  | { type: "comparison_context_failed"; comparisonContextId: string; summary: string }
  | { type: "comparison_context_dismissed"; comparisonContextId: string }
  | { type: "action_confirmation_requested"; actionId: string }
  | { type: "action_confirmation_finished"; actionId: string }
  | { type: "action_confirmation_failed"; actionId: string; error: string }
  | { type: "assistant_message_completed"; messageId: string }
  | { type: "stream_failed"; messageId?: string; error: string; retryableMessage?: string }
  | { type: "retry_requested" };

export function getChatSessionStorageKey(shop: string, surface: StorefrontChatSurface, sessionId: string) {
  return `cartmind-chat:${shop}:${surface}:${sessionId}`;
}

export function createBrowserSessionId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `session-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function mergePersistedState(
  baseState: ChatSessionState,
  persistedState: Partial<ChatSessionState> | null | undefined,
): ChatSessionState {
  if (!persistedState) {
    return baseState;
  }

  return {
    ...baseState,
    ...persistedState,
    shop: baseState.shop,
    surface: baseState.surface,
    sessionId: baseState.sessionId,
    cartId: baseState.cartId,
    currencyCode: baseState.currencyCode,
  };
}

export function createInitialChatSessionState(
  input: CreateInitialChatSessionStateInput,
): ChatSessionState {
  const baseState: ChatSessionState = {
    shop: input.shop,
    surface: input.surface,
    sessionId: input.sessionId,
    cartId: input.cartId,
    currencyCode: input.currencyCode,
    isOpen: false,
    isCollapsed: false,
    status: "idle",
    draft: "",
    messages: [],
    lastError: undefined,
    retryableMessage: undefined,
    sessionKey: undefined,
    streamToken: undefined,
    streamTokenExpiresAt: undefined,
    chatUrl: undefined,
    actionHistory: [],
    comparisonContexts: [],
    latestComparisonContextId: undefined,
    pendingActionId: undefined,
  };

  return mergePersistedState(baseState, input.persistedState);
}

function updateMessage(
  state: ChatSessionState,
  messageId: string,
  updater: (message: ChatThreadMessage) => ChatThreadMessage,
) {
  return state.messages.map((message) => (
    message.id === messageId ? updater(message) : message
  ));
}

export function canSubmitChatMessage(state: ChatSessionState, draft: string) {
  return draft.trim().length > 0 && state.status !== "bootstrapping" && state.status !== "streaming";
}

export function buildChatThreadMessage(
  id: string,
  role: ChatThreadMessage["role"],
  content: string,
  state: ChatMessageState = "complete",
): ChatThreadMessage {
  return {
    id,
    role,
    content,
    state,
    guidanceBlocks: [],
    actionProposals: [],
  };
}

function upsertActionHistory(
  history: ChatActionHistoryItem[],
  nextItem: Omit<ChatActionHistoryItem, "updatedAt">,
): ChatActionHistoryItem[] {
  const existing = history.find((item) => item.actionId === nextItem.actionId);
  const updatedAt = new Date().toISOString();

  if (!existing) {
    return [...history, { ...nextItem, updatedAt }];
  }

  return history.map((item) => (
    item.actionId === nextItem.actionId
      ? {
          ...item,
          ...nextItem,
          updatedAt,
        }
      : item
  ));
}

function upsertComparisonContext(
  contexts: ChatComparisonContext[],
  nextContext: ChatComparisonContext,
): ChatComparisonContext[] {
  const existing = contexts.find((item) => item.comparisonContextId === nextContext.comparisonContextId);

  if (!existing) {
    return [...contexts, nextContext];
  }

  return contexts.map((item) => (
    item.comparisonContextId === nextContext.comparisonContextId
      ? {
          ...item,
          ...nextContext,
        }
      : item
  ));
}

export function reduceChatSessionState(
  state: ChatSessionState,
  action: ChatSessionAction,
): ChatSessionState {
  switch (action.type) {
    case "draft_changed":
      return {
        ...state,
        draft: action.draft,
      };
    case "panel_opened":
      return {
        ...state,
        isOpen: true,
        isCollapsed: false,
      };
    case "panel_closed":
      return {
        ...state,
        isOpen: false,
        isCollapsed: false,
      };
    case "panel_collapsed":
      return {
        ...state,
        isOpen: true,
        isCollapsed: true,
      };
    case "panel_expanded":
      return {
        ...state,
        isOpen: true,
        isCollapsed: false,
      };
    case "bootstrap_requested":
      return {
        ...state,
        status: "bootstrapping",
        lastError: undefined,
      };
    case "bootstrap_reset":
      return {
        ...state,
        status: "idle",
        sessionKey: undefined,
        streamToken: undefined,
        streamTokenExpiresAt: undefined,
        chatUrl: undefined,
      };
    case "bootstrap_succeeded":
      return {
        ...state,
        status: state.status === "streaming" ? "streaming" : "ready",
        cartId: action.bootstrap.cartId,
        sessionKey: action.bootstrap.sessionKey,
        streamToken: action.bootstrap.streamToken,
        streamTokenExpiresAt: action.bootstrap.expiresAt,
        chatUrl: action.bootstrap.chatUrl,
        lastError: undefined,
      };
    case "bootstrap_failed":
      return {
        ...state,
        status: "error",
        lastError: action.error,
      };
    case "session_invalidated":
      return {
        ...state,
        status: "error",
        streamToken: undefined,
        streamTokenExpiresAt: undefined,
        sessionKey: undefined,
        lastError: action.error ?? state.lastError,
      };
    case "user_message_added":
      return {
        ...state,
        draft: "",
        isOpen: true,
        isCollapsed: false,
        status: "streaming",
        lastError: undefined,
        retryableMessage: undefined,
        messages: [...state.messages, action.message],
      };
    case "assistant_message_started":
      return {
        ...state,
        status: "streaming",
        messages: [...state.messages, buildChatThreadMessage(action.messageId, "assistant", "", "streaming")],
      };
    case "assistant_text_delta":
      return {
        ...state,
        messages: updateMessage(state, action.messageId, (message) => ({
          ...message,
          content: `${message.content}${action.text}`,
        })),
      };
    case "guidance_block_added":
      return {
        ...state,
        messages: updateMessage(state, action.messageId, (message) => ({
          ...message,
          guidanceBlocks: [...message.guidanceBlocks, action.block],
        })),
      };
    case "tool_action_proposed":
      return {
        ...state,
        messages: updateMessage(state, action.messageId, (message) => ({
          ...message,
          actionProposals: [...message.actionProposals, action.action],
        })),
        actionHistory: upsertActionHistory(state.actionHistory, {
          actionId: action.action.actionId,
          toolName: action.action.toolName,
          status: "proposed",
          summary: "Awaiting confirmation.",
          proposedAt: new Date().toISOString(),
        }),
      };
    case "tool_action_status": {
      const existing = state.actionHistory.find((item) => item.actionId === action.actionId);

      if (!existing) {
        return state;
      }

      return {
        ...state,
        actionHistory: upsertActionHistory(state.actionHistory, {
          actionId: existing.actionId,
          toolName: existing.toolName,
          status: action.status,
          summary: action.summary ?? existing.summary,
          proposedAt: existing.proposedAt,
        }),
      };
    }
    case "comparison_context_upsert":
      return {
        ...state,
        comparisonContexts: upsertComparisonContext(state.comparisonContexts, action.context),
        latestComparisonContextId: action.context.comparisonContextId,
      };
    case "comparison_context_failed":
      return {
        ...state,
        comparisonContexts: state.comparisonContexts.map((context) => (
          context.comparisonContextId === action.comparisonContextId
            ? {
                ...context,
                status: "failed",
                summary: action.summary,
              }
            : context
        )),
        latestComparisonContextId: action.comparisonContextId,
      };
    case "comparison_context_dismissed": {
      const remaining = state.comparisonContexts.filter((context) => (
        context.comparisonContextId !== action.comparisonContextId
      ));

      return {
        ...state,
        comparisonContexts: remaining,
        latestComparisonContextId: state.latestComparisonContextId === action.comparisonContextId
          ? remaining[remaining.length - 1]?.comparisonContextId
          : state.latestComparisonContextId,
      };
    }
    case "action_confirmation_requested":
      return {
        ...state,
        pendingActionId: action.actionId,
      };
    case "action_confirmation_finished":
      return {
        ...state,
        pendingActionId: state.pendingActionId === action.actionId ? undefined : state.pendingActionId,
      };
    case "action_confirmation_failed":
      return {
        ...state,
        status: "error",
        pendingActionId: state.pendingActionId === action.actionId ? undefined : state.pendingActionId,
        lastError: action.error,
      };
    case "assistant_message_completed":
      return {
        ...state,
        status: "ready",
        messages: updateMessage(state, action.messageId, (message) => ({
          ...message,
          state: "complete",
        })),
      };
    case "stream_failed":
      return {
        ...state,
        status: "error",
        lastError: action.error,
        retryableMessage: action.retryableMessage,
        messages: action.messageId
          ? updateMessage(state, action.messageId, (message) => ({
              ...message,
              state: "failed",
            }))
          : state.messages,
      };
    case "retry_requested":
      return {
        ...state,
        status: "ready",
        lastError: undefined,
        messages: state.messages.filter((message) => message.state !== "failed"),
      };
    default:
      return state;
  }
}

function readPersistedState(storageKey: string) {
  if (typeof window === "undefined") {
    return null;
  }

  const storedValue = window.sessionStorage.getItem(storageKey);

  if (!storedValue) {
    return null;
  }

  try {
    return JSON.parse(storedValue) as Partial<ChatSessionState>;
  } catch {
    return null;
  }
}

export function useChatSessionState(
  input: Omit<CreateInitialChatSessionStateInput, "persistedState">,
) {
  const storageKey = getChatSessionStorageKey(input.shop, input.surface, input.sessionId);
  const [state, dispatch] = useReducer(
    reduceChatSessionState,
    undefined,
    () => createInitialChatSessionState({
      ...input,
      persistedState: readPersistedState(storageKey),
    }),
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.sessionStorage.setItem(storageKey, JSON.stringify(state));
  }, [state, storageKey]);

  return {
    state,
    dispatch,
    storageKey,
  };
}