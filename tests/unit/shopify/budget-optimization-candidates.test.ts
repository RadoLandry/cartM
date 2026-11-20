import { describe, expect, it } from "vitest";
import { buildBudgetOptimizationProposal } from "../../../app/lib/cart-intelligence/budget-optimization";

import {
  applyBudgetOptimizationSelectionToCart,
  fetchBudgetOptimizationCandidates,
} from "../../../app/lib/shopify/cart";

describe("budget optimization candidate engine", () => {
  it.each([
    { title: "missing", price: undefined, subtotal: "60" },
    { title: "inconsistent discount", price: 60, subtotal: "50" },
  ])("refuses $title prices instead of estimating them", async ({ price, subtotal }) => {
    const result = await fetchBudgetOptimizationCandidates({
      shop: "test.myshopify.com",
      request: { requestId: "missing", shop: "test.myshopify.com", sessionKey: "session", targetBudgetAmount: 40, currencyCode: "EUR", requestedAt: new Date().toISOString() },
      cart: { currencyCode: "EUR", subtotal, items: [{ lineId: "shirt", productId: "shirt", productTitle: "Rashguard", quantity: 2, finalLinePrice: price }] },
    });
    expect(result.pricingUnavailable).toBe(true);
    expect(result.items).toEqual([]);
  });

  it.each(["Bandes de boxe", "Gants de boxe", "Protection dans un sac", "Unknown equipment"])("never proposes reducing %s", async (productTitle) => {
    const result = await fetchBudgetOptimizationCandidates({
      shop: "test.myshopify.com",
      request: { requestId: "protection", shop: "test.myshopify.com", sessionKey: "session", targetBudgetAmount: 10, currencyCode: "EUR", requestedAt: new Date().toISOString() },
      cart: { currencyCode: "EUR", subtotal: "60", items: [{ lineId: "protected", productId: "protected", productTitle, quantity: 2, finalLinePrice: 60 }] },
    });
    expect(result.pricingUnavailable).not.toBe(true);
    expect(result.items).toEqual([]);
  });

  it("reduces one rashguard using real discounted prices while preserving wraps and gloves", async () => {
    const cart = {
      currencyCode: "EUR",
      subtotal: "114.99",
      items: [
        { lineId: "wraps", productId: "wraps", productTitle: "Bandes de Boxe Venum Kontact Evo Classic - Khaki", quantity: 1, finalLinePrice: 14.99 },
        { lineId: "rashguard", productId: "rashguard", productTitle: "Rashguard À Manches Longues pour Hommes Venum Tempest", quantity: 2, finalLinePrice: 60 },
        { lineId: "gloves", productId: "gloves", productTitle: "Gants de boxe Venum Contender 1.5 XT pour enfants", quantity: 1, finalLinePrice: 40 },
      ],
    };
    const fetched = await fetchBudgetOptimizationCandidates({
      shop: "test.myshopify.com",
      request: { requestId: "real-prices", shop: "test.myshopify.com", sessionKey: "session", targetBudgetAmount: 100, currencyCode: "EUR", requestedAt: new Date().toISOString() },
      cart,
    });
    const result = buildBudgetOptimizationProposal({
      optimizationContextId: "real-prices", requestId: "real-prices", targetBudgetAmount: 100,
      baselineSubtotal: fetched.baselineSubtotal, candidates: fetched.items, fetchedAt: fetched.fetchedAt,
    });
    expect(result.projectedSubtotal).toBe(84.99);
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0]).toMatchObject({ sourceLineId: "rashguard", changeType: "defer", estimatedSavings: 30, safetyCriticalImpact: "none" });
  });

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
            finalLinePrice: 60,
            variantId: "gid://shopify/ProductVariant/1",
            quantity: 3,
          },
          {
            lineId: "line-essential",
            productId: "gid://shopify/Product/2",
            productTitle: "Headgear Protector",
            finalLinePrice: 40,
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
