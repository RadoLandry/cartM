import type { CartToolAction, CartToolActionStatus, StorefrontChatSurface } from "../types";

export type ChatMessageRole = "user" | "assistant";
export type ChatMessageState = "streaming" | "complete" | "failed";
export type ChatSessionStatus = "idle" | "ready" | "streaming" | "error";

export interface ChatThreadMessage {
  id: string;
  role: ChatMessageRole;
  content: string;
  state: ChatMessageState;
  actionProposals?: CartToolAction[];
  guidanceBlocks?: unknown[];
}

export interface ChatActionHistoryItem {
  actionId: string;
  toolName: string;
  status: CartToolActionStatus;
  summary: string;
  proposedAt: string;
  updatedAt: string;
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
  pendingActionId?: string;
  comparisonContexts: unknown[];
  budgetOptimizationDecisions: Record<string, string[]>;
  budgetOptimizationDecisionHistory: BudgetOptimizationDecisionHistoryEntry[];
}

export interface BudgetOptimizationDecisionHistoryEntry {
  optimizationContextId: string;
  candidateId: string;
  accepted: boolean;
  decidedAt: string;
}

export type ChatSessionAction =
  | { type: "panel_opened" }
  | { type: "panel_closed" }
  | { type: "user_message_added"; message: ChatThreadMessage }
  | { type: "assistant_message_started"; messageId: string }
  | { type: "assistant_text_delta"; messageId: string; text: string }
  | { type: "assistant_message_completed"; messageId: string }
  | { type: "stream_failed"; messageId: string; error: string; retryableMessage?: string }
  | { type: "retry_requested" }
  | { type: "bootstrap_succeeded"; bootstrap: { sessionKey: string; streamToken: string; expiresAt: string; chatUrl: string; cartId?: string } }
  | { type: "bootstrap_reset" }
  | { type: "tool_action_proposed"; messageId: string; action: CartToolAction }
  | { type: "tool_action_status"; actionId: string; status: CartToolActionStatus; summary: string }
  | { type: "action_confirmation_requested"; actionId: string }
  | { type: "action_confirmation_finished"; actionId: string }
  | { type: "action_confirmation_failed"; actionId: string; error: string }
  | { type: "budget_candidate_decision"; optimizationContextId: string; candidateId: string; accepted: boolean };

export function buildChatThreadMessage(
  id: string,
  role: ChatMessageRole,
  content: string,
  state: ChatMessageState = "complete",
): ChatThreadMessage {
  return { id, role, content, state };
}

export function createInitialChatSessionState(input: {
  shop: string;
  surface: StorefrontChatSurface;
  sessionId: string;
  cartId?: string;
  currencyCode: string;
}): ChatSessionState {
  return {
    shop: input.shop,
    surface: input.surface,
    sessionId: input.sessionId,
    ...(input.cartId ? { cartId: input.cartId } : {}),
    currencyCode: input.currencyCode,
    isOpen: false,
    isCollapsed: false,
    status: "idle",
    draft: "",
    messages: [],
    actionHistory: [],
    comparisonContexts: [],
    budgetOptimizationDecisions: {},
    budgetOptimizationDecisionHistory: [],
  };
}

export function canSubmitChatMessage(state: ChatSessionState, draft: string) {
  return draft.trim().length > 0 && state.status !== "streaming";
}

function upsertActionHistory(
  state: ChatSessionState,
  action: Pick<CartToolAction, "actionId" | "toolName">,
  status: CartToolActionStatus,
  summary: string,
) {
  const now = new Date().toISOString();
  const existing = state.actionHistory.find((item) => item.actionId === action.actionId);
  if (existing) {
    return state.actionHistory.map((item) => item.actionId === action.actionId ? { ...item, status, summary, updatedAt: now } : item);
  }
  return [...state.actionHistory, { actionId: action.actionId, toolName: action.toolName, status, summary, proposedAt: now, updatedAt: now }];
}

export function reduceChatSessionState(state: ChatSessionState, action: ChatSessionAction): ChatSessionState {
  switch (action.type) {
    case "panel_opened":
      return { ...state, isOpen: true };
    case "panel_closed":
      return { ...state, isOpen: false };
    case "user_message_added":
      return { ...state, messages: [...state.messages, action.message] };
    case "assistant_message_started":
      return { ...state, status: "streaming", messages: [...state.messages, buildChatThreadMessage(action.messageId, "assistant", "", "streaming")] };
    case "assistant_text_delta":
      return { ...state, messages: state.messages.map((message) => message.id === action.messageId ? { ...message, content: message.content + action.text } : message) };
    case "assistant_message_completed":
      return { ...state, status: "ready", messages: state.messages.map((message) => message.id === action.messageId ? { ...message, state: "complete" } : message) };
    case "stream_failed":
      return {
        ...state,
        status: "error",
        lastError: action.error,
        retryableMessage: action.retryableMessage,
        messages: state.messages.map((message) => message.id === action.messageId ? { ...message, state: "failed" } : message),
      };
    case "retry_requested":
      return { ...state, status: "ready", messages: [], lastError: undefined };
    case "bootstrap_succeeded":
      return {
        ...state,
        status: "ready",
        cartId: action.bootstrap.cartId ?? state.cartId,
        sessionKey: action.bootstrap.sessionKey,
        streamToken: action.bootstrap.streamToken,
        streamTokenExpiresAt: action.bootstrap.expiresAt,
        chatUrl: action.bootstrap.chatUrl,
      };
    case "bootstrap_reset":
      return { ...state, status: "idle", sessionKey: undefined, streamToken: undefined, streamTokenExpiresAt: undefined, chatUrl: undefined };
    case "tool_action_proposed":
      return {
        ...state,
        messages: state.messages.map((message) => message.id === action.messageId ? { ...message, actionProposals: [...(message.actionProposals ?? []), action.action] } : message),
        actionHistory: upsertActionHistory(state, action.action, "proposed", "Awaiting confirmation."),
      };
    case "tool_action_status": {
      const known = state.actionHistory.find((item) => item.actionId === action.actionId);
      return {
        ...state,
        actionHistory: upsertActionHistory(state, { actionId: action.actionId, toolName: known?.toolName ?? "cartTool" }, action.status, action.summary),
      };
    }
    case "action_confirmation_requested":
      return { ...state, pendingActionId: action.actionId };
    case "action_confirmation_finished":
      return state.pendingActionId === action.actionId ? { ...state, pendingActionId: undefined } : state;
    case "action_confirmation_failed":
      return { ...state, status: "error", lastError: action.error, pendingActionId: undefined };
    case "budget_candidate_decision": {
      const currentlyDeclined = state.budgetOptimizationDecisions[action.optimizationContextId] ?? [];
      const nextDeclined = action.accepted
        ? currentlyDeclined.filter((candidateId) => candidateId !== action.candidateId)
        : currentlyDeclined.includes(action.candidateId)
          ? currentlyDeclined
          : [...currentlyDeclined, action.candidateId];

      return {
        ...state,
        budgetOptimizationDecisions: {
          ...state.budgetOptimizationDecisions,
          [action.optimizationContextId]: nextDeclined,
        },
        budgetOptimizationDecisionHistory: [
          ...state.budgetOptimizationDecisionHistory,
          {
            optimizationContextId: action.optimizationContextId,
            candidateId: action.candidateId,
            accepted: action.accepted,
            decidedAt: new Date().toISOString(),
          },
        ],
      };
    }
    default:
      return state;
  }
}