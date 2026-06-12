import crypto from "node:crypto";

import type {
  BudgetOptimizationRequest,
  BudgetOptimizationResult,
  CartToolAction,
  ProductComparisonRequest,
  ProductComparisonResult,
  StorefrontChatRequest,
} from "./schemas";
import { createCartToolActionRecord, getCartToolActionRecord, isCartToolActionTerminalStatus } from "./storefront-chat";
import { issueActionConfirmationToken } from "../shopify/app-proxy";

function createActionId() {
  return crypto.randomUUID();
}

function createComparisonRequestId() {
  return crypto.randomUUID();
}

function createBudgetOptimizationRequestId() {
  return crypto.randomUUID();
}

export function createComparisonContextId(requestId: string) {
  return `cmp_${requestId}`;
}

export function createBudgetOptimizationContextId(requestId: string) {
  return `bgt_${requestId}`;
}

function parseBudgetAmountFromMessage(content: string) {
  const normalized = content.replace(/,/g, "");
  const amountMatch = normalized.match(/(?:\$|€|£)?\s*(\d+(?:\.\d{1,2})?)/);

  if (!amountMatch) {
    return null;
  }

  const amount = Number(amountMatch[1]);
  if (!Number.isFinite(amount) || amount <= 0) {
    return null;
  }

  return amount;
}

function normalizeText(content: string) {
  return content
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function parseFirstInteger(content: string) {
  const match = content.match(/\b(\d{1,3})\b/);
  if (!match) {
    return null;
  }

  const value = Number(match[1]);
  return Number.isFinite(value) ? value : null;
}

function resolveTargetLine(input: StorefrontChatRequest, normalizedMessage: string) {
  const withLineId = input.cart.items.filter((item) => item.lineId || item.productId);

  for (const item of withLineId) {
    const candidates = [
      item.productTitle,
      item.variantTitle,
      item.productId,
      item.variantId,
    ].filter((value): value is string => Boolean(value));

    if (candidates.some((candidate) => normalizedMessage.includes(normalizeText(candidate)))) {
      return item;
    }
  }

  return withLineId[0];
}

function resolveAddMerchandiseId(input: StorefrontChatRequest, normalizedMessage: string) {
  const gidMatch = normalizedMessage.match(/gid:\/\/shopify\/productvariant\/\d+/i);
  if (gidMatch) {
    return gidMatch[0];
  }

  const target = resolveTargetLine(input, normalizedMessage) ?? input.cart.items[0];
  return target?.variantId;
}

function parseRequestedVariantId(rawMessage: string) {
  const gidMatch = rawMessage.match(/gid:\/\/shopify\/ProductVariant\/[A-Za-z0-9_-]+/i);
  if (!gidMatch) {
    return null;
  }

  return gidMatch[0];
}

function inferToolFromMessage(input: StorefrontChatRequest): {
  toolName: CartToolAction["toolName"];
  payload: CartToolAction["payload"];
  preview?: CartToolAction["preview"];
} | null {
  const latest = input.messages[input.messages.length - 1]?.content ?? "";
  const normalized = normalizeText(latest);
  const targetLine = resolveTargetLine(input, normalized);

  if (/\b(add|ajoute|insert|include)\b/.test(normalized)) {
    const merchandiseId = resolveAddMerchandiseId(input, normalized);

    if (!merchandiseId) {
      return null;
    }

    const requestedQuantity = parseFirstInteger(normalized);
    const quantity = Math.max(1, requestedQuantity ?? 1);

    return {
      toolName: "addToCart",
      payload: {
        actionType: "add",
        merchandiseId,
        quantity,
      },
      preview: {
        after: `Add ${quantity} x ${targetLine?.productTitle || "selected item"}`,
      },
    };
  }

  if (/\b(remove|retire|delete|supprime)\b/.test(normalized) && targetLine) {
    return {
      toolName: "removeFromCart",
      payload: {
        actionType: "remove",
        lineId: targetLine.lineId || targetLine.productId,
      },
      preview: {
        before: targetLine.productTitle || "Existing cart item",
        after: "Item removed",
      },
    };
  }

  if (/\b(quantity|quantite|increase|decrease|more|less)\b/.test(normalized) && targetLine) {
    const explicitQuantity = parseFirstInteger(normalized);
    const increaseIntent = /\b(increase|more|plus|up)\b/.test(normalized);
    const decreaseIntent = /\b(decrease|less|minus|reduce|down|moins)\b/.test(normalized);

    const quantity = explicitQuantity
      ? explicitQuantity
      : increaseIntent
        ? targetLine.quantity + 1
        : decreaseIntent
          ? targetLine.quantity - 1
          : targetLine.quantity + 1;

    return {
      toolName: "changeQuantity",
      payload: {
        actionType: "change_quantity",
        lineId: targetLine.lineId || targetLine.productId,
        quantity: Math.max(1, quantity),
      },
      preview: {
        before: `${targetLine.productTitle || "Item"} x${targetLine.quantity}`,
        after: `${targetLine.productTitle || "Item"} x${Math.max(1, quantity)}`,
      },
    };
  }

  if (/\b(swap|replace)\b/.test(normalized) && targetLine?.variantId) {
    const beforeLabel = `${targetLine.productTitle || "Item"}${targetLine.variantTitle ? ` / ${targetLine.variantTitle}` : ""}`;
    const requestedVariantId = parseRequestedVariantId(latest);
    const nextVariantId = requestedVariantId || `${targetLine.variantId}-swap`;

    return {
      toolName: "swapVariant",
      payload: {
        actionType: "swap_variant",
        lineId: targetLine.lineId || targetLine.productId,
        newMerchandiseId: nextVariantId,
        quantity: targetLine.quantity,
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

export function buildComparisonSelectionActionProposal(input: {
  shop: string;
  sessionKey: string;
  cartId?: string;
  comparison: ProductComparisonResult;
}): CartToolAction | null {
  const recommendedProduct = input.comparison.products.find((product) => (
    product.productId === input.comparison.recommendation?.recommendedProductId
  )) || input.comparison.products[0];

  if (!recommendedProduct) {
    return null;
  }

  const alternatives = input.comparison.products
    .filter((product) => product.productId !== recommendedProduct.productId)
    .map((product) => ({
      productId: product.productId,
      ...(product.variantId ? { variantId: product.variantId } : {}),
      title: product.title,
    }));

  const actionId = createActionId();
  const token = issueActionConfirmationToken({
    actionId,
    shop: input.shop,
    sessionKey: input.sessionKey,
    cartId: input.cartId,
  });

  const action: CartToolAction = {
    actionId,
    toolName: "compareProducts",
    shop: input.shop,
    sessionKey: input.sessionKey,
    ...(input.cartId ? { cartId: input.cartId } : {}),
    payload: {
      actionType: "comparison_select",
      comparisonContextId: input.comparison.comparisonContextId,
      recommended: {
        productId: recommendedProduct.productId,
        ...(recommendedProduct.variantId ? { variantId: recommendedProduct.variantId } : {}),
        title: recommendedProduct.title,
      },
      alternatives,
    },
    preview: {
      after: `Choose a product from comparison ${input.comparison.comparisonContextId}`,
    },
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

export function buildBudgetOptimizationSelectionActionProposal(input: {
  shop: string;
  sessionKey: string;
  cartId?: string;
  optimization: BudgetOptimizationResult;
}): CartToolAction | null {
  if (input.optimization.candidates.length === 0) {
    return null;
  }

  const actionId = createActionId();
  const token = issueActionConfirmationToken({
    actionId,
    shop: input.shop,
    sessionKey: input.sessionKey,
    cartId: input.cartId,
  });

  const action: CartToolAction = {
    actionId,
    toolName: "optimizeBudget",
    shop: input.shop,
    sessionKey: input.sessionKey,
    ...(input.cartId ? { cartId: input.cartId } : {}),
    payload: {
      actionType: "budget_optimization_select",
      optimizationContextId: input.optimization.optimizationContextId,
      candidateIds: input.optimization.candidates.map((candidate) => candidate.candidateId),
      projectedSubtotal: input.optimization.projectedSubtotal,
      projectedGapAmount: input.optimization.projectedGapAmount,
    },
    preview: {
      after: `Apply budget plan (${input.optimization.candidates.length} change${input.optimization.candidates.length > 1 ? "s" : ""})`,
    },
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

export function buildCompareProductsToolRequest(input: StorefrontChatRequest): ProductComparisonRequest | null {
  const latest = input.messages[input.messages.length - 1]?.content.toLowerCase() ?? "";

  if (!latest.includes("compare")) {
    return null;
  }

  const allRefs = input.cart.items
    .map((item) => item.productId || item.variantId)
    .filter((ref): ref is string => typeof ref === "string" && ref.length > 0);

  const productRefs = Array.from(new Set(allRefs)).slice(0, 5);

  if (productRefs.length < 2 || allRefs.length === 0) {
    return null;
  }

  return {
    requestId: createComparisonRequestId(),
    shop: input.shop,
    sessionKey: input.sessionKey,
    productRefs,
    dimensions: ["price", "availability", "key_specs", "tradeoffs"],
    requestedAt: new Date().toISOString(),
  };
}

export function getCompareProductsValidationError(input: StorefrontChatRequest) {
  const latest = input.messages[input.messages.length - 1]?.content.toLowerCase() ?? "";

  if (!latest.includes("compare")) {
    return null;
  }

  const allRefs = input.cart.items
    .map((item) => item.productId || item.variantId)
    .filter((ref): ref is string => typeof ref === "string" && ref.length > 0);
  const uniqueRefs = Array.from(new Set(allRefs));

  if (uniqueRefs.length < 2) {
    const code: "DUPLICATE_PRODUCTS" | "INSUFFICIENT_PRODUCTS" = allRefs.length > uniqueRefs.length
      ? "DUPLICATE_PRODUCTS"
      : "INSUFFICIENT_PRODUCTS";

    return {
      code,
      message: allRefs.length > uniqueRefs.length
        ? "Please choose two different products for comparison."
        : "Please add at least two products before asking for a comparison.",
      suggestedNextStep: allRefs.length > uniqueRefs.length
        ? "Select another product from your cart and compare again."
        : "Add one more product to your cart, then ask CartMind to compare.",
    };
  }

  return null;
}

export function buildBudgetOptimizationToolRequest(input: StorefrontChatRequest): BudgetOptimizationRequest | null {
  const latest = input.messages[input.messages.length - 1]?.content.toLowerCase() ?? "";

  if (!latest.includes("budget") && !latest.includes("optimiz")) {
    return null;
  }

  const targetBudgetAmount = parseBudgetAmountFromMessage(latest);
  if (!targetBudgetAmount) {
    return null;
  }

  return {
    requestId: createBudgetOptimizationRequestId(),
    shop: input.shop,
    sessionKey: input.sessionKey,
    targetBudgetAmount,
    currencyCode: input.cart.currencyCode,
    requestedAt: new Date().toISOString(),
  };
}

export function getBudgetOptimizationValidationError(input: StorefrontChatRequest) {
  const latest = input.messages[input.messages.length - 1]?.content.toLowerCase() ?? "";

  if (!latest.includes("budget") && !latest.includes("optimiz")) {
    return null;
  }

  if (input.cart.items.length === 0) {
    return {
      code: "EMPTY_CART" as const,
      message: "Add at least one product before asking for budget optimization.",
      suggestedNextStep: "Add products to your cart, then share your target budget.",
    };
  }

  const parsedBudget = parseBudgetAmountFromMessage(latest);
  if (!parsedBudget) {
    return {
      code: "INVALID_TARGET_BUDGET" as const,
      message: "Please provide a target budget amount, for example: optimize this cart for $120.",
      suggestedNextStep: "Include a numeric budget amount and retry.",
    };
  }

  return null;
}
