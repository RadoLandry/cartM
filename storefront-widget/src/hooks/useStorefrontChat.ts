import type { CartToolAction } from "../types";
import type { ChatSessionAction, ChatSessionState } from "./useChatSessionState";
import { buildCartSnapshotKey, normalizeCartJsPayload } from "./useCartStateSync";
import type { StorefrontCartSnapshot } from "../types";

export function normalizeAjaxMerchandiseId(value: string) {
  return value.trim().replace(/^gid:\/\/shopify\/ProductVariant\//, "");
}

async function refreshCart(currentCart: StorefrontCartSnapshot, fetchImpl: typeof fetch) {
  const response = await fetchImpl("/cart.js", { method: "GET", credentials: "same-origin" });
  if (!response.ok) throw new Error(`Shopify cart refresh failed (${response.status}).`);
  const payload = await response.json();
  if (!Array.isArray(payload?.items)) throw new Error("Shopify returned an invalid cart.");
  return normalizeCartJsPayload(payload, currentCart);
}

export async function applyStorefrontCartAction(
  action: CartToolAction,
  currentCart: StorefrontCartSnapshot,
  fetchImpl: typeof fetch = fetch,
) {
  const payload = action.payload;
  const mutate: typeof fetch = async (request, options) => {
    const response = await fetchImpl(request, options);
    if (!response.ok) throw new Error(`Shopify cart mutation failed (${response.status}).`);
    return response;
  };

  if (payload.actionType === "add") {
    await mutate("/cart/add.js", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: normalizeAjaxMerchandiseId(payload.merchandiseId), quantity: payload.quantity }),
    });
  } else if (payload.actionType === "budget_optimization_select") {
    if (!payload.changes?.length || !payload.baselineCart || buildCartSnapshotKey(currentCart) !== buildCartSnapshotKey(payload.baselineCart)) {
      throw new Error("The cart changed. Request a new budget plan.");
    }
    await mutate("/cart/update.js", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ updates: Object.fromEntries(payload.changes.map((change) => [change.lineId, change.quantity])) }),
    });
  } else if (payload.actionType === "remove") {
    await mutate("/cart/change.js", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: payload.lineId, quantity: 0 }),
    });
  } else if (payload.actionType === "change_quantity") {
    const changes = payload.changes ?? [{ lineId: payload.lineId, quantity: payload.quantity }];
    for (const change of changes) {
      await mutate("/cart/change.js", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: change.lineId, quantity: change.quantity }),
      });
    }
  } else if (payload.actionType === "swap_variant") {
    const currentLine = currentCart.items.find((item) => item.lineId === payload.lineId);
    if (!currentLine?.variantId || (payload.quantity != null && currentLine.quantity !== payload.quantity)) {
      throw new Error("The swap target changed. Request a new proposal.");
    }
    await mutate("/cart/change.js", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: payload.lineId, quantity: 0 }),
    });
    try {
      await mutate("/cart/add.js", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: normalizeAjaxMerchandiseId(payload.newMerchandiseId), quantity: payload.quantity ?? currentLine.quantity }),
      });
    } catch (error) {
      await mutate("/cart/add.js", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: normalizeAjaxMerchandiseId(currentLine.variantId), quantity: currentLine.quantity }),
      }).catch(() => undefined);
      throw error;
    }
  } else {
    throw new Error("Unsupported Shopify cart action.");
  }

  const nextCart = await refreshCart(currentCart, fetchImpl);
  const variantQuantity = (cart: StorefrontCartSnapshot, variantId: string) => cart.items
    .filter((item) => normalizeAjaxMerchandiseId(item.variantId || "") === normalizeAjaxMerchandiseId(variantId))
    .reduce((total, item) => total + item.quantity, 0);
  let verified = false;
  if (payload.actionType === "swap_variant") {
    verified = !nextCart.items.some((item) => item.lineId === payload.lineId)
      && variantQuantity(nextCart, payload.newMerchandiseId)
        === variantQuantity(currentCart, payload.newMerchandiseId)
          + (payload.quantity ?? currentCart.items.find((item) => item.lineId === payload.lineId)?.quantity ?? 0);
  } else if (payload.actionType === "add") {
    verified = variantQuantity(nextCart, payload.merchandiseId)
      === variantQuantity(currentCart, payload.merchandiseId) + payload.quantity;
  } else if (payload.actionType === "remove") {
    verified = !nextCart.items.some((item) => item.lineId === payload.lineId);
  } else if (payload.actionType === "budget_optimization_select") {
    verified = Boolean(payload.changes?.every((change) => (nextCart.items.find((item) => item.lineId === change.lineId)?.quantity || 0) === change.quantity))
      && currentCart.items.filter((item) => !payload.changes?.some((change) => change.lineId === item.lineId))
        .every((item) => nextCart.items.some((next) => next.lineId === item.lineId && next.quantity === item.quantity && next.variantId === item.variantId))
      && nextCart.subtotal !== undefined;
  } else if (payload.actionType === "change_quantity") {
    verified = (payload.changes ?? [payload]).every((change) =>
      (nextCart.items.find((item) => item.lineId === change.lineId)?.quantity || 0) === change.quantity);
  }
  if (!verified) throw new Error("Shopify cart verification failed. Refresh before requesting another change.");
  return nextCart;
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

/** Candidate ids still applied after any per-candidate accept/decline decisions for this optimization context. */
export function resolveBudgetOptimizationSelectedCandidateIds(
  block: { candidates: Array<{ candidateId: string }> },
  state: Pick<ChatSessionState, "budgetOptimizationDecisions">,
  optimizationContextId: string,
): string[] {
  const declined = new Set(state.budgetOptimizationDecisions[optimizationContextId] ?? []);
  return block.candidates
    .map((candidate) => candidate.candidateId)
    .filter((candidateId) => !declined.has(candidateId));
}

/** Builds the dispatchable action for a shopper accepting/declining one proposed budget optimization candidate. */
export function buildBudgetOptimizationCandidateDecisionAction(input: {
  optimizationContextId: string;
  candidateId: string;
  accepted: boolean;
}): ChatSessionAction {
  return {
    type: "budget_candidate_decision",
    optimizationContextId: input.optimizationContextId,
    candidateId: input.candidateId,
    accepted: input.accepted,
  };
}