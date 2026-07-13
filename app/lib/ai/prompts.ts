import type { StorefrontChatRequest } from "./schemas";
import {
  AI_BEHAVIOR_DEFAULTS,
  resolveBehaviorPolicyConflict,
  type AIBehaviorDraftPayload,
} from "./behavior-config";
import type { ResolvedCustomerProfile } from "../cart-intelligence/customer-profile";

function formatCartLine(line: StorefrontChatRequest["cart"]["items"][number], index: number) {
  const name = line.productTitle || `Item ${index + 1}`;
  const variant = line.variantTitle ? ` (${line.variantTitle})` : "";
  return `${name}${variant} x${line.quantity}`;
}

export function buildStorefrontChatSystemPrompt(input: Pick<StorefrontChatRequest, "shop" | "cart"> & {
  behavior?: AIBehaviorDraftPayload;
  profile?: ResolvedCustomerProfile | null;
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

  const profileLines: string[] = [];
  const profile = input.profile;
  if (profile && profile.guidanceMode !== "generic") {
    if (profile.disciplinePreferences.length > 0) {
      profileLines.push(`Shopper discipline: ${profile.disciplinePreferences.slice(0, 2).map((d) => d.discipline).join(", ")}`);
    }
    const sizeEntries = Object.entries(profile.knownSizes).slice(0, 4).map(([k, v]) => `${k}: ${v}`).join(", ");
    if (sizeEntries) {
      profileLines.push(`Known sizes: ${sizeEntries}`);
    }
    if (profile.experienceLevel) {
      profileLines.push(`Experience level: ${profile.experienceLevel}`);
    }
    if (profile.weightClass) {
      profileLines.push(`Weight class: ${profile.weightClass}`);
    }
    if (profile.purchaseFrequency) {
      profileLines.push(`Purchase frequency: ${profile.purchaseFrequency}`);
    }
  }

  return [
    "You are CartMind, an in-cart shopping assistant for Shopify.",
    "Keep answers concise, specific to the cart, and safe for a shopper-facing storefront.",
    "Prefer shopper-visible product names over internal IDs.",
    "Answer product, use-case, and sizing questions directly from the current cart context before suggesting add-ons.",
    "When a shopper asks whether an item suits sparring, training, sizing, or fit, state what can be inferred from the product and variant names, then ask them to confirm any missing safety-critical details.",
    "When explaining recommendations, cite cart signals such as product type, selected variant, safety, compatibility, availability, or kit gaps.",
    "Prioritize safety and compatibility guidance before optional upsell suggestions.",
    "For budget requests, keep safety-critical items protected and explain unavoidable trade-offs.",
    "Do not invent unavailable products or pricing.",
    "Reply in the same language as the shopper's last message. If the question is in French, answer entirely in French.",
    behaviorSummary.join(". "),
    cartSummary,
    ...(profileLines.length > 0 ? [`Shopper profile (use to personalise, do not repeat back verbatim): ${profileLines.join(". ")}.`] : []),
    `Cart currency: ${input.cart.currencyCode}`,
    `Shop: ${input.shop}`,
  ].join(" ");
}