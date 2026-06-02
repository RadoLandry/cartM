import crypto from "node:crypto";

import type { CartToolAction, StorefrontChatRequest } from "./schemas";
import { createCartToolActionRecord, getCartToolActionRecord, isCartToolActionTerminalStatus } from "./storefront-chat";
import { issueActionConfirmationToken } from "../shopify/app-proxy";

function createActionId() {
  return crypto.randomUUID();
}

function inferToolFromMessage(input: StorefrontChatRequest): {
  toolName: CartToolAction["toolName"];
  payload: CartToolAction["payload"];
  preview?: CartToolAction["preview"];
} | null {
  const latest = input.messages[input.messages.length - 1]?.content.toLowerCase() ?? "";
  const firstLine = input.cart.items[0];

  if (latest.includes("add") || latest.includes("ajoute")) {
    return {
      toolName: "addToCart",
      payload: {
        actionType: "add",
        merchandiseId: firstLine?.variantId || firstLine?.productId || "",
        quantity: 1,
      },
      preview: {
        after: `Add 1 x ${firstLine?.productTitle || "selected item"}`,
      },
    };
  }

  if ((latest.includes("remove") || latest.includes("retire")) && firstLine) {
    return {
      toolName: "removeFromCart",
      payload: {
        actionType: "remove",
        lineId: firstLine.lineId || firstLine.productId,
      },
      preview: {
        before: firstLine.productTitle || "Existing cart item",
        after: "Item removed",
      },
    };
  }

  if ((latest.includes("quantity") || latest.includes("quantite")) && firstLine) {
    return {
      toolName: "changeQuantity",
      payload: {
        actionType: "change_quantity",
        lineId: firstLine.lineId || firstLine.productId,
        quantity: Math.max(1, firstLine.quantity + 1),
      },
      preview: {
        before: `${firstLine.productTitle || "Item"} x${firstLine.quantity}`,
        after: `${firstLine.productTitle || "Item"} x${Math.max(1, firstLine.quantity + 1)}`,
      },
    };
  }

  if ((latest.includes("swap") || latest.includes("replace")) && firstLine?.variantId) {
    const beforeLabel = `${firstLine.productTitle || "Item"}${firstLine.variantTitle ? ` / ${firstLine.variantTitle}` : ""}`;

    return {
      toolName: "swapVariant",
      payload: {
        actionType: "swap_variant",
        lineId: firstLine.lineId || firstLine.productId,
        newMerchandiseId: `${firstLine.variantId}-swap`,
        quantity: firstLine.quantity,
      },
      preview: {
        before: beforeLabel,
        after: `${beforeLabel} (requested variant)`,
      },
    };
  }

  return null;
}

export function buildCartToolActionProposal(input: StorefrontChatRequest): CartToolAction | null {
  const inferred = inferToolFromMessage(input);

  if (!inferred) {
    return null;
  }

  const actionId = createActionId();
  const token = issueActionConfirmationToken({
    actionId,
    shop: input.shop,
    sessionKey: input.sessionKey,
    cartId: input.cart.cartId,
  });

  const action: CartToolAction = {
    actionId,
    toolName: inferred.toolName,
    shop: input.shop,
    sessionKey: input.sessionKey,
    ...(input.cart.cartId ? { cartId: input.cart.cartId } : {}),
    payload: inferred.payload,
    ...(inferred.preview ? { preview: inferred.preview } : {}),
    confirmationToken: token.token,
    expiresAt: token.expiresAt,
  };

  createCartToolActionRecord({
    actionId,
    shop: action.shop,
    sessionKey: action.sessionKey,
    cartId: action.cartId,
    payload: action.payload,
  });

  return action;
}

export function resolveCartToolActionById(actionId: string) {
  const record = getCartToolActionRecord(actionId);

  if (!record) {
    return { ok: false as const, code: "ACTION_NOT_FOUND", message: "No matching cart action was found." };
  }

  return {
    ok: true as const,
    record,
    isTerminal: isCartToolActionTerminalStatus(record.status),
  };
}
