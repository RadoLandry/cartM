import { describe, expect, it } from "vitest";

import { buildStorefrontChatSystemPrompt } from "../../../app/lib/ai/prompts";

describe("prompt safety precedence", () => {
  it("prioritizes safety over upsell when safety-first mode is active", () => {
    const prompt = buildStorefrontChatSystemPrompt({
      shop: "test.myshopify.com",
      cart: {
        cartId: "gid://shopify/Cart/123",
        currencyCode: "USD",
        items: [
          {
            productId: "gid://shopify/Product/1",
            productTitle: "Core Training Gloves",
            variantId: "gid://shopify/ProductVariant/11",
            variantTitle: "12 oz / Black",
            quantity: 1,
          },
        ],
      },
      behavior: {
        tone: "PROFESSIONAL",
        aggressiveness: 0.9,
        safetyPriority: "SAFETY_FIRST",
        customGuidance: "Always prioritize protection before any add-on.",
        conversationStarters: [],
      },
    });

    expect(prompt).toContain("Safety mode: safety-first");
    expect(prompt).toContain("Upsell aggressiveness: 0.6");
  });

  it("preserves configured aggressiveness in balanced mode", () => {
    const prompt = buildStorefrontChatSystemPrompt({
      shop: "test.myshopify.com",
      cart: {
        cartId: "gid://shopify/Cart/123",
        currencyCode: "USD",
        items: [],
      },
      behavior: {
        tone: "FRIENDLY",
        aggressiveness: 0.8,
        safetyPriority: "BALANCED",
        customGuidance: "Offer alternatives when relevant.",
        conversationStarters: [],
      },
    });

    expect(prompt).toContain("Safety mode: balanced");
    expect(prompt).toContain("Upsell aggressiveness: 0.8");
  });
});
