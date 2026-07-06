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
  candidates: BudgetOptimizationCandidate[];
  cart: StorefrontCartSnapshot;
}

export interface ColorwayPreviewLineResolutionInput {
  selectedLineId: string;
  proposedVariantId: string;
  availableVariantIds?: string[];
  cart: {
    currencyCode: string;
    items: Array<{
      lineId?: string;
      productId?: string;
      variantId?: string;
      productTitle?: string;
      variantTitle?: string;
      quantity?: number;
    }>;
  };
}

export interface ColorwayPreviewLineResolutionResult {
  valid: boolean;
  reason?: "line_not_found" | "same_variant" | "missing_variant" | "unavailable_variant";
  selectedLine?: ColorwayPreviewLineResolutionInput["cart"]["items"][number];
}

function estimateLinePrice(item: StorefrontChatRequest["cart"]["items"][number], index: number) {
  const estimated = (index + 1) * 18;
  return Math.round(estimated * Math.max(item.quantity, 1) * 100) / 100;
}

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100;
}

function parseCartSubtotal(subtotal?: string) {
  if (!subtotal) {
    return null;
  }

  const compact = subtotal
    .replace(/[\u00A0\u202F\s']/g, "")
    .replace(/[^0-9.,]/g, "");

  if (!compact) {
    return null;
  }

  let normalized = compact;
  const hasComma = compact.includes(",");
  const hasDot = compact.includes(".");

  if (hasComma && hasDot) {
    const lastComma = compact.lastIndexOf(",");
    const lastDot = compact.lastIndexOf(".");
    normalized = lastComma > lastDot
      ? compact.replace(/\./g, "").replace(/,/g, ".")
      : compact.replace(/,/g, "");
  } else if (hasComma) {
    const parts = compact.split(",");
    normalized = parts.length === 2 && parts[1].length === 3
      ? parts.join("")
      : compact.replace(/,/g, ".");
  }

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return roundCurrency(parsed);
}

function normalizeKeywordValue(input?: string) {
  if (!input) {
    return "";
  }

  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function assessLineUsefulness(item: StorefrontChatRequest["cart"]["items"][number]) {
  const text = normalizeKeywordValue(`${item.productTitle || ""} ${item.variantTitle || ""}`);
  const safetyCriticalKeywords = [
    "glove",
    "gant",
    "headgear",
    "helmet",
    "mouthguard",
    "prot",
    "protect",
    "guard",
    "shin",
    "coquille",
    "wrap",
    "bandage",
  ];
  const nonEssentialKeywords = [
    "bag",
    "sac",
    "towel",
    "serviette",
    "sticker",
    "keychain",
    "poster",
    "cap",
    "casquette",
    "bottle",
    "accessory",
    "accessoire",
  ];

  const hasSafetySignal = safetyCriticalKeywords.some((keyword) => text.includes(keyword));
  const hasNonEssentialSignal = nonEssentialKeywords.some((keyword) => text.includes(keyword));

  if (hasSafetySignal && !hasNonEssentialSignal) {
    return {
      priority: "essential" as const,
      safetyCriticalImpact: "reduced_protection" as const,
      disciplineFitScore: 0.9,
    };
  }

  if (hasNonEssentialSignal) {
    return {
      priority: "optional" as const,
      safetyCriticalImpact: "none" as const,
      disciplineFitScore: 0.45,
    };
  }

  return {
    priority: "neutral" as const,
    safetyCriticalImpact: "none" as const,
    disciplineFitScore: 0.65,
  };
}

function buildHeuristicLineUnitPrice(item: StorefrontChatRequest["cart"]["items"][number]) {
  const usefulness = assessLineUsefulness(item);

  if (usefulness.priority === "essential") {
    return 34;
  }

  if (usefulness.priority === "optional") {
    return 16;
  }

  return 24;
}

function findCartItemByRef(input: FetchComparisonProductsInput, ref: string) {
  return input.cart.items.find((item) => (
    item.productId === ref
    || item.variantId === ref
    || item.lineId === ref
  ));
}

export function resolveColorwayPreviewLine(
  input: ColorwayPreviewLineResolutionInput,
): ColorwayPreviewLineResolutionResult {
  const selectedLine = input.cart.items.find((item) => item.lineId === input.selectedLineId);

  if (!selectedLine) {
    return {
      valid: false,
      reason: "line_not_found",
    };
  }

  if (!selectedLine.variantId) {
    return {
      valid: false,
      reason: "missing_variant",
      selectedLine,
    };
  }

  if (selectedLine.variantId === input.proposedVariantId) {
    return {
      valid: false,
      reason: "same_variant",
      selectedLine,
    };
  }

  if (
    input.availableVariantIds
    && input.availableVariantIds.length > 0
    && !input.availableVariantIds.includes(input.proposedVariantId)
  ) {
    return {
      valid: false,
      reason: "unavailable_variant",
      selectedLine,
    };
  }

  return {
    valid: true,
    selectedLine,
  };
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
  const heuristicBaselineSubtotal = input.cart.items.reduce((sum, item, index) => sum + estimateLinePrice(item, index), 0);
  const parsedSubtotal = parseCartSubtotal(input.cart.subtotal);
  const baselineSubtotal = parsedSubtotal ?? heuristicBaselineSubtotal;
  const scale = heuristicBaselineSubtotal > 0
    ? baselineSubtotal / heuristicBaselineSubtotal
    : 1;

  const items: BudgetOptimizationCandidate[] = [];

  for (const [index, item] of input.cart.items.entries()) {
    const sourceLineId = item.lineId || item.productId;
    const quantity = Math.max(1, item.quantity);
    const usefulness = assessLineUsefulness(item);
    const estimatedUnitSavings = roundCurrency((buildHeuristicLineUnitPrice(item) * scale));
    const estimatedLineSavings = roundCurrency(estimatedUnitSavings * quantity);
    const title = item.productTitle || item.productId;

    if (quantity > 1) {
      const adjustableUnits = quantity - 1;
      for (let unitIndex = 0; unitIndex < adjustableUnits; unitIndex += 1) {
        items.push({
          candidateId: `candidate_${sourceLineId}_defer_${unitIndex + 1}`,
          changeType: "defer",
          sourceLineId,
          sourceProductId: item.productId,
          ...(item.variantId ? { sourceVariantId: item.variantId } : {}),
          estimatedSavings: estimatedUnitSavings,
          safetyCriticalImpact: usefulness.safetyCriticalImpact,
          rationale: `Reduce quantity of ${title} by 1 to lower total with minimal impact.`,
          disciplineFitScore: usefulness.disciplineFitScore,
          availability: "available",
        });
      }
    }

    if (usefulness.priority === "optional" || quantity === 1) {
      items.push({
        candidateId: `candidate_${sourceLineId}_remove_${index}`,
        changeType: "remove",
        sourceLineId,
        sourceProductId: item.productId,
        ...(item.variantId ? { sourceVariantId: item.variantId } : {}),
        estimatedSavings: estimatedLineSavings,
        safetyCriticalImpact: usefulness.safetyCriticalImpact,
        rationale: usefulness.priority === "optional"
          ? `Remove non-essential item ${title} to unlock the largest budget reduction first.`
          : `Remove ${title} if needed to reach the requested budget target.`,
        disciplineFitScore: usefulness.disciplineFitScore,
        availability: "available",
      });
    }
  }

  return {
    items,
    baselineSubtotal: roundCurrency(baselineSubtotal),
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
  if (input.candidateIds.length === 0 || input.candidates.length === 0) {
    return {
      ok: false,
      status: "failed",
      code: "MUTATION_ERROR",
      message: "No budget optimization candidates were selected.",
      cart: input.cart,
    };
  }

  const initialCart = input.cart;
  let nextCart = initialCart;

  for (const candidate of input.candidates) {
    if (candidate.availability === "unavailable") {
      return {
        ok: false,
        status: "failed",
        code: "VARIANT_UNAVAILABLE",
        message: `Candidate ${candidate.candidateId} is no longer available.`,
        cart: initialCart,
      };
    }

    if (!candidate.sourceLineId) {
      return {
        ok: false,
        status: "failed",
        code: "LINE_NOT_FOUND",
        message: `Candidate ${candidate.candidateId} has no source cart line.`,
        cart: initialCart,
      };
    }

    if (candidate.changeType === "defer") {
      const currentLine = nextCart.items.find((line) => line.lineId === candidate.sourceLineId);

      if (!currentLine) {
        return {
          ok: false,
          status: "failed",
          code: "LINE_NOT_FOUND",
          message: `Candidate ${candidate.candidateId} references a missing cart line.`,
          cart: initialCart,
        };
      }

      if (currentLine.quantity > 1) {
        const outcome = await storefrontCartMutationAdapter.updateLineQuantity({
          cartId: nextCart.cartId || initialCart.cartId || "",
          lineId: candidate.sourceLineId,
          quantity: currentLine.quantity - 1,
          idempotencyKey: `${input.actionId}:${candidate.candidateId}:defer`,
          cart: nextCart,
        });

        if (!outcome.ok) {
          return {
            ok: false,
            status: "failed",
            code: outcome.code || "MUTATION_ERROR",
            message: outcome.message,
            cart: initialCart,
          };
        }

        nextCart = outcome.cart;
        continue;
      }
    }

    if (candidate.changeType === "remove" || candidate.changeType === "defer") {
      const outcome = await storefrontCartMutationAdapter.removeLine({
        cartId: nextCart.cartId || initialCart.cartId || "",
        lineId: candidate.sourceLineId,
        idempotencyKey: `${input.actionId}:${candidate.candidateId}:remove`,
        cart: nextCart,
      });

      if (!outcome.ok) {
        return {
          ok: false,
          status: "failed",
          code: outcome.code || "MUTATION_ERROR",
          message: outcome.message,
          cart: initialCart,
        };
      }

      nextCart = outcome.cart;
      continue;
    }

    if (candidate.changeType === "swap" || candidate.changeType === "downgrade") {
      const currentLine = nextCart.items.find((line) => line.lineId === candidate.sourceLineId);
      const targetVariantId = candidate.targetVariantId;

      if (!currentLine || !targetVariantId) {
        return {
          ok: false,
          status: "failed",
          code: "VARIANT_UNAVAILABLE",
          message: `Candidate ${candidate.candidateId} is missing swap details.`,
          cart: initialCart,
        };
      }

      const outcome = await storefrontCartMutationAdapter.swapLineVariant({
        cartId: nextCart.cartId || initialCart.cartId || "",
        lineId: candidate.sourceLineId,
        newMerchandiseId: targetVariantId,
        quantity: Math.max(1, currentLine.quantity),
        idempotencyKey: `${input.actionId}:${candidate.candidateId}:swap`,
        cart: nextCart,
      });

      if (!outcome.ok) {
        return {
          ok: false,
          status: "failed",
          code: outcome.code || "MUTATION_ERROR",
          message: outcome.message,
          cart: initialCart,
        };
      }

      nextCart = outcome.cart;
      continue;
    }
  }

  return {
    ok: true,
    status: "executed",
    message: `Applied budget optimization plan (${input.candidateIds.length} change${input.candidateIds.length > 1 ? "s" : ""}).`,
    cart: nextCart,
  };
}
