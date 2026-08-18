import type { CartToolAction } from "../types";
import type { ChatSessionState } from "./useChatSessionState";
import { normalizeCartJsPayload } from "./useCartStateSync";
import type { StorefrontCartSnapshot } from "../types";

export function normalizeAjaxMerchandiseId(value: string) {
  return value.trim().replace(/^gid:\/\/shopify\/ProductVariant\//, "");
}

async function refreshCart(currentCart: StorefrontCartSnapshot, fetchImpl: typeof fetch) {
  const response = await fetchImpl("/cart.js", { method: "GET", credentials: "same-origin" });
  const payload = await response.json();
  return normalizeCartJsPayload(payload, currentCart);
}

export async function applyStorefrontCartAction(
  action: CartToolAction,
  currentCart: StorefrontCartSnapshot,
  fetchImpl: typeof fetch = fetch,
) {
  const payload = action.payload;

  if (payload.actionType === "add") {
    await fetchImpl("/cart/add.js", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: normalizeAjaxMerchandiseId(payload.merchandiseId), quantity: payload.quantity }),
    });
  } else if (payload.actionType === "remove") {
    await fetchImpl("/cart/change.js", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: payload.lineId, quantity: 0 }),
    });
  } else if (payload.actionType === "change_quantity") {
    const changes = payload.changes ?? [{ lineId: payload.lineId, quantity: payload.quantity }];
    for (const change of changes) {
      await fetchImpl("/cart/change.js", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: change.lineId, quantity: change.quantity }),
      });
    }
  } else if (payload.actionType === "swap_variant") {
    await fetchImpl("/cart/change.js", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: payload.lineId, quantity: 0 }),
    });
    await fetchImpl("/cart/add.js", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: normalizeAjaxMerchandiseId(payload.newMerchandiseId), quantity: payload.quantity }),
    });
  }

  return refreshCart(currentCart, fetchImpl);
}

export function resolveBudgetApprovalShortcut(state: ChatSessionState, text: string) {
  if (!/\b(optimizeBudget|apply budget plan|budget plan)\b/i.test(text)) return null;
  const executedIds = new Set(state.actionHistory.filter((item) => item.status !== "proposed").map((item) => item.actionId));

  for (const message of [...state.messages].reverse()) {
    const action = [...(message.actionProposals ?? [])].reverse().find((candidate) => (
      candidate.toolName === "optimizeBudget"
      && candidate.payload.actionType === "budget_optimization_select"
      && !executedIds.has(candidate.actionId)
    ));
    if (action) return action;
  }

  return null;
}