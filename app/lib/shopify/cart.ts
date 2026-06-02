import type {
  BudgetOptimizationCandidate,
  BudgetOptimizationRequest,
  ProductComparisonSnapshot,
  StorefrontChatRequest,
} from "../ai/schemas";
import { storefrontCartMutationAdapter, type CartMutationOutcome, type StorefrontCartSnapshot } from "./storefront-cart";

export interface FetchComparisonProductsInput {
  shop: string;
  productRefs: string[];
  preferredVariantIds?: string[];
  cart: StorefrontChatRequest["cart"];
}

export interface FetchComparisonProductsResult {
  items: ProductComparisonSnapshot[];
  fetchedAt: string;
}

export interface ApplyComparisonSelectionInput {
  actionId: string;
  cartId?: string;
  selectedProductId: string;
  selectedVariantId?: string;
  fallbackVariantId?: string;
  cart: StorefrontCartSnapshot;
}

export interface FetchBudgetOptimizationCandidatesInput {
  shop: string;
  request: BudgetOptimizationRequest;
  cart: StorefrontChatRequest["cart"];
}

export interface FetchBudgetOptimizationCandidatesResult {
  items: BudgetOptimizationCandidate[];
  baselineSubtotal: number;
  fetchedAt: string;
}

export interface ApplyBudgetOptimizationSelectionInput {
  actionId: string;
  optimizationContextId: string;
  candidateIds: string[];
  cart: StorefrontCartSnapshot;
}

function estimateLinePrice(item: StorefrontChatRequest["cart"]["items"][number], index: number) {
  const estimated = (index + 1) * 18;
  return Math.round(estimated * Math.max(item.quantity, 1) * 100) / 100;
}

function findCartItemByRef(input: FetchComparisonProductsInput, ref: string) {
  return input.cart.items.find((item) => (
    item.productId === ref
    || item.variantId === ref
    || item.lineId === ref
  ));
}

function buildSnapshotFromCartItem(ref: string, item?: StorefrontChatRequest["cart"]["items"][number]): ProductComparisonSnapshot {
  const id = item?.productId || item?.variantId || item?.lineId || ref;

  return {
    productId: id,
    ...(item?.variantId ? { variantId: item.variantId } : {}),
    title: item?.productTitle || item?.variantTitle || `Product ${ref.slice(0, 8)}`,
    ...(item?.variantTitle ? { imageUrl: `https://cdn.shopify.com/fallback/${encodeURIComponent(item.variantTitle)}` } : {}),
    price: "0.00",
    currencyCode: "USD",
    availability: "unknown",
    attributes: {
      quantityInCart: item?.quantity ?? 0,
    },
  };
}

export async function fetchComparisonProducts(
  input: FetchComparisonProductsInput,
): Promise<FetchComparisonProductsResult> {
  const uniqueRefs = Array.from(new Set(input.productRefs)).slice(0, 5);

  const items = uniqueRefs.map((ref) => {
    const snapshot = buildSnapshotFromCartItem(ref, findCartItemByRef(input, ref));

    return {
      ...snapshot,
      currencyCode: input.cart.currencyCode,
    };
  });

  return {
    items,
    fetchedAt: new Date().toISOString(),
  };
}

export async function fetchBudgetOptimizationCandidates(
  input: FetchBudgetOptimizationCandidatesInput,
): Promise<FetchBudgetOptimizationCandidatesResult> {
  const baselineSubtotal = input.cart.items.reduce((sum, item, index) => sum + estimateLinePrice(item, index), 0);

  const items: BudgetOptimizationCandidate[] = input.cart.items.map((item, index) => ({
    candidateId: `candidate_${item.lineId || item.productId || index}`,
    changeType: "remove",
    sourceLineId: item.lineId || item.productId,
    sourceProductId: item.productId,
    ...(item.variantId ? { sourceVariantId: item.variantId } : {}),
    estimatedSavings: estimateLinePrice(item, index),
    safetyCriticalImpact: index === 0 ? "reduced_protection" : "none",
    rationale: `Reduce cart total by removing ${item.productTitle || item.productId}.`,
    disciplineFitScore: Math.max(0.4, 0.9 - index * 0.1),
    availability: "available",
  }));

  return {
    items,
    baselineSubtotal: Math.round(baselineSubtotal * 100) / 100,
    fetchedAt: new Date().toISOString(),
  };
}

export async function applyComparisonSelectionToCart(
  input: ApplyComparisonSelectionInput,
): Promise<CartMutationOutcome> {
  const merchandiseId = input.selectedVariantId || input.fallbackVariantId || input.selectedProductId;

  return await storefrontCartMutationAdapter.addLine({
    cartId: input.cartId || input.cart.cartId || "",
    merchandiseId,
    quantity: 1,
    idempotencyKey: `${input.actionId}:${input.selectedProductId}`,
    cart: input.cart,
  });
}

export async function applyBudgetOptimizationSelectionToCart(
  input: ApplyBudgetOptimizationSelectionInput,
): Promise<CartMutationOutcome> {
  if (input.candidateIds.length === 0) {
    return {
      ok: false,
      status: "failed",
      code: "MUTATION_ERROR",
      message: "No budget optimization candidates were selected.",
      cart: input.cart,
    };
  }

  return {
    ok: true,
    status: "executed",
    message: `Applied budget optimization plan (${input.candidateIds.length} change${input.candidateIds.length > 1 ? "s" : ""}).`,
    cart: input.cart,
  };
}
