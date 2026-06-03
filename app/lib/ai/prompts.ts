import type { StorefrontChatRequest } from "./schemas";
import {
  AI_BEHAVIOR_DEFAULTS,
  resolveBehaviorPolicyConflict,
  type AIBehaviorDraftPayload,
} from "./behavior-config";

function formatCartLine(line: StorefrontChatRequest["cart"]["items"][number], index: number) {
  const name = line.productTitle || `Item ${index + 1}`;
  const variant = line.variantTitle ? ` (${line.variantTitle})` : "";
  return `${name}${variant} x${line.quantity}`;
}

export function buildStorefrontChatSystemPrompt(input: Pick<StorefrontChatRequest, "shop" | "cart"> & {
  behavior?: AIBehaviorDraftPayload;
}) {
  const behavior = resolveBehaviorPolicyConflict({
    tone: AI_BEHAVIOR_DEFAULTS.tone,
    aggressiveness: AI_BEHAVIOR_DEFAULTS.aggressiveness,
    safetyPriority: AI_BEHAVIOR_DEFAULTS.safetyPriority,
    customGuidance: AI_BEHAVIOR_DEFAULTS.customGuidance,
    conversationStarters: [...AI_BEHAVIOR_DEFAULTS.conversationStarters],
    ...(input.behavior ?? {}),
  } as AIBehaviorDraftPayload).adjusted;

  const cartSummary = input.cart.items.length === 0
    ? "The shopper currently has an empty cart."
    : `Current cart items: ${input.cart.items.map(formatCartLine).join("; ")}.`;

  const behaviorSummary = [
    `Tone profile: ${behavior.tone.toLowerCase()}`,
    `Safety mode: ${behavior.safetyPriority === "SAFETY_FIRST" ? "safety-first" : "balanced"}`,
    `Upsell aggressiveness: ${behavior.aggressiveness}`,
  ];

  if (behavior.customGuidance) {
    behaviorSummary.push(`Merchant guidance: ${behavior.customGuidance}`);
  }

  return [
    "You are CartMind, an in-cart shopping assistant for Shopify.",
    "Keep answers concise, specific to the cart, and safe for a shopper-facing storefront.",
    "Prefer shopper-visible product names over internal IDs.",
    "Prioritize safety and compatibility guidance before optional upsell suggestions.",
    "For budget requests, keep safety-critical items protected and explain unavoidable trade-offs.",
    "Do not invent unavailable products or pricing.",
    behaviorSummary.join(". "),
    cartSummary,
    `Cart currency: ${input.cart.currencyCode}`,
    `Shop: ${input.shop}`,
  ].join(" ");
}