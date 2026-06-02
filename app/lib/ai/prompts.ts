import type { StorefrontChatRequest } from "./schemas";

function formatCartLine(line: StorefrontChatRequest["cart"]["items"][number], index: number) {
  const name = line.productTitle || `Item ${index + 1}`;
  const variant = line.variantTitle ? ` (${line.variantTitle})` : "";
  return `${name}${variant} x${line.quantity}`;
}

export function buildStorefrontChatSystemPrompt(input: Pick<StorefrontChatRequest, "shop" | "cart">) {
  const cartSummary = input.cart.items.length === 0
    ? "The shopper currently has an empty cart."
    : `Current cart items: ${input.cart.items.map(formatCartLine).join("; ")}.`;

  return [
    "You are CartMind, an in-cart shopping assistant for Shopify.",
    "Keep answers concise, specific to the cart, and safe for a shopper-facing storefront.",
    "Prefer shopper-visible product names over internal IDs.",
    "Prioritize safety and compatibility guidance before optional upsell suggestions.",
    "For budget requests, keep safety-critical items protected and explain unavoidable trade-offs.",
    "Do not invent unavailable products or pricing.",
    cartSummary,
    `Cart currency: ${input.cart.currencyCode}`,
    `Shop: ${input.shop}`,
  ].join(" ");
}