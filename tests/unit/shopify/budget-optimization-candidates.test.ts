import { describe, expect, it } from "vitest";

import {
  applyBudgetOptimizationSelectionToCart,
  fetchBudgetOptimizationCandidates,
} from "../../../app/lib/shopify/cart";

describe("budget optimization candidate engine", () => {
  it("builds quantity-reduction candidates first for multi-quantity optional items", async () => {
    const result = await fetchBudgetOptimizationCandidates({
      shop: "test.myshopify.com",
      request: {
        requestId: "req-1",
        shop: "test.myshopify.com",
        sessionKey: "session-1",
        targetBudgetAmount: 50,
        currencyCode: "EUR",
        requestedAt: new Date().toISOString(),
      },
      cart: {
        cartId: "gid://shopify/Cart/123",
        currencyCode: "EUR",
        subtotal: "100",
        items: [
          {
            lineId: "line-optional",
            productId: "gid://shopify/Product/1",
            productTitle: "Training Towel",
            variantId: "gid://shopify/ProductVariant/1",
            quantity: 3,
          },
          {
            lineId: "line-essential",
            productId: "gid://shopify/Product/2",
            productTitle: "Headgear Protector",
            variantId: "gid://shopify/ProductVariant/2",
            quantity: 1,
          },
        ],
      },
    });

    expect(result.baselineSubtotal).toBe(100);

    const deferCandidates = result.items.filter((candidate) => (
      candidate.changeType === "defer" && candidate.sourceLineId === "line-optional"
    ));

    expect(deferCandidates.length).toBeGreaterThan(0);
    expect(deferCandidates.every((candidate) => candidate.safetyCriticalImpact === "none")).toBe(true);
  });

  it("applies defer by reducing quantity when line quantity is greater than one", async () => {
    const candidate = {
      candidateId: "candidate_line-optional_defer_1",
      changeType: "defer" as const,
      sourceLineId: "line-optional",
      sourceProductId: "gid://shopify/Product/1",
      sourceVariantId: "gid://shopify/ProductVariant/1",
      estimatedSavings: 20,
      safetyCriticalImpact: "none" as const,
      rationale: "Reduce quantity by 1.",
      disciplineFitScore: 0.6,
      availability: "available" as const,
    };

    const outcome = await applyBudgetOptimizationSelectionToCart({
      actionId: "action-1",
      optimizationContextId: "bgt_ctx_1",
      candidateIds: [candidate.candidateId],
      candidates: [candidate],
      cart: {
        cartId: "gid://shopify/Cart/123",
        currencyCode: "EUR",
        items: [
          {
            lineId: "line-optional",
            productId: "gid://shopify/Product/1",
            variantId: "gid://shopify/ProductVariant/1",
            quantity: 3,
          },
        ],
      },
    });

    expect(outcome.ok).toBe(true);
    expect(outcome.cart.items).toHaveLength(1);
    expect(outcome.cart.items[0]?.quantity).toBe(2);
  });

  it("applies remove by deleting the selected line", async () => {
    const candidate = {
      candidateId: "candidate_line-optional_remove_1",
      changeType: "remove" as const,
      sourceLineId: "line-optional",
      sourceProductId: "gid://shopify/Product/1",
      sourceVariantId: "gid://shopify/ProductVariant/1",
      estimatedSavings: 40,
      safetyCriticalImpact: "none" as const,
      rationale: "Remove optional product.",
      disciplineFitScore: 0.6,
      availability: "available" as const,
    };

    const outcome = await applyBudgetOptimizationSelectionToCart({
      actionId: "action-2",
      optimizationContextId: "bgt_ctx_2",
      candidateIds: [candidate.candidateId],
      candidates: [candidate],
      cart: {
        cartId: "gid://shopify/Cart/123",
        currencyCode: "EUR",
        items: [
          {
            lineId: "line-optional",
            productId: "gid://shopify/Product/1",
            variantId: "gid://shopify/ProductVariant/1",
            quantity: 1,
          },
        ],
      },
    });

    expect(outcome.ok).toBe(true);
    expect(outcome.cart.items).toHaveLength(0);
  });
});
