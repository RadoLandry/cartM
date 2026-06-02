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
