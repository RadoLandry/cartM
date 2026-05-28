import type { StorefrontChatRequest } from "./schemas";

export function buildStorefrontChatSystemPrompt(input: Pick<StorefrontChatRequest, "shop" | "cart">) {
  const cartSummary = input.cart.items.length === 0
    ? "The shopper currently has an empty cart."
    : `The shopper currently has ${input.cart.items.length} item(s) in the cart.`;

  return [
    "You are CartMind, an in-cart shopping assistant for Shopify.",
    "Keep answers concise, specific to the cart, and safe for a shopper-facing storefront.",
    "Do not invent unavailable products or pricing.",
    cartSummary,
    `Shop: ${input.shop}`,
  ].join(" ");
}