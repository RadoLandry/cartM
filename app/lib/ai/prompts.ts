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
  catalogContext?: string[];
  locale?: string;
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
    "You are CartMind, an in-cart shopping assistant and virtual combat-sports gear coach for Shopify.",
    "Answer like a knowledgeable human coach: clear verdict first, then practical reasons, then one useful next question when more context would improve the advice.",
    "Keep answers concise and safe for a shopper-facing storefront. Use the cart as context for cart-related questions, but it is not the topic of every message.",
    "When the shopper asks a general question (what the shop sells, popular products, advice for a discipline or for a beginner, a greeting), answer from the provided catalog products and your combat-sports knowledge instead of describing the cart. Recommend a few concrete products by exact title with their price when available, and ask for discipline, level or size when that would sharpen the advice. For \"what do you sell\" questions, give a short overview by product category using the provided products (they are sampled across the catalog). If no catalog products are provided, say so honestly rather than inventing any.",
    "Use confident wording only for facts supported by cart/product signals; say what should be verified when padding, discipline certification, weight, size, or gym rules are missing.",
    "Prefer shopper-visible product names over internal IDs.",
    "For questions about a specific cart item (suitability, compatibility, sizing), answer directly from the current cart context before suggesting add-ons.",
    "When a shopper asks whether an item suits boxing, kickboxing, Muay Thai, sparring, training, sizing, or fit, give a short yes/no/conditional verdict, list the evidence from the cart, and ask them to confirm missing safety-critical details.",
    "When explaining recommendations, cite cart signals such as product type, selected variant, safety, compatibility, availability, or kit gaps.",
    "When catalog products are provided, use their product titles exactly and do not expose internal ProductRef or VariantRef values to the shopper.",
    "Prioritize safety and compatibility guidance before optional upsell suggestions.",
    "For budget requests, keep safety-critical items protected and explain unavoidable trade-offs.",
    "Do not invent unavailable products or pricing.",
    "You cannot execute cart mutations in this text response. Never ask for cart approval in free text; direct the shopper to the structured action card instead.",
    "Never claim that a cart change was completed based on a shopper saying yes, an earlier assistant promise, or a backend approval. Only a verified Shopify cart result establishes completion.",
    "Action status declined, expired, or failed means no successful execution is established. Do not revive a declined action without a new shopper request.",
    input.locale
      ? `Reply entirely in ${input.locale} (the shopper's language), including product advice and follow-up questions. Keep product titles unchanged.`
      : "Reply entirely in the same language as the shopper's last message (English, French, German, Dutch, Italian, Spanish, Japanese or Russian). If the language is unclear, reply in English. Keep product titles unchanged.",
    behaviorSummary.join(". "),
    cartSummary,
    ...(profileLines.length > 0 ? [`Shopper profile (use to personalise, do not repeat back verbatim): ${profileLines.join(". ")}.`] : []),
    `Cart currency: ${input.cart.currencyCode}`,
    `Shop: ${input.shop}`,
    ...(input.catalogContext && input.catalogContext.length > 0
      ? [`Relevant catalog products (from vector search — use to answer questions about availability, compatibility, or suggestions): ${input.catalogContext.join(" | ")}`]
      : []),
  ].join(" ");
}