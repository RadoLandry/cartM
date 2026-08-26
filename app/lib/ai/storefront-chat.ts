import crypto from "node:crypto";

import type {
  BudgetOptimizationError,
  BudgetOptimizationRequest,
  BudgetOptimizationResult,
  CartToolAction,
  ProductComparisonDimension,
  ProductComparisonError,
  ProductComparisonRequest,
  ProductComparisonResult,
  ProductComparisonSnapshot,
  StorefrontChatRequest,
  StorefrontChatStreamPart,
  StructuredGuidanceBlock,
} from "./schemas";
import { buildStorefrontChatSystemPrompt } from "./prompts";
import {
  getActiveAIBehaviorConfigWithFallback,
  getActiveRelationshipsForProduct,
  getSessionCustomerProfile,
  listActiveKitDefinitions,
  listActiveReplenishmentLifecycleRules,
  listCustomerPurchaseSnapshots,
} from "../db/queries";
import db from "../../db.server";
import { AI_BEHAVIOR_DEFAULTS, resolveBehaviorPolicyConflict, type AIBehaviorDraftPayload } from "./behavior-config";
import { detectKitCompleteness } from "../cart-intelligence/kit-detection";
import { detectSizeConflicts } from "../cart-intelligence/size-conflicts";
import {
  buildKitRecommendations,
  buildReplenishmentRecommendations,
  buildThresholdRecommendations,
} from "../cart-intelligence/recommendations";
import { evaluateReplenishmentCandidates } from "../cart-intelligence/replenishment";
import { buildThresholdEvaluationRequest, evaluateThreshold } from "../cart-intelligence/threshold";
import { buildProfileKey, resolveCustomerProfile } from "../cart-intelligence/customer-profile";
import { issueActionConfirmationToken } from "../shopify/app-proxy";

// Re-export client-safe utilities so existing server-side consumers keep working
export { mapBudgetOptimizationToGuidanceBlock } from "./storefront-chat-client";

export interface StorefrontChatBehaviorResolution {
  source: "active" | "draft" | "defaults";
  config: AIBehaviorDraftPayload;
}

function buildDefaultBehaviorConfig(): AIBehaviorDraftPayload {
  return {
    tone: AI_BEHAVIOR_DEFAULTS.tone,
    aggressiveness: AI_BEHAVIOR_DEFAULTS.aggressiveness,
    safetyPriority: AI_BEHAVIOR_DEFAULTS.safetyPriority,
    customGuidance: AI_BEHAVIOR_DEFAULTS.customGuidance,
    conversationStarters: [...AI_BEHAVIOR_DEFAULTS.conversationStarters],
  };
}

export async function resolveStorefrontChatBehavior(shop: string): Promise<StorefrontChatBehaviorResolution> {
  try {
    const resolved = await getActiveAIBehaviorConfigWithFallback(shop);

    return {
      source: resolved.source,
      config: resolveBehaviorPolicyConflict(resolved.config).adjusted,
    };
  } catch {
    return {
      source: "defaults",
      config: resolveBehaviorPolicyConflict(buildDefaultBehaviorConfig()).adjusted,
    };
  }
}

export const CART_TOOL_ACTION_STATUSES = [
  "proposed",
  "approved",
  "declined",
  "expired",
  "executing",
  "executed",
  "failed",
] as const;

export type CartToolActionLifecycleStatus = (typeof CART_TOOL_ACTION_STATUSES)[number];

export const CART_TOOL_ACTION_TRANSITIONS: Record<CartToolActionLifecycleStatus, CartToolActionLifecycleStatus[]> = {
  proposed: ["approved", "declined", "expired"],
  approved: ["executing"],
  declined: [],
  expired: [],
  executing: ["executed", "failed"],
  executed: [],
  failed: [],
};

export interface CartToolActionLifecycleRecord {
  actionId: string;
  shop: string;
  sessionKey: string;
  cartId?: string;
  status: CartToolActionLifecycleStatus;
  payload: unknown;
  summary?: string;
  createdAt: string;
  updatedAt: string;
}

const actionLifecycleStore = new Map<string, CartToolActionLifecycleRecord>();

export interface CatalogActionCandidate {
  shopifyProductId: string;
  title: string;
  variantId: string;
  variantTitle?: string;
  imageUrl?: string;
  productHandle?: string;
}

const catalogActionCandidateStore = new Map<string, CatalogActionCandidate[]>();

function catalogActionCandidateStoreKey(shop: string, sessionKey: string) {
  return `${shop}::${sessionKey}`;
}

export function rememberCatalogActionCandidates(input: {
  shop: string;
  sessionKey: string;
  candidates: CatalogActionCandidate[];
}) {
  if (input.candidates.length === 0) {
    return;
  }

  const key = catalogActionCandidateStoreKey(input.shop, input.sessionKey);
  const existing = catalogActionCandidateStore.get(key) ?? [];
  const byProductId = new Map(existing.map((candidate) => [candidate.shopifyProductId, candidate]));

  for (const candidate of input.candidates) {
    byProductId.set(candidate.shopifyProductId, candidate);
  }

  catalogActionCandidateStore.set(key, Array.from(byProductId.values()).slice(-20));
}

export interface ProductComparisonContextRecord {
  comparisonContextId: string;
  requestId: string;
  shop: string;
  sessionKey: string;
  status: "generated" | "failed" | "expired" | "action_pending" | "action_executed" | "action_failed";
  productRefs: string[];
  createdAt: string;
  updatedAt: string;
  result?: ProductComparisonResult;
  error?: ProductComparisonError;
}

const productComparisonContextStore = new Map<string, ProductComparisonContextRecord>();

export interface BudgetOptimizationContextRecord {
  optimizationContextId: string;
  requestId: string;
  shop: string;
  sessionKey: string;
  status: "generated" | "failed" | "expired" | "action_pending" | "action_executed" | "action_failed";
  targetBudgetAmount: number;
  currencyCode: string;
  createdAt: string;
  updatedAt: string;
  result?: BudgetOptimizationResult;
  error?: BudgetOptimizationError;
}

const budgetOptimizationContextStore = new Map<string, BudgetOptimizationContextRecord>();

export function createCartToolActionRecord(input: {
  actionId: string;
  shop: string;
  sessionKey: string;
  cartId?: string;
  payload: unknown;
}) {
  const existing = actionLifecycleStore.get(input.actionId);
  if (existing) {
    return existing;
  }

  const now = new Date().toISOString();
  const record: CartToolActionLifecycleRecord = {
    actionId: input.actionId,
    shop: input.shop,
    sessionKey: input.sessionKey,
    ...(input.cartId ? { cartId: input.cartId } : {}),
    status: "proposed",
    payload: input.payload,
    createdAt: now,
    updatedAt: now,
  };

  actionLifecycleStore.set(input.actionId, record);
  return record;
}

export function getCartToolActionRecord(actionId: string) {
  return actionLifecycleStore.get(actionId);
}

export function transitionCartToolActionRecord(input: {
  actionId: string;
  nextStatus: CartToolActionLifecycleStatus;
  summary?: string;
}) {
  const current = actionLifecycleStore.get(input.actionId);

  if (!current) {
    return { ok: false as const, code: "ACTION_NOT_FOUND", message: "No matching cart action was found." };
  }

  const allowed = CART_TOOL_ACTION_TRANSITIONS[current.status];
  if (!allowed.includes(input.nextStatus)) {
    return {
      ok: false as const,
      code: "INVALID_STATUS_TRANSITION",
      message: `Cannot transition action ${input.actionId} from ${current.status} to ${input.nextStatus}.`,
      current,
    };
  }

  const updated: CartToolActionLifecycleRecord = {
    ...current,
    status: input.nextStatus,
    ...(input.summary ? { summary: input.summary } : {}),
    updatedAt: new Date().toISOString(),
  };

  actionLifecycleStore.set(input.actionId, updated);
  return { ok: true as const, record: updated };
}

export function isCartToolActionTerminalStatus(status: CartToolActionLifecycleStatus) {
  return CART_TOOL_ACTION_TRANSITIONS[status].length === 0;
}

export function getCartToolActionIdempotentReplay(actionId: string) {
  const record = actionLifecycleStore.get(actionId);

  if (!record || !isCartToolActionTerminalStatus(record.status)) {
    return null;
  }

  return {
    actionId: record.actionId,
    status: record.status,
    summary: record.summary || "Action already resolved earlier.",
    idempotentReplay: true,
  };
}

type RecommendationItem = Extract<StructuredGuidanceBlock, { type: "recommendation_list" }>["items"][number];
type RecommendationEvidenceTag = NonNullable<RecommendationItem["evidenceTags"]>[number];

interface ResolvedCartLine {
  inputLine: StorefrontChatRequest["cart"]["items"][number];
  productGid: string;
  variantGid?: string;
  productRow?: {
    id: string;
    shopifyProductId: string;
    title: string;
    status: "ACTIVE" | "INACTIVE";
    tags: string[];
    disciplineTags: string[];
    categoryTags: string[];
  };
  variantRow?: {
    id: string;
    shopifyVariantId: string;
    title: string;
    sizeValue?: string | null;
    sizeCategory?: string | null;
    inventoryQuantity?: number | null;
    price?: number | null;
  };
}

interface ChatIntelligenceSnapshot {
  recommendationItems: RecommendationItem[];
  sizeBlock?: StructuredGuidanceBlock;
  missingCount: number;
  sizeIssueCount: number;
  personalizationApplied: boolean;
  historyApplied: boolean;
}

const CHAT_INTELLIGENCE_TIMEOUT_MS = 2500;

function toProductGid(rawValue: string) {
  if (rawValue.startsWith("gid://shopify/Product/")) {
    return rawValue;
  }

  const numeric = rawValue.match(/\d+/)?.[0] ?? rawValue;
  return `gid://shopify/Product/${numeric}`;
}

function toVariantGid(rawValue: string) {
  if (rawValue.startsWith("gid://shopify/ProductVariant/")) {
    return rawValue;
  }

  const numeric = rawValue.match(/\d+/)?.[0] ?? rawValue;
  return `gid://shopify/ProductVariant/${numeric}`;
}

function pickCategoryTag(line: ResolvedCartLine) {
  return line.productRow?.categoryTags[0] || "";
}

function detectChildSizing(line: ResolvedCartLine) {
  const tokens = [
    ...(line.productRow?.tags ?? []),
    line.productRow?.title ?? "",
    line.variantRow?.title ?? "",
  ].map((value) => value.toLowerCase());

  return tokens.some((value) => value.includes("child") || value.includes("kids") || value.includes("junior"));
}

function dedupeRecommendationItems(items: RecommendationItem[]) {
  const seen = new Set<string>();

  return items.filter((item) => {
    const key = `${item.action}|${item.productId || "na"}|${item.variantId || "na"}|${item.title}`;
    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function toStoredProfileSnapshot(stored: NonNullable<Awaited<ReturnType<typeof getSessionCustomerProfile>>>) {
  return {
    profileKey: buildProfileKey(stored.shop, stored.shopifyCustomerId, stored.sessionId),
    shop: stored.shop,
    shopifyCustomerId: stored.shopifyCustomerId,
    sessionId: stored.sessionId,
    sizeProfile: stored.sizeProfile,
    disciplineProfile: stored.disciplineProfile,
    explicitProfile: stored.explicitProfile,
    purchaseSummary: stored.purchaseSummary,
    behaviorSummary: stored.behaviorSummary,
    confidenceSummary: stored.confidenceSummary,
    lastActiveAt: stored.lastActiveAt,
  };
}

async function resolveCartLines(input: StorefrontChatRequest): Promise<ResolvedCartLine[]> {
  const normalized = input.cart.items.map((line) => ({
    inputLine: line,
    productGid: toProductGid(line.productId),
    variantGid: line.variantId ? toVariantGid(line.variantId) : undefined,
  }));
  const productGids = Array.from(new Set(normalized.map((line) => line.productGid)));
  const variantGids = Array.from(new Set(normalized.map((line) => line.variantGid).filter((value): value is string => Boolean(value))));

  if (productGids.length === 0 && variantGids.length === 0) {
    return [];
  }

  const rows = await db.product.findMany({
    where: {
      shop: input.shop,
      OR: [
        ...(productGids.length > 0 ? [{ shopifyProductId: { in: productGids } }] : []),
        ...(variantGids.length > 0 ? [{ variants: { some: { shopifyVariantId: { in: variantGids } } } }] : []),
      ],
    },
    select: {
      id: true,
      shopifyProductId: true,
      title: true,
      status: true,
      tags: true,
      disciplineTags: true,
      categoryTags: true,
      variants: {
        select: {
          id: true,
          shopifyVariantId: true,
          title: true,
          sizeValue: true,
          sizeCategory: true,
          inventoryQuantity: true,
          price: true,
        },
      },
    },
  });

  const productByGid = new Map(rows.map((row) => [row.shopifyProductId, row]));
  const productByVariantGid = new Map<string, (typeof rows)[number]>();
  for (const row of rows) {
    for (const variant of row.variants) {
      productByVariantGid.set(variant.shopifyVariantId, row);
    }
  }

  return normalized.map((line) => {
    const productRow = productByGid.get(line.productGid) || (line.variantGid ? productByVariantGid.get(line.variantGid) : undefined);
    const variantRow = line.variantGid
      ? productRow?.variants.find((variant) => variant.shopifyVariantId === line.variantGid)
      : undefined;

    return {
      ...line,
      ...(productRow
        ? {
            productRow: {
              id: productRow.id,
              shopifyProductId: productRow.shopifyProductId,
              title: productRow.title,
              status: productRow.status,
              tags: productRow.tags,
              disciplineTags: productRow.disciplineTags,
              categoryTags: productRow.categoryTags,
            },
          }
        : {}),
      ...(variantRow
        ? {
            variantRow: {
              id: variantRow.id,
              shopifyVariantId: variantRow.shopifyVariantId,
              title: variantRow.title,
              sizeValue: variantRow.sizeValue,
              sizeCategory: variantRow.sizeCategory,
              inventoryQuantity: variantRow.inventoryQuantity,
              price: variantRow.price !== null ? Number(variantRow.price) : null,
            },
          }
        : {}),
    };
  });
}

function toDisplayName(item: StorefrontChatRequest["cart"]["items"][number], fallback: string) {
  return item.productTitle || fallback;
}

function buildFallbackRecommendations(input: StorefrontChatRequest): RecommendationItem[] {
  const firstItem = input.cart.items[0];
  const primaryName = firstItem ? toDisplayName(firstItem, "your first cart item") : "your cart";

  const recommendations: RecommendationItem[] = [
    {
      productId: firstItem?.productId,
      productTitle: firstItem?.productTitle,
      variantId: firstItem?.variantId,
      variantTitle: firstItem?.variantTitle,
      title: `${primaryName}: keep current choice`,
      action: "keep",
      priorityLabel: "high",
      reason: "This option appears compatible with the rest of your current cart.",
      shopperOutcome: "Keeps your current setup stable while you fill gaps.",
      safetyCritical: true,
      availability: "available",
      evidenceTags: ["compatibility", "safety", "fallback"],
    },
    {
      title: "Protective add-on",
      action: "add",
      priorityLabel: "high",
      reason: `Add a protective accessory that matches ${primaryName} for safer usage.`,
      shopperOutcome: "Improves safety and confidence for immediate use.",
      safetyCritical: true,
      availability: "available",
      evidenceTags: ["safety", "compatibility", "fallback"],
    },
    {
      productId: firstItem?.productId,
      productTitle: firstItem?.productTitle,
      variantId: firstItem?.variantId,
      variantTitle: firstItem?.variantTitle,
      title: `${primaryName}: fit check`,
      action: "size_adjust",
      priorityLabel: "medium",
      reason: "Adjust size if you want extra room for layering or wraps.",
      shopperOutcome: "Reduces fit mismatch risk at checkout.",
      safetyCritical: false,
      availability: "unknown",
      evidenceTags: ["size", "fallback"],
    },
  ];

  return recommendations
    .filter((item) => item.availability !== "unavailable")
    .sort((a, b) => {
      const rank = { high: 0, medium: 1, low: 2 } as const;
      if ((a.safetyCritical ? 0 : 1) !== (b.safetyCritical ? 0 : 1)) {
        return (a.safetyCritical ? 0 : 1) - (b.safetyCritical ? 0 : 1);
      }
      return rank[a.priorityLabel] - rank[b.priorityLabel];
    });
}

function buildFallbackRecommendationsFr(input: StorefrontChatRequest): RecommendationItem[] {
  const firstItem = input.cart.items[0];
  const primaryName = firstItem ? toDisplayName(firstItem, "votre premier article") : "votre panier";

  const recommendations: RecommendationItem[] = [
    {
      productId: firstItem?.productId,
      productTitle: firstItem?.productTitle,
      variantId: firstItem?.variantId,
      variantTitle: firstItem?.variantTitle,
      title: `${primaryName} : garder ce choix`,
      action: "keep",
      priorityLabel: "high",
      reason: "Ce choix semble compatible avec le reste de votre panier.",
      shopperOutcome: "Maintient votre sélection actuelle pendant que vous complétez le kit.",
      safetyCritical: true,
      availability: "available",
      evidenceTags: ["compatibility", "safety", "fallback"],
    },
    {
      title: "Accessoire de protection",
      action: "add",
      priorityLabel: "high",
      reason: `Ajoutez un accessoire de protection adapté à ${primaryName} pour plus de sécurité.`,
      shopperOutcome: "Améliore la sécurité et la confiance pour une utilisation immédiate.",
      safetyCritical: true,
      availability: "available",
      evidenceTags: ["safety", "compatibility", "fallback"],
    },
    {
      productId: firstItem?.productId,
      productTitle: firstItem?.productTitle,
      variantId: firstItem?.variantId,
      variantTitle: firstItem?.variantTitle,
      title: `${primaryName} : vérification de taille`,
      action: "size_adjust",
      priorityLabel: "medium",
      reason: "Ajustez la taille si vous avez besoin de place pour des protections ou des bandages.",
      shopperOutcome: "Réduit le risque de mauvaise taille avant la commande.",
      safetyCritical: false,
      availability: "unknown",
      evidenceTags: ["size", "fallback"],
    },
  ];

  return recommendations
    .filter((item) => item.availability !== "unavailable")
    .sort((a, b) => {
      const rank = { high: 0, medium: 1, low: 2 } as const;
      if ((a.safetyCritical ? 0 : 1) !== (b.safetyCritical ? 0 : 1)) {
        return (a.safetyCritical ? 0 : 1) - (b.safetyCritical ? 0 : 1);
      }
      return rank[a.priorityLabel] - rank[b.priorityLabel];
    });
}

function buildFallbackBlock(summary: string, lang: "fr" | "en" = "en"): StructuredGuidanceBlock {
  return {
    blockId: "fallback-1",
    type: "fallback_notice",
    title: lang === "fr" ? "Conseil assistant" : "Chat guidance",
    summary,
    priority: 1,
  };
}

function buildRecommendationBlock(items: RecommendationItem[], lang: "fr" | "en" = "en"): StructuredGuidanceBlock {
  const recommendations = dedupeRecommendationItems(items);

  if (recommendations.length === 0) {
    return buildFallbackBlock(
      lang === "fr"
        ? "Aucune recommandation disponible pour ce panier en ce moment."
        : "No currently available recommendations were found for this cart.",
      lang,
    );
  }

  return {
    blockId: "recommendation-1",
    type: "recommendation_list",
    title: lang === "fr" ? "Actions recommandées pour le panier" : "Recommended cart actions",
    summary: lang === "fr" ? "Les actions de sécurité et compatibilité sont listées en premier." : "Safety and compatibility actions are listed first.",
    priority: 1,
    items: recommendations,
  };
}

function hasEvidenceTag(item: RecommendationItem, tag: RecommendationEvidenceTag) {
  return item.evidenceTags?.includes(tag) ?? false;
}

function isFallbackOnlyRecommendations(items: RecommendationItem[]) {
  return items.length > 0 && items.every((item) => hasEvidenceTag(item, "fallback"));
}

function isKitIntentMessage(message: string) {
  return /(kit|missing|manqu|essentiel|complete|compl[eé]ter)/i.test(message);
}

function isSizeOrUseCaseIntentMessage(message: string) {
  return /(size|fit|sizing|taille|pointure|oz\b|ounce|sparring|combat|entrainement|entra[iî]nement|training|pratique|adapt[eé]|convient|compatible|suitable|muay\s*thai|tha[iï]|kick\s*boxing|kickboxing|boxe|boxing|mma)/i.test(message);
}

function isRecommendationExplanationIntentMessage(message: string) {
  return /(why|pourquoi|explain|explique|recommend|recommand|suggest|conseil|propose|s['’]?accorde|accorde|va\s+bien|works?\s+well|goes?\s+well|pair)/i.test(message);
}

function isProactiveAnalysisPrompt(message: string) {
  return /^analyse\s+proactive/i.test(message);
}

function detectMessageLanguage(message: string): "fr" | "en" {
  return /\b(est|ce|cette|les|des|pour|dans|avec|sont|vous|moi|mon|ma|du|au|que|qui|je|il|elle|ils|nous|votre|notre|adapt[eé]s?|gants|taille|boxe|sparring|entrainement|entra[iî]nement|bonjour|merci|pourquoi|comment|aussi|quel|quelle|quels|quelles|convient|adapté)\b/i.test(message) ? "fr" : "en";
}

function formatCartItemForAnswer(item: StorefrontChatRequest["cart"]["items"][number]) {
  const title = item.productTitle || "this product";
  const variant = item.variantTitle ? ` (${item.variantTitle})` : "";
  return `${title}${variant}`;
}

function detectDisciplineIntent(message: string, lang: "fr" | "en") {
  const disciplines = [
    { pattern: /muay\s*thai|tha[iï]/i, fr: "Muay Thai", en: "Muay Thai" },
    { pattern: /kick\s*boxing|kickboxing/i, fr: "kickboxing", en: "kickboxing" },
    { pattern: /boxe|boxing/i, fr: "boxe", en: "boxing" },
    { pattern: /mma|mixed martial arts/i, fr: "MMA", en: "MMA" },
  ];

  return disciplines.find((discipline) => discipline.pattern.test(message))?.[lang];
}

function inferUseCaseEvidence(label: string, message: string, lang: "fr" | "en") {
  const source = `${label} ${message}`.toLowerCase();
  const evidence: string[] = [];

  if (/gant|glove/.test(source)) {
    evidence.push(lang === "fr" ? "il s'agit de gants" : "it is a glove product");
  }

  if (/\b\d{1,2}\s*oz\b|ounce/.test(source)) {
    const weight = source.match(/\b\d{1,2}\s*oz\b|\b\d{1,2}\s*ounce/i)?.[0];
    evidence.push(lang === "fr" ? `la variante indique ${weight}` : `the variant shows ${weight}`);
  }

  if (/boxe|boxing|kick\s*boxing|kickboxing|muay\s*thai|tha[iï]/.test(source)) {
    evidence.push(lang === "fr" ? "le libellé mentionne un usage boxe/kickboxing/Muay Thai" : "the label mentions boxing/kickboxing/Muay Thai use");
  }

  return evidence;
}

function buildCartAwareQuestionAnswer(input: StorefrontChatRequest, intelligence: ChatIntelligenceSnapshot, lang: "fr" | "en" = "en") {
  const latestMessage = input.messages[input.messages.length - 1]?.content.toLowerCase() ?? "";
  const primaryItem = input.cart.items[0];
  const primaryLabel = primaryItem ? formatCartItemForAnswer(primaryItem) : (lang === "fr" ? "ce produit" : "this cart item");
  const discipline = detectDisciplineIntent(latestMessage, lang);
  const useCaseEvidence = inferUseCaseEvidence(primaryLabel, latestMessage, lang);
  const asksAboutSparring = /(sparring|combat)/i.test(latestMessage);
  const asksAboutSize = /(size|fit|sizing|taille|pointure|oz\b|ounce)/i.test(latestMessage);
  const safetyRecommendation = intelligence.recommendationItems.find((item) => item.safetyCritical);
  const usefulRecommendation = safetyRecommendation || intelligence.recommendationItems[0];
  const recommendationReason = usefulRecommendation?.reason
    ? (lang === "fr"
        ? ` Contexte : ${usefulRecommendation.title} — ${usefulRecommendation.reason}`
        : ` Recommendation context: ${usefulRecommendation.title} because ${usefulRecommendation.reason}`)
    : "";

  if (discipline) {
    const evidenceSentence = useCaseEvidence.length > 0
      ? (lang === "fr"
          ? ` Les signaux disponibles: ${useCaseEvidence.join(", ")}.`
          : ` Available signals: ${useCaseEvidence.join(", ")}.`)
      : (lang === "fr"
          ? " Le panier ne contient pas assez de détails techniques pour confirmer plus finement."
          : " The cart does not include enough technical detail for a finer confirmation.");

    return lang === "fr"
      ? `Oui, **${primaryLabel}** semble compatible avec la pratique du **${discipline}** d'après les informations visibles dans le panier.${evidenceSentence} Pour un conseil vraiment fiable, vérifiez aussi le rembourrage, le maintien du poignet, le poids adapté à votre usage et les règles de votre salle.${recommendationReason}`
      : `Yes, **${primaryLabel}** appears compatible with **${discipline}** based on the cart-visible information.${evidenceSentence} For reliable final advice, also verify padding, wrist support, the right weight for your use case, and your gym rules.${recommendationReason}`;
  }

  if (asksAboutSparring) {
    return lang === "fr"
      ? `**${primaryLabel}** : d'après le nom du produit dans le panier, il s'agit d'un équipement de combat ou d'entraînement. Je ne peux pas certifier qu'il convient au sparring sans les détails complets. Pour le sparring, confirmez le poids des gants, le niveau de rembourrage, le type de fermeture et les règles de votre salle avant de commander.${recommendationReason}`
      : `${primaryLabel}: I can infer it is combat/training gear from the cart label, but I cannot certify sparring suitability from the cart alone. For sparring, confirm the exact glove weight, padding level, closure, and your gym rules before checkout.${recommendationReason}`;
  }

  if (asksAboutSize) {
    if (lang === "fr") {
      return intelligence.sizeIssueCount > 0
        ? `**${primaryLabel}** : j'ai détecté un risque possible de taille ou de fit dans ce panier. Consultez le guide des tailles ci-dessous avant de commander.${recommendationReason}`
        : `**${primaryLabel}** : la variante sélectionnée ne présente pas de conflit de taille évident. Confirmez quand même le guide des tailles de la marque, surtout si vous portez des protections en dessous.${recommendationReason}`;
    }
    return intelligence.sizeIssueCount > 0
      ? `${primaryLabel}: I found a possible fit or size risk in this cart. Review the size guidance below before checkout.${recommendationReason}`
      : `${primaryLabel}: the selected variant does not show an obvious cart-level size conflict. Still confirm the brand size chart and intended use, especially if you need room for wraps or protective layers.${recommendationReason}`;
  }

  if (isRecommendationExplanationIntentMessage(latestMessage) && usefulRecommendation) {
    return lang === "fr"
      ? `Je recommande **${usefulRecommendation.title}** car ${usefulRecommendation.reason} Résultat attendu : ${usefulRecommendation.shopperOutcome}`
      : `I recommend ${usefulRecommendation.title} because ${usefulRecommendation.reason} Outcome: ${usefulRecommendation.shopperOutcome}`;
  }

  return lang === "fr"
    ? `Pour **${primaryLabel}**, voici les informations disponibles à partir du panier et des signaux ci-dessous.${recommendationReason}`
    : `For ${primaryLabel}, I can answer from the current cart context and the recommendation signals below.${recommendationReason}`;
}

function buildComparisonBlock(input: StorefrontChatRequest): StructuredGuidanceBlock {
  const items = input.cart.items.slice(0, 2);

  return {
    blockId: "comparison-1",
    type: "comparison_table",
    title: "Quick comparison",
    summary: "A simple comparison of the items currently being considered.",
    priority: 1,
    columns: items.map((item, index) => ({
      key: item.productId,
      title: item.productTitle || `Option ${index + 1}`,
    })),
    rows: [
      {
        label: "Product",
        values: items.map((item) => item.productTitle || item.productId),
      },
      {
        label: "Quantity",
        values: items.map((item) => String(item.quantity)),
      },
    ],
  };
}

function buildSizeBlock(lang: "fr" | "en" = "en"): StructuredGuidanceBlock {
  return lang === "fr"
    ? {
        blockId: "size-1",
        type: "size_summary",
        title: "Résumé des tailles",
        summary: "Vérifiez vos sélections de taille avant de finaliser la commande.",
        priority: 1,
        confidence: 0.42,
        highlights: [
          "Comparez la variante sélectionnée avec la taille habituelle.",
          "Si le panier mélange vêtements et équipements, vérifiez la cohérence des tailles avant de commander.",
        ],
      }
    : {
        blockId: "size-1",
        type: "size_summary",
        title: "Sizing summary",
        summary: "Double-check fit-related selections before checkout.",
        priority: 1,
        confidence: 0.42,
        highlights: [
          "Compare the selected variant against the shopper's expected fit.",
          "If the cart mixes apparel and gear sizes, confirm they align before checkout.",
        ],
      };
}

function filterGuidanceBlocksForFeatures(
  blocks: StructuredGuidanceBlock[],
  features: StorefrontChatRequest["features"],
): StructuredGuidanceBlock[] {
  return blocks.filter((block) => {
    if (block.type === "size_summary") {
      return features.showSizeWarnings !== false;
    }

    if (block.type === "recommendation_list") {
      const items = block.items.filter((item) => {
        const tags = item.evidenceTags ?? [];
        const isKitItem = tags.includes("kit");
        if (isKitItem && features.showKitCompleteness === false) {
          return false;
        }

        if (!isKitItem && features.showRecommendations === false) {
          return false;
        }

        return true;
      });

      return items.length > 0;
    }

    return true;
  }).map((block) => {
    if (block.type !== "recommendation_list") {
      return block;
    }

    return {
      ...block,
      items: block.items.filter((item) => {
        const tags = item.evidenceTags ?? [];
        const isKitItem = tags.includes("kit");
        return isKitItem
          ? features.showKitCompleteness !== false
          : features.showRecommendations !== false;
      }),
    };
  });
}

function buildFeatureAwareReply(
  reply: { text: string; guidanceBlocks: StructuredGuidanceBlock[] },
  features: StorefrontChatRequest["features"],
) {
  return {
    ...reply,
    guidanceBlocks: filterGuidanceBlocksForFeatures(reply.guidanceBlocks, features),
  };
}

async function buildIntelligentSnapshot(input: StorefrontChatRequest, lang: "fr" | "en" = "en"): Promise<ChatIntelligenceSnapshot> {
  const fallbackItems = lang === "fr" ? buildFallbackRecommendationsFr(input) : buildFallbackRecommendations(input);

  try {
    const resolvedLines = await resolveCartLines(input);
    const matchedLines = resolvedLines.filter((line): line is ResolvedCartLine & { productRow: NonNullable<ResolvedCartLine["productRow"]> } => Boolean(line.productRow));
    const recommendationItems: RecommendationItem[] = [];
    let missingCount = 0;
    let sizeIssueCount = 0;
    let personalizationApplied = false;
    let historyApplied = false;
    let sizeBlock: StructuredGuidanceBlock | undefined;

    const catalogComplementItems = await buildDatabaseComplementRecommendations(input, matchedLines, lang);
    recommendationItems.push(...catalogComplementItems);
    if (catalogComplementItems.length > 0) {
      missingCount += catalogComplementItems.length;
    }

    const unavailableLines = matchedLines.filter((line) => (line.variantRow?.inventoryQuantity ?? 1) <= 0);
    for (const line of unavailableLines.slice(0, 2)) {
      recommendationItems.unshift({
        productId: line.inputLine.productId,
        productTitle: line.inputLine.productTitle,
        variantId: line.inputLine.variantId,
        variantTitle: line.inputLine.variantTitle,
        title: `${toDisplayName(line.inputLine, "Item")} appears unavailable`,
        action: "remove",
        priorityLabel: "high",
        reason: "This selected variant appears out of stock and may block checkout completion.",
        shopperOutcome: "Removes a blocked item so the cart can be checked out reliably.",
        safetyCritical: true,
        availability: "unavailable",
        evidenceTags: ["availability", "safety"],
      });
      sizeIssueCount += 1;
    }

    const storedProfile = await getSessionCustomerProfile(input.shop, input.sessionKey).catch(() => null);
    if (storedProfile) {
      const resolvedProfile = resolveCustomerProfile({
        shop: input.shop,
        sessionId: input.sessionKey,
        storedProfile: toStoredProfileSnapshot(storedProfile),
      });
      personalizationApplied = Object.keys(resolvedProfile.knownSizes).length > 0
        || resolvedProfile.disciplinePreferences.length > 0;

      if (Object.keys(resolvedProfile.knownSizes).length > 0) {
        for (const line of matchedLines) {
          const categoryTag = pickCategoryTag(line);
          const expectedSize = categoryTag ? resolvedProfile.knownSizes[categoryTag] : undefined;
          const selectedSize = line.variantRow?.sizeValue || line.inputLine.variantTitle;

          if (expectedSize && selectedSize && !selectedSize.toLowerCase().includes(expectedSize.toLowerCase())) {
            recommendationItems.unshift({
              productId: line.inputLine.productId,
              productTitle: line.inputLine.productTitle,
              variantId: line.inputLine.variantId,
              variantTitle: line.inputLine.variantTitle,
              title: `${toDisplayName(line.inputLine, "Item")}: size profile check`,
              action: "size_adjust",
              priorityLabel: "high",
              reason: `Your usual ${categoryTag} size is ${expectedSize}, but this line currently looks like ${selectedSize}.`,
              shopperOutcome: "Reduces mismatch risk based on your saved size habits.",
              safetyCritical: true,
              availability: "unknown",
              evidenceTags: ["profile", "size"],
            });
            sizeIssueCount += 1;
          }
        }
      }

      if (storedProfile.shopifyCustomerId) {
        const snapshots = await listCustomerPurchaseSnapshots(input.shop, storedProfile.shopifyCustomerId).catch(() => []);
        if (snapshots.length > 0) {
          historyApplied = true;
          const lifecycleRules = await listActiveReplenishmentLifecycleRules(
            input.shop,
            Array.from(new Set(snapshots.map((snapshot) => snapshot.categoryTag))),
          ).catch(() => []);

          if (lifecycleRules.length > 0) {
            const replenishment = buildReplenishmentRecommendations(evaluateReplenishmentCandidates({
              shop: input.shop,
              shopifyCustomerId: storedProfile.shopifyCustomerId,
              profile: storedProfile,
              purchaseSnapshots: snapshots,
              lifecycleRules,
            }));

            if (replenishment?.opportunities.length) {
              const top = replenishment.opportunities[0];
              recommendationItems.push({
                productId: top.productId,
                variantId: top.variantId,
                title: `${top.title}: ${top.dueState === "due" ? "due for refresh" : "refresh window near"}`,
                action: "add",
                priorityLabel: "medium",
                reason: top.reason,
                shopperOutcome: "Keeps recurring gear in stock based on your purchase rhythm.",
                safetyCritical: false,
                availability: top.actionTarget ? (top.actionTarget.available ? "available" : "unavailable") : "unknown",
                evidenceTags: ["history"],
              });
            }
          }
        }
      }
    }

    const disciplineTags = Array.from(new Set(matchedLines.flatMap((line) => line.productRow?.disciplineTags ?? [])));

    let kitDefinitions = await listActiveKitDefinitions(
      input.shop,
      disciplineTags.length > 0 ? disciplineTags : undefined,
    ).catch(() => []);

    if (kitDefinitions.length === 0) {
      kitDefinitions = await listActiveKitDefinitions(input.shop).catch(() => []);
    }

    if (kitDefinitions.length > 0 && matchedLines.length > 0) {
      const uniqueInternalIds = Array.from(new Set(
        matchedLines.map((line) => line.productRow?.id).filter((value): value is string => Boolean(value)),
      ));
      const relationshipSets = await Promise.all(
        uniqueInternalIds.map((id) => getActiveRelationshipsForProduct(input.shop, id).catch(() => [])),
      );
      const relationshipMap = new Map<string, { sourceProductId: string; targetProductId: string; relationshipType: "COMPLEMENTS" | "UPGRADES" | "ALTERNATIVES" | "CONFLICTS" | "SAME_COLLECTION"; strength: number }>();

      for (const rows of relationshipSets) {
        for (const row of rows) {
          relationshipMap.set(
            `${row.sourceProductId}|${row.targetProductId}|${row.relationshipType}`,
            {
              sourceProductId: row.sourceProductId,
              targetProductId: row.targetProductId,
              relationshipType: row.relationshipType,
              strength: row.strength,
            },
          );
        }
      }

      const kitAssessments = await detectKitCompleteness({
        shop: input.shop,
        items: matchedLines
          .filter((line): line is ResolvedCartLine & { productRow: NonNullable<ResolvedCartLine["productRow"]> } => Boolean(line.productRow))
          .map((line) => ({
            productId: line.productRow.id,
            shopifyProductId: line.productRow.shopifyProductId,
            title: line.productRow.title,
            quantity: line.inputLine.quantity,
            availableForSale: (line.variantRow?.inventoryQuantity ?? 1) > 0,
            disciplineTags: line.productRow.disciplineTags,
            categoryTags: line.productRow.categoryTags,
          })),
        kitDefinitions,
        relationships: Array.from(relationshipMap.values()),
      });

      const missingKitRecommendations = buildKitRecommendations(kitAssessments);
      missingCount += missingKitRecommendations.reduce((sum, item) => sum + item.missingRecommendations.length, 0);
      for (const kit of missingKitRecommendations.slice(0, 1)) {
        for (const missing of kit.missingRecommendations.slice(0, 2)) {
          recommendationItems.push({
            title: `${missing.title} (${kit.label})`,
            action: "add",
            priorityLabel: missing.recommendationType === "required_missing" ? "high" : "medium",
            reason: missing.reasons[0]?.message || `${missing.title} is still missing for ${kit.label}.`,
            shopperOutcome: "Completes key kit requirements and avoids missing essentials.",
            safetyCritical: missing.recommendationType === "required_missing",
            availability: "unknown",
            evidenceTags: missing.recommendationType === "required_missing" ? ["kit", "safety"] : ["kit"],
          });
        }
      }
    }

    const sizeConflictLines = matchedLines
      .filter((line) => Boolean(line.variantRow?.sizeValue || line.inputLine.variantTitle))
      .map((line) => ({
        productId: line.inputLine.productId,
        variantId: line.inputLine.variantId || line.variantRow?.shopifyVariantId || line.inputLine.productId,
        categoryTag: pickCategoryTag(line),
        sizeValue: line.variantRow?.sizeValue || line.inputLine.variantTitle || "",
        sizeCategory: line.variantRow?.sizeCategory || "general",
        isChildProduct: detectChildSizing(line),
        ...(line.inputLine.productTitle ? { title: line.inputLine.productTitle } : {}),
        ...(line.variantRow?.inventoryQuantity !== undefined ? { inventoryQuantity: line.variantRow.inventoryQuantity } : {}),
      }))
      .filter((line) => line.categoryTag.length > 0 && line.sizeValue.length > 0);

    if (sizeConflictLines.length >= 2) {
      const sizeConflicts = await detectSizeConflicts({
        shop: input.shop,
        cartItems: sizeConflictLines,
      });

      if (sizeConflicts.summary.total > 0) {
        sizeIssueCount += sizeConflicts.summary.total;
        sizeBlock = {
          blockId: "size-db-1",
          type: "size_summary",
          title: sizeConflicts.hasErrors ? "Critical size conflicts found" : "Potential size mismatches found",
          summary: sizeConflicts.conflicts[0]?.message || "Some cart lines may have sizing inconsistencies.",
          priority: 1,
          confidence: sizeConflicts.hasErrors ? 0.92 : 0.78,
          highlights: sizeConflicts.conflicts.slice(0, 3).map((conflict) => conflict.suggestedCorrection || conflict.message),
        };

        const topConflict = sizeConflicts.conflicts[0];
        if (topConflict) {
          recommendationItems.unshift({
            productId: topConflict.itemA.productId,
            variantId: topConflict.itemA.variantId,
            title: topConflict.severity === "ERROR" ? "Resolve a critical size conflict" : "Adjust a mismatched size pair",
            action: "size_adjust",
            priorityLabel: topConflict.severity === "ERROR" ? "high" : "medium",
            reason: topConflict.message,
            shopperOutcome: "Improves fit consistency and reduces exchange risk.",
            safetyCritical: topConflict.severity === "ERROR",
            availability: "unknown",
            evidenceTags: topConflict.severity === "ERROR" ? ["size", "safety"] : ["size"],
          });
        }
      }
    }

    const thresholdCartItems = matchedLines
      .filter((line): line is ResolvedCartLine & { productRow: NonNullable<ResolvedCartLine["productRow"]>; variantRow: NonNullable<ResolvedCartLine["variantRow"]> } => (
        Boolean(line.productRow && line.variantRow)
      ))
      .map((line) => ({
        productId: line.productRow.id,
        shopifyProductId: line.productRow.shopifyProductId,
        variantId: line.variantRow.id,
        shopifyVariantId: line.variantRow.shopifyVariantId,
        title: line.productRow.title,
        quantity: line.inputLine.quantity,
        availableForSale: (line.variantRow.inventoryQuantity ?? 1) > 0,
        categoryTags: line.productRow.categoryTags,
        disciplineTags: line.productRow.disciplineTags,
        unitPrice: line.variantRow.price ?? null,
      }));

    const cartSubtotal = thresholdCartItems.reduce((sum, line) => (
      sum + ((line.unitPrice ?? 0) * line.quantity)
    ), 0);

    if (thresholdCartItems.length > 0 && cartSubtotal > 0) {
      const thresholdRequest = await buildThresholdEvaluationRequest(
        input.shop,
        thresholdCartItems,
        cartSubtotal,
        input.cart.currencyCode,
      );
      const thresholdResult = evaluateThreshold(thresholdRequest);
      const thresholdPayload = buildThresholdRecommendations(thresholdResult);

      if (thresholdPayload.summary.status === "eligible") {
        missingCount += 1;
        for (const suggestion of thresholdPayload.suggestions.slice(0, 2)) {
          recommendationItems.push({
            productId: suggestion.productId,
            variantId: suggestion.variantId,
            title: suggestion.title,
            action: "add",
            priorityLabel: "medium",
            reason: `${suggestion.reason} ${suggestion.unlockMessage}`,
            shopperOutcome: "Adds relevant products that improve value and cart utility.",
            safetyCritical: false,
            priceLabel: suggestion.priceLabel,
            availability: "unknown",
            evidenceTags: ["threshold", "compatibility"],
          });
        }
      }
    }

    // any non-fallback item (size conflict, kit gap, profile, availability) counts as real intelligence
    const hasRealNonFallbackContent = recommendationItems.some((item) => !hasEvidenceTag(item, "fallback"));
    const recommendationPool = hasRealNonFallbackContent
      ? recommendationItems
      : [...recommendationItems, ...fallbackItems];

    const prioritized = dedupeRecommendationItems(recommendationPool)
      // strip "keep" actions and "add" items that have no resolvable variant (nothing to render in the carousel)
      .filter((item) => item.action !== "keep" && (item.action !== "add" || Boolean(item.variantId)))
      .sort((left, right) => {
        const rank = { high: 0, medium: 1, low: 2 } as const;
        if ((left.safetyCritical ? 0 : 1) !== (right.safetyCritical ? 0 : 1)) {
          return (left.safetyCritical ? 0 : 1) - (right.safetyCritical ? 0 : 1);
        }

        return rank[left.priorityLabel] - rank[right.priorityLabel];
      })
      .slice(0, 6);

    return {
      recommendationItems: prioritized,
      ...(sizeBlock ? { sizeBlock } : {}),
      missingCount,
      sizeIssueCount,
      personalizationApplied,
      historyApplied,
    };
  } catch {
    return {
      recommendationItems: fallbackItems,
      missingCount: 0,
      sizeIssueCount: 0,
      personalizationApplied: false,
      historyApplied: false,
    };
  }
}

async function buildIntelligentSnapshotWithTimeout(input: StorefrontChatRequest, lang: "fr" | "en" = "en"): Promise<ChatIntelligenceSnapshot> {
  const fallback = {
    recommendationItems: lang === "fr" ? buildFallbackRecommendationsFr(input) : buildFallbackRecommendations(input),
    missingCount: 0,
    sizeIssueCount: 0,
    personalizationApplied: false,
    historyApplied: false,
  } satisfies ChatIntelligenceSnapshot;

  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  try {
    const timeoutPromise = new Promise<ChatIntelligenceSnapshot>((resolve) => {
      timeoutId = setTimeout(() => resolve(fallback), CHAT_INTELLIGENCE_TIMEOUT_MS);
    });

    return await Promise.race([
      buildIntelligentSnapshot(input, lang),
      timeoutPromise,
    ]);
  } catch {
    return fallback;
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

export async function buildStorefrontChatReply(
  input: StorefrontChatRequest,
  behavior?: AIBehaviorDraftPayload,
) {
  const rawMessage = input.messages[input.messages.length - 1]?.content ?? "";
  const latestMessage = rawMessage.toLowerCase();
  const lang = detectMessageLanguage(latestMessage);
  const proactive = isProactiveAnalysisPrompt(latestMessage);
  const kitIntent = !proactive && isKitIntentMessage(latestMessage);

  const systemPrompt = buildStorefrontChatSystemPrompt({
    ...input,
    ...(behavior ? { behavior } : {}),
  });
  const features = input.features ?? {
    showRecommendations: true,
    showKitCompleteness: true,
    showSizeWarnings: true,
    showChatEntry: true,
    showReasonTags: true,
  };

  if (input.cart.items.length === 0) {
    return buildFeatureAwareReply({
      text: lang === "fr"
        ? `${systemPrompt} Votre panier est vide. Ajoutez au moins un article pour que je puisse vous donner des conseils personnalisés (garder/ajouter/retirer/échanger/taille).`
        : `${systemPrompt} Your cart is empty right now, so I can only give general guidance. Add at least one item and I can give specific keep/add/remove/swap/size advice.`,
      guidanceBlocks: [buildFallbackBlock(
        lang === "fr"
          ? "Ajoutez au moins un article au panier pour obtenir des conseils personnalisés."
          : "Add at least one cart item, then ask what to keep, add, remove, swap, or resize.",
        lang,
      )],
    }, features);
  }

  const intelligence = await buildIntelligentSnapshotWithTimeout(input, lang);
  const summaryParts = lang === "fr"
    ? [
        intelligence.missingCount > 0 ? `${intelligence.missingCount} lacune${intelligence.missingCount > 1 ? "s" : ""} identifiée${intelligence.missingCount > 1 ? "s" : ""}.` : null,
        intelligence.sizeIssueCount > 0 ? `${intelligence.sizeIssueCount} risque${intelligence.sizeIssueCount > 1 ? "s" : ""} de taille détecté${intelligence.sizeIssueCount > 1 ? "s" : ""}.` : null,
        intelligence.personalizationApplied ? "Les recommandations sont adaptées à votre profil." : null,
        intelligence.historyApplied ? "L'historique d'achats a été pris en compte." : null,
      ].filter((value): value is string => Boolean(value))
    : [
        intelligence.missingCount > 0 ? `${intelligence.missingCount} useful gap${intelligence.missingCount > 1 ? "s" : ""} identified.` : null,
        intelligence.sizeIssueCount > 0 ? `${intelligence.sizeIssueCount} size/choice risk${intelligence.sizeIssueCount > 1 ? "s" : ""} detected.` : null,
        intelligence.personalizationApplied ? "Recommendations are adapted to profile signals." : null,
        intelligence.historyApplied ? "Purchase history signals were included." : null,
      ].filter((value): value is string => Boolean(value));
  const recommendationBlock = buildRecommendationBlock(intelligence.recommendationItems, lang);
  const kitRecommendationItems = intelligence.recommendationItems.filter((item) => hasEvidenceTag(item, "kit"));
  const hasKitRecommendations = kitRecommendationItems.length > 0;
  const fallbackOnly = isFallbackOnlyRecommendations(intelligence.recommendationItems);
  const sizeGuidanceBlock = intelligence.sizeBlock || buildSizeBlock(lang);

  if (!proactive && (isSizeOrUseCaseIntentMessage(latestMessage) || isRecommendationExplanationIntentMessage(latestMessage))) {
    return buildFeatureAwareReply({
      text: buildCartAwareQuestionAnswer(input, intelligence, lang),
      guidanceBlocks: [sizeGuidanceBlock, recommendationBlock],
    }, features);
  }

  if (kitIntent) {
    if (hasKitRecommendations) {
      return buildFeatureAwareReply({
        text: lang === "fr"
          ? summaryParts.length > 0
            ? `Voici ce qu'il manque encore pour compléter votre kit, en commençant par les essentiels. ${summaryParts.join(" ")}`
            : "Voici ce qu'il manque encore pour compléter votre kit, en commençant par les essentiels."
          : summaryParts.length > 0
            ? `Here is what is still missing to complete your kit, prioritized by required essentials first. ${summaryParts.join(" ")}`
            : "Here is what is still missing to complete your kit, prioritized by required essentials first.",
        guidanceBlocks: [buildRecommendationBlock(kitRecommendationItems, lang), ...(intelligence.sizeBlock ? [intelligence.sizeBlock] : [])],
      }, features);
    }

    if (fallbackOnly) {
      return buildFeatureAwareReply({
        text: lang === "fr"
          ? "Je ne peux pas encore déduire un kit complet à partir du panier actuel. Ajoutez au moins un article de discipline principale (gants, bandages, protège-tibias ou pièce de gi) et je listerai exactement ce qui manque."
          : "I cannot reliably infer a full kit baseline from the current cart yet. Add at least one core discipline item (for example gloves, wraps, shin guards, or gi pieces), and I will list exactly what is missing.",
        guidanceBlocks: [
          buildFallbackBlock(
            lang === "fr"
              ? "Aucune base de kit complète détectée. Posez la question après avoir ajouté un article de discipline principale."
              : "No complete kit baseline was detected for these cart lines. Ask again after adding a core discipline item, and I will return missing essentials first.",
            lang,
          ),
          ...(intelligence.sizeBlock ? [intelligence.sizeBlock] : []),
        ],
      }, features);
    }

    return buildFeatureAwareReply({
      text: lang === "fr"
        ? summaryParts.length > 0
          ? `Voici les manques prioritaires que je peux déduire de votre panier actuel. ${summaryParts.join(" ")}`
          : "Voici les manques prioritaires que je peux déduire de votre panier actuel."
        : summaryParts.length > 0
          ? `Here are the highest-priority gaps I can infer from your current cart. ${summaryParts.join(" ")}`
          : "Here are the highest-priority gaps I can infer from your current cart.",
      guidanceBlocks: [recommendationBlock, ...(intelligence.sizeBlock ? [intelligence.sizeBlock] : [])],
    }, features);
  }

  if (latestMessage.includes("missing") || latestMessage.includes("budget") || /optimi[sz]/.test(latestMessage)) {
    return buildFeatureAwareReply({
      text: lang === "fr"
        ? summaryParts.length > 0
          ? `J'ai préparé un plan d'optimisation budgétaire. Consultez les modifications proposées ci-dessous, puis choisissez d'appliquer ou de refuser. ${summaryParts.join(" ")}`
          : "J'ai préparé un plan d'optimisation budgétaire. Consultez les modifications proposées ci-dessous, puis choisissez d'appliquer ou de refuser."
        : summaryParts.length > 0
          ? `I prepared a budget optimization plan for your target. Review the proposed changes below, then choose whether to apply or decline. ${summaryParts.join(" ")}`
          : "I prepared a budget optimization plan for your target. Review the proposed changes below, then choose whether to apply or decline.",
      guidanceBlocks: [],
    }, features);
  }

  if (latestMessage.includes("compare")) {
    return buildFeatureAwareReply({
      text: lang === "fr"
        ? "Voici une comparaison rapide des articles actuellement dans le panier."
        : "Here is a quick comparison based on the items currently in the cart.",
      guidanceBlocks: [buildComparisonBlock(input)],
    }, features);
  }

  if (latestMessage.includes("size") || latestMessage.includes("fit")) {
    return buildFeatureAwareReply({
      text: lang === "fr"
        ? intelligence.sizeIssueCount > 0
          ? "Voici le guide de taille basé sur les règles enregistrées, les signaux de profil et les vérifications de cohérence."
          : "Voici le guide de taille que je peux déduire du panier actuel."
        : intelligence.sizeIssueCount > 0
          ? "Here is fit guidance from stored size rules, profile signals, and cart-level consistency checks."
          : "Here is the fit guidance I can infer from the current cart.",
      guidanceBlocks: [sizeGuidanceBlock, recommendationBlock],
    }, features);
  }

  return buildFeatureAwareReply({
    text: lang === "fr"
      ? summaryParts.length > 0
        ? `Voici des recommandations personnalisées pour votre panier. ${summaryParts.join(" ")}`
        : "Voici une recommandation personnalisée basée sur les articles actuels de votre panier."
      : summaryParts.length > 0
        ? `Here are cart-specific recommendations grounded in your shop data. ${summaryParts.join(" ")}`
        : "Here is a relevant, cart-specific recommendation based on your current items.",
    guidanceBlocks: [recommendationBlock, ...(intelligence.sizeBlock ? [intelligence.sizeBlock] : [])],
  }, features);
}

// ─── Compatible-add: knowledge-graph powered proposal ───────────────────────

// Detects add-intent messages that reference a cart item as context
// (mirrors the REFERENCE_RELATION_PATTERN guard in tools.ts — keep in sync).
const COMPATIBLE_RELATION_PHRASE_RE =
  /\b(?:compatible\s+(?:with|avec|a|au)?|(?:for|pour|for\s+this|pour\s+ce[tte]?|for\s+my|pour\s+mon(?:ma)?)|(?:with|avec)|(?:that\s+goes?\s+with|qui\s+va\s+avec)|(?:qui\s+correspond\s+(?:a|au|avec)|correspond\s+(?:a|au|avec))|(?:to\s+use\s+with|a\s+utiliser\s+avec))\s+/i;

function normalizeForCompatSearch(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function shuffleArray<T>(array: T[]): T[] {
  const result = array.slice();
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j]!, result[i]!];
  }
  return result;
}

function scoreCompatibleProduct(
  product: { title: string; tags: string[]; categoryTags: string[]; disciplineTags: string[] },
  tokens: string[],
) {
  const haystack = normalizeForCompatSearch(
    [product.title, ...product.tags, ...product.categoryTags, ...product.disciplineTags].join(" "),
  );
  return tokens.reduce((score, token) => score + (haystack.includes(token) ? 1 : 0), 0);
}

function hasPositiveInventory(variant: { inventoryQuantity: number | null }) {
  return (variant.inventoryQuantity ?? 0) > 0;
}

type CatalogCompatibilityRole = "gloves" | "shin_guards" | "gi" | "top" | "bottom" | "protective" | "unknown";

function detectCatalogCompatibilityRole(text: string): CatalogCompatibilityRole {
  const haystack = normalizeForCompatSearch(text);

  if (/\b(wraps?|bandages?|bandes?|mouthguards?|protege-dents|protection|protective)\b/.test(haystack)) return "protective";
  if (/\b(glove|gloves|gants?|boxing-gloves|gant-de-boxe|gants-de-boxe)\b/.test(haystack)) return "gloves";
  if (/\b(shin|tibia|prot[eè]ge-tibias?|shin-guards?)\b/.test(haystack)) return "shin_guards";
  if (/\b(gi|kimono|bjj|jiu-jitsu)\b/.test(haystack)) return "gi";
  if (/\b(pants?|pantalons?|trousers?|joggers?|legging|leggings|spats|shorts?|fight-shorts?|fightshort)\b/.test(haystack)) return "bottom";
  if (/\b(t-?shirt|tee|top|tops|shirt|dry-tech|rashguard|vetement|v[eê]tement)\b/.test(haystack)) return "top";

  return "unknown";
}

function detectProductCompatibilityRole(product: { title: string; tags: string[]; categoryTags: string[]; disciplineTags: string[] }) {
  return detectCatalogCompatibilityRole([product.title, ...product.tags, ...product.categoryTags, ...product.disciplineTags].join(" "));
}

function excludesSameApparelRole(
  product: { title: string; tags: string[]; categoryTags: string[]; disciplineTags: string[] },
  sourceRoles: Set<CatalogCompatibilityRole>,
) {
  const productRole = detectProductCompatibilityRole(product);
  // exclude same-role duplicates for all gear/apparel categories
  const singleRoleCategories = new Set<CatalogCompatibilityRole>(["gloves", "shin_guards", "gi", "top", "bottom"]);
  return !(singleRoleCategories.has(productRole) && sourceRoles.has(productRole));
}

function isLikelySameAsCartProduct(
  product: { shopifyProductId: string; title: string; tags: string[]; categoryTags: string[]; disciplineTags: string[] },
  cartShopifyProductIds: Set<string>,
  cartTitles: string[],
  sourceRoles: Set<CatalogCompatibilityRole>,
) {
  if (cartShopifyProductIds.has(product.shopifyProductId)) {
    return true;
  }

  const productRole = detectProductCompatibilityRole(product);
  if (!sourceRoles.has(productRole)) {
    return false;
  }

  const productTitle = normalizeForCompatSearch(product.title);
  const productTokens = tokenizeCatalogTitle(product.title);

  return cartTitles.some((cartTitleRaw) => {
    const cartTitle = normalizeForCompatSearch(cartTitleRaw);
    if (!cartTitle) {
      return false;
    }

    if (productTitle.includes(cartTitle) || cartTitle.includes(productTitle)) {
      return true;
    }

    const cartTokens = tokenizeCatalogTitle(cartTitleRaw);
    let overlap = 0;
    for (const token of cartTokens) {
      if (productTokens.has(token)) {
        overlap += 1;
      }
    }

    return overlap >= Math.max(3, Math.ceil(cartTokens.size * 0.65));
  });
}

function inferComplementSearchTerms(
  matchedLines: Array<ResolvedCartLine & { productRow: NonNullable<ResolvedCartLine["productRow"]> }>,
) {
  const terms = new Set<string>();
  const contextTitles: string[] = [];

  for (const line of matchedLines) {
    const haystack = normalizeForCompatSearch([
      line.inputLine.productTitle,
      line.productRow.title,
      ...line.productRow.tags,
      ...line.productRow.categoryTags,
      ...line.productRow.disciplineTags,
    ].filter(Boolean).join(" "));

    contextTitles.push(line.inputLine.productTitle || line.productRow.title);

    const role = detectCatalogCompatibilityRole(haystack);

    if (role === "gloves") {
      ["wraps", "hand-wraps", "bandages", "bandage", "bandes", "bande", "bandes-de-boxe", "mouthguard", "mouthguards", "protege-dents", "protection", "protective"].forEach((term) => terms.add(term));
    }

    if (role === "shin_guards") {
      ["ankle", "ankle-guards", "foot-protection", "protection", "protective", "tape"].forEach((term) => terms.add(term));
    }

    if (role === "gi") {
      ["belt", "ceinture", "rashguard", "mouthguard", "protege-dents", "protection"].forEach((term) => terms.add(term));
    }

    if (role === "top") {
      ["shorts", "fight-shorts", "fightshort", "rashguard", "compression", "leggings", "spats", "apparel", "bottoms"].forEach((term) => terms.add(term));
    }

    if (role === "bottom") {
      ["rashguard", "t-shirt", "tee", "top", "tops", "shirt", "compression", "protection", "protective"].forEach((term) => terms.add(term));
    }
  }

  return {
    terms: Array.from(terms),
    contextTitle: contextTitles[0] ?? "your cart",
  };
}

function buildInferredCatalogProductFilters(terms: string[]) {
  return [
    { tags: { hasSome: terms } },
    { categoryTags: { hasSome: terms } },
    ...terms.map((term) => ({ title: { contains: term.replace(/-/g, " "), mode: "insensitive" as const } })),
  ];
}

async function buildDatabaseComplementRecommendations(
  input: StorefrontChatRequest,
  matchedLines: Array<ResolvedCartLine & { productRow: NonNullable<ResolvedCartLine["productRow"]> }>,
  lang: "fr" | "en" = "en",
): Promise<RecommendationItem[]> {
  const cartInternalIds = new Set(matchedLines.map((line) => line.productRow.id));
  const cartShopifyProductIds = new Set(input.cart.items.map((line) => toProductGid(line.productId)));
  const cartTitles = input.cart.items.map((line) => line.productTitle).filter((value): value is string => Boolean(value));
  const relationshipSets = await Promise.all(
    matchedLines.map((line) => getActiveRelationshipsForProduct(input.shop, line.productRow.id).catch(() => [])),
  );
  const complementStrengthById = new Map<string, number>();
  const complementContextById = new Map<string, string>();

  for (let index = 0; index < relationshipSets.length; index += 1) {
    const sourceLine = matchedLines[index];
    if (!sourceLine) continue;

    for (const relationship of relationshipSets[index] ?? []) {
      if (relationship.relationshipType !== "COMPLEMENTS") continue;
      const complementId = relationship.sourceProductId === sourceLine.productRow.id
        ? relationship.targetProductId
        : relationship.sourceProductId;

      if (cartInternalIds.has(complementId)) continue;

      const currentStrength = complementStrengthById.get(complementId) ?? -1;
      if ((relationship.strength ?? 0) >= currentStrength) {
        complementStrengthById.set(complementId, relationship.strength ?? 0);
        complementContextById.set(complementId, sourceLine.inputLine.productTitle || sourceLine.productRow.title);
      }
    }
  }

  const complementIds = Array.from(complementStrengthById.keys());
  const inferredSearch = inferComplementSearchTerms(matchedLines);
  const inferredProductFilters = buildInferredCatalogProductFilters(inferredSearch.terms);
  const sourceCompatibilityRoles = new Set(matchedLines.map((line) => detectProductCompatibilityRole(line.productRow)));
  if (complementIds.length === 0 && inferredSearch.terms.length === 0) return [];

  let products = await (db.product.findMany({
    where: complementIds.length > 0
      ? {
          shop: input.shop,
          id: { in: complementIds },
          status: "ACTIVE",
        }
      : {
          shop: input.shop,
          status: "ACTIVE",
          NOT: [
            { id: { in: Array.from(cartInternalIds) } },
            { shopifyProductId: { in: Array.from(cartShopifyProductIds) } },
          ],
          OR: inferredProductFilters,
        },
    orderBy: { title: "asc" },
    take: 20,
    select: {
      id: true,
      shopifyProductId: true,
      title: true,
      handle: true,
      tags: true,
      disciplineTags: true,
      categoryTags: true,
      variants: {
        orderBy: { inventoryQuantity: "desc" },
        take: 3,
        select: {
          id: true,
          shopifyVariantId: true,
          title: true,
          inventoryQuantity: true,
          price: true,
          imageUrl: true,
        },
      },
    },
  }) ?? Promise.resolve([])).catch(() => []);

  // sort by relationship strength desc, shuffle only for tie-breaking
  products = products.slice().sort((a, b) => (
    (complementStrengthById.get(b.id) ?? 0) - (complementStrengthById.get(a.id) ?? 0)
    || Math.random() - 0.5
  ));

  if (products.length === 0 && complementIds.length > 0 && inferredSearch.terms.length > 0) {
    products = await (db.product.findMany({
      where: {
        shop: input.shop,
        status: "ACTIVE",
        NOT: [
          { id: { in: Array.from(cartInternalIds) } },
          { shopifyProductId: { in: Array.from(cartShopifyProductIds) } },
        ],
        OR: inferredProductFilters,
      },
      orderBy: { title: "asc" },
      take: 20,
      select: {
        id: true,
        shopifyProductId: true,
        title: true,
        handle: true,
        tags: true,
        disciplineTags: true,
        categoryTags: true,
        variants: {
          orderBy: { inventoryQuantity: "desc" },
          take: 3,
          select: {
            id: true,
            shopifyVariantId: true,
            title: true,
            inventoryQuantity: true,
            price: true,
            imageUrl: true,
          },
        },
      },
    }) ?? Promise.resolve([])).catch(() => []);
    // for inferred search fallback, randomize to avoid always showing same catalog order
    products = shuffleArray(products);
  }

  return products
    .filter((product) => !isLikelySameAsCartProduct(product, cartShopifyProductIds, cartTitles, sourceCompatibilityRoles))
    .filter((product) => excludesSameApparelRole(product, sourceCompatibilityRoles))
    .slice(0, 6)
    .map((product) => {
      const variant = product.variants.find(hasPositiveInventory);
      if (!variant) return null;

      const isSafetyProduct = (product.tags ?? []).some((tag) => /protect|safety|protection|bandage|wrap/i.test(tag));
      const contextTitle = complementContextById.get(product.id) ?? inferredSearch.contextTitle ?? (lang === "fr" ? "votre panier" : "your cart");
      const price = variant.price !== null && variant.price !== undefined ? Number(variant.price) : null;
      const variantLabel = variant.title && variant.title !== "Default Title" ? variant.title : undefined;

      const recommendation: RecommendationItem = {
        productId: product.shopifyProductId,
        productTitle: product.title,
        variantId: variant.shopifyVariantId,
        ...(variantLabel ? { variantTitle: variantLabel } : {}),
        ...(variant.imageUrl ? { imageUrl: variant.imageUrl } : {}),
        ...(product.handle ? { productHandle: product.handle } : {}),
        title: product.title,
        action: "add" as const,
        priorityLabel: (complementStrengthById.get(product.id) ?? 0.65) >= 0.75 ? "high" as const : "medium" as const,
        reason: lang === "fr"
          ? `${product.title} est relié dans le catalogue comme complément compatible avec ${contextTitle}.`
          : `${product.title} is linked in the catalog as a compatible complement for ${contextTitle}.`,
        shopperOutcome: lang === "fr"
          ? "Ajoute un produit réel de la boutique qui complète l'article déjà au panier."
          : "Adds a real shop product that complements the item already in the cart.",
        safetyCritical: isSafetyProduct,
        ...(price && price > 0 ? { priceLabel: new Intl.NumberFormat(lang === "fr" ? "fr-FR" : "en-US", { style: "currency", currency: input.cart.currencyCode }).format(price) } : {}),
        availability: "available" as const,
        evidenceTags: ["compatibility" as const, ...(isSafetyProduct ? ["safety" as const] : [])],
      };

      return recommendation;
    })
    .filter((item): item is RecommendationItem => item !== null)
    .sort((left, right) => (
      (right.safetyCritical ? 1 : 0) - (left.safetyCritical ? 1 : 0)
      || ({ high: 2, medium: 1, low: 0 }[right.priorityLabel] - { high: 2, medium: 1, low: 0 }[left.priorityLabel])
    ));
}

function isCompatibleDiscoveryIntent(message: string) {
  return /\b(add|ajoute|donne|insert|include|find|cherche|trouve|recommend|recommande|suggest|suggere|propose|show|affiche|montre|help|accorde|accordent|associe|associer|complete|completer|works|goes|pair)\b/.test(message);
}

function isDisplayRequestedProductIntent(message: string) {
  return /\b(affiche|montre|show|display|voir|visualise|visualiser)\b/.test(message);
}

function stripRequestedProductTitle(value: string) {
  return value
    .replace(/^[\s"'“”‘’*:_-]+|[\s"'“”‘’*:_-]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenizeCatalogTitle(value: string) {
  const tokens = new Set<string>();

  for (const token of normalizeForCompatSearch(value).split(/[^a-z0-9]+/)) {
    if (token.length < 3) continue;
    tokens.add(token);
    if (token.endsWith("s") && token.length > 4) {
      tokens.add(token.slice(0, -1));
    }
  }

  return tokens;
}

function titleMatchScore(requestedTitle: string, candidateTitle: string) {
  const requested = normalizeForCompatSearch(requestedTitle);
  const candidate = normalizeForCompatSearch(candidateTitle);

  if (!requested || !candidate) {
    return 0;
  }

  if (candidate.includes(requested) || requested.includes(candidate)) {
    return 100;
  }

  const requestedTokens = tokenizeCatalogTitle(requestedTitle);
  const candidateTokens = tokenizeCatalogTitle(candidateTitle);
  let overlap = 0;

  for (const token of requestedTokens) {
    if (candidateTokens.has(token)) {
      overlap += 1;
    }
  }

  return overlap;
}

function getRememberedCatalogActionCandidates(input: StorefrontChatRequest, titles: string[]) {
  const candidates = catalogActionCandidateStore.get(catalogActionCandidateStoreKey(input.shop, input.sessionKey)) ?? [];
  if (titles.length === 0 || candidates.length === 0) {
    return [];
  }

  return titles
    .flatMap((title) => candidates.map((candidate) => ({
      candidate,
      score: titleMatchScore(title, candidate.title),
      requestedTokenCount: tokenizeCatalogTitle(title).size,
    })))
    .filter((entry) => entry.score >= Math.max(2, Math.ceil(entry.requestedTokenCount * 0.45)))
    .sort((left, right) => right.score - left.score)
    .map((entry) => entry.candidate)
    .filter((candidate, index, all) => all.findIndex((item) => item.shopifyProductId === candidate.shopifyProductId) === index)
    .slice(0, 6);
}

function extractPreviouslyRecommendedProductTitles(input: StorefrontChatRequest) {
  const latest = input.messages[input.messages.length - 1]?.content ?? "";
  if (!isDisplayRequestedProductIntent(normalizeForCompatSearch(latest))) {
    return [];
  }

  const assistantMessages = input.messages
    .filter((message) => message.role === "assistant")
    .map((message) => message.content)
    .reverse();
  const titles: string[] = [];

  for (const content of assistantMessages) {
    const patterns = [
      /je\s+vous\s+recommande\s+(?:d['’]ajouter\s+)?(?:les?|la|des?)?\s*([^\n.?!]+)/gi,
      /i\s+recommend\s+(?:adding\s+)?(?:the\s+)?([^\n.?!]+)/gi,
      /rechercher\s+["“]([^"”]+)["”]/gi,
      /search\s+(?:for\s+)?["“]([^"”]+)["”]/gi,
    ];

    for (const pattern of patterns) {
      for (const match of content.matchAll(pattern)) {
        const title = stripRequestedProductTitle(match[1] ?? "");
        if (title.length >= 4) {
          titles.push(title);
        }
      }
    }

    if (titles.length > 0) {
      break;
    }
  }

  return Array.from(new Set(titles)).slice(0, 3);
}

function extractCompatibleTargetTokens(text: string) {
  const genericWords = new Set([
    "add",
    "ajoute",
    "insert",
    "include",
    "find",
    "cherche",
    "trouve",
    "recommend",
    "recommande",
    "suggest",
    "suggere",
    "propose",
    "show",
    "montre",
    "help",
    "me",
    "to",
    "with",
    "for",
    "un",
    "une",
    "des",
    "a",
    "an",
    "some",
    "le",
    "la",
    "les",
    "du",
    "de",
    "article",
    "articles",
    "product",
    "products",
    "produit",
    "produits",
    "item",
    "items",
    "accessory",
    "accessoire",
    "compatible",
    "correspond",
    "correspondre",
    "accorde",
    "accordent",
    "associe",
    "associer",
    "bien",
    "deja",
    "present",
    "presents",
    "panier",
    "votre",
    "qui",
    "quoi",
    "est",
    "works",
    "well",
    "goes",
    "pair",
  ]);

  return text
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 3 && !genericWords.has(token));
}

function buildCompatibleAddToCartAction(input: StorefrontChatRequest, productTitle: string, variantId: string, variantTitle?: string, imageUrl?: string, productHandle?: string): CartToolAction {
  const actionId = crypto.randomUUID();
  const token = issueActionConfirmationToken({
    actionId,
    shop: input.shop,
    sessionKey: input.sessionKey,
    cartId: input.cart.cartId,
  });
  const variantLabel = variantTitle && variantTitle !== "Default Title" ? ` / ${variantTitle}` : "";
  const action: CartToolAction = {
    actionId,
    toolName: "addToCart",
    shop: input.shop,
    sessionKey: input.sessionKey,
    ...(input.cart.cartId ? { cartId: input.cart.cartId } : {}),
    payload: {
      actionType: "add",
      merchandiseId: variantId,
      quantity: 1,
    },
    preview: {
      after: `Add 1 x ${productTitle}${variantLabel}`,
      ...(imageUrl ? { imageUrl } : {}),
      ...(productHandle ? { productHandle } : {}),
    },
    confirmationToken: token.token,
    expiresAt: token.expiresAt,
  };

  createCartToolActionRecord({
    actionId,
    shop: action.shop,
    sessionKey: action.sessionKey,
    cartId: action.cartId,
    payload: action.payload,
  });

  return action;
}

async function resolvePreviouslyRecommendedDisplayActions(input: StorefrontChatRequest): Promise<CartToolAction[]> {
  const titles = extractPreviouslyRecommendedProductTitles(input);
  if (titles.length === 0) {
    return [];
  }

  const rememberedCandidates = getRememberedCatalogActionCandidates(input, titles);
  if (rememberedCandidates.length > 0) {
    return rememberedCandidates.map((candidate) => buildCompatibleAddToCartAction(
      input,
      candidate.title,
      candidate.variantId,
      candidate.variantTitle,
      candidate.imageUrl,
      candidate.productHandle,
    ));
  }

  const products = await db.product.findMany({
    where: {
      shop: input.shop,
      status: "ACTIVE",
      OR: titles.map((title) => ({ title: { contains: title, mode: "insensitive" as const } })),
    },
    orderBy: { title: "asc" },
    take: 6,
    select: {
      title: true,
      handle: true,
      variants: {
        orderBy: { inventoryQuantity: "desc" },
        take: 3,
        select: {
          shopifyVariantId: true,
          title: true,
          inventoryQuantity: true,
          imageUrl: true,
        },
      },
    },
  }).catch(() => []);

  return products
    .map((product) => {
      const variant = product.variants.find(hasPositiveInventory);
      return variant
        ? buildCompatibleAddToCartAction(input, product.title, variant.shopifyVariantId, variant.title, variant.imageUrl ?? undefined, product.handle)
        : null;
    })
    .filter((action): action is CartToolAction => action !== null);
}

/**
 * When a shopper says "add boxing gloves compatible with this short" or
 * "find an article compatible with these gloves", look up
 * COMPLEMENTS relationships in the knowledge graph for the referenced cart
 * product and propose addToCart actions for matching compatible products.
 * Returns an empty array if intent cannot be resolved or no match is found.
 */
export async function resolveCompatibleAddActionProposals(
  input: StorefrontChatRequest,
): Promise<CartToolAction[]> {
  const latest = input.messages[input.messages.length - 1]?.content ?? "";
  const normalized = normalizeForCompatSearch(latest);

  const displayActions = await resolvePreviouslyRecommendedDisplayActions(input);
  if (displayActions.length > 0) {
    return displayActions;
  }

  // Must be an add/discovery intent with a reference-relation phrase
  if (!isCompatibleDiscoveryIntent(normalized)) return [];
  if (!COMPATIBLE_RELATION_PHRASE_RE.test(normalized)) return [];

  // Split on the reference phrase: [before] [after]
  const parts = normalized.split(COMPATIBLE_RELATION_PHRASE_RE);
  const beforeRef = parts[0] ?? "";
  const afterRef = parts[1]?.trim() ?? normalized;

  const searchTokens = extractCompatibleTargetTokens(beforeRef);

  // Resolve cart lines to DB product records
  const resolvedLines = await resolveCartLines(input).catch(() => [] as ResolvedCartLine[]);

  // Identify the referenced cart item from the text after the relation phrase
  const explicitlyReferencedLine = resolvedLines.find((line) => {
    const title = line.inputLine.productTitle;
    if (!title) return false;
    const normalizedTitle = normalizeForCompatSearch(title);
    return normalizedTitle
      .split(/[^a-z0-9]+/)
      .some((t) => t.length >= 4 && afterRef.includes(t));
  });
  const referencedLine = explicitlyReferencedLine ?? resolvedLines[0];

  if (!referencedLine?.productRow?.id) return [];
  const catalogSearchLines = explicitlyReferencedLine?.productRow
    ? [explicitlyReferencedLine as ResolvedCartLine & { productRow: NonNullable<ResolvedCartLine["productRow"]> }]
    : resolvedLines.filter((line): line is ResolvedCartLine & { productRow: NonNullable<ResolvedCartLine["productRow"]> } => Boolean(line.productRow));

  // Query COMPLEMENTS relationships for the referenced product
  const relationships = await getActiveRelationshipsForProduct(
    input.shop,
    referencedLine.productRow.id,
  ).catch(() => []);

  const complementIds = relationships
    .filter((r) => r.relationshipType === "COMPLEMENTS")
    .map((r) =>
      r.sourceProductId === referencedLine.productRow!.id ? r.targetProductId : r.sourceProductId,
    );

  const complementStrengthById = new Map(
    relationships
      .filter((r) => r.relationshipType === "COMPLEMENTS")
      .map((r) => [
        r.sourceProductId === referencedLine.productRow!.id ? r.targetProductId : r.sourceProductId,
        r.strength ?? 0,
      ]),
  );

  if (complementIds.length === 0) {
    if (searchTokens.length > 0) return [];

    const catalogRecommendations = await buildDatabaseComplementRecommendations(
      input,
      catalogSearchLines,
      detectMessageLanguage(latest),
    );
    return catalogRecommendations
      .filter((item) => item.action === "add" && item.variantId)
      .slice(0, 6)
      .map((item) => buildCompatibleAddToCartAction(input, item.title, item.variantId!, item.variantTitle, item.imageUrl, item.productHandle));
  }

  // Fetch compatible products with up to 3 variants for availability check
  const relatedProducts = await db.product.findMany({
    where: {
      shop: input.shop,
      id: { in: complementIds },
      status: "ACTIVE",
    },
    select: {
      id: true,
      shopifyProductId: true,
      title: true,
      handle: true,
      tags: true,
      disciplineTags: true,
      categoryTags: true,
      variants: {
        orderBy: { inventoryQuantity: "desc" },
        take: 3,
        select: {
          id: true,
          shopifyVariantId: true,
          title: true,
          inventoryQuantity: true,
          imageUrl: true,
        },
      },
    },
  }).catch(() => []);

  if (relatedProducts.length === 0) {
    if (searchTokens.length > 0) return [];

    const catalogRecommendations = await buildDatabaseComplementRecommendations(
      input,
      catalogSearchLines,
      detectMessageLanguage(latest),
    );
    return catalogRecommendations
      .filter((item) => item.action === "add" && item.variantId)
      .slice(0, 6)
      .map((item) => buildCompatibleAddToCartAction(input, item.title, item.variantId!, item.variantTitle, item.imageUrl, item.productHandle));
  }

  // Score each product. If the shopper asked generically for an "article" or
  // "product", prefer the strongest graph complement instead of requiring a
  // keyword match against generic words.
  const sourceCompatibilityRoles = new Set(catalogSearchLines.map((line) => detectProductCompatibilityRole(line.productRow)));
  const scoredProducts = relatedProducts
    .filter((product) => searchTokens.length > 0 || excludesSameApparelRole(product, sourceCompatibilityRoles))
    .map((product) => ({
      product,
      tokenScore: scoreCompatibleProduct(product, searchTokens),
      relationshipStrength: complementStrengthById.get(product.id) ?? 0,
      _rand: Math.random(),
    }))
    .sort((a, b) => (
      b.tokenScore - a.tokenScore
      || b.relationshipStrength - a.relationshipStrength
      || a._rand - b._rand
    ));
  const matchingProducts = (searchTokens.length > 0
    ? scoredProducts.filter(({ tokenScore }) => tokenScore > 0)
    : scoredProducts)
    .slice(0, 6);

  const explicitActions = matchingProducts
    .map(({ product }) => {
      const variant = product.variants.find(hasPositiveInventory);
      return variant
        ? buildCompatibleAddToCartAction(input, product.title, variant.shopifyVariantId, variant.title, variant.imageUrl ?? undefined, product.handle)
        : null;
    })
    .filter((action): action is CartToolAction => action !== null);

  // Supplement with catalog-inferred recommendations when explicit complements are few
  if (explicitActions.length < 6) {
    const alreadyFoundShopifyIds = new Set(matchingProducts.map(({ product }) => product.shopifyProductId));
    const supplemental = await buildDatabaseComplementRecommendations(
      input,
      catalogSearchLines,
      detectMessageLanguage(latest),
    );
    const extras = supplemental
      .filter((item) => item.action === "add" && item.variantId && item.productId && !alreadyFoundShopifyIds.has(item.productId))
      .slice(0, 6 - explicitActions.length)
      .map((item) => buildCompatibleAddToCartAction(input, item.title, item.variantId!, item.variantTitle, item.imageUrl, item.productHandle));
    return [...explicitActions, ...extras];
  }

  return explicitActions;
}

export async function resolveCompatibleAddActionProposal(
  input: StorefrontChatRequest,
): Promise<CartToolAction | null> {
  const proposals = await resolveCompatibleAddActionProposals(input);
  return proposals[0] ?? null;
}

export async function buildStorefrontChatStreamParts(
  input: StorefrontChatRequest,
  behavior?: AIBehaviorDraftPayload,
): Promise<StorefrontChatStreamPart[]> {
  const reply = await buildStorefrontChatReply(input, behavior);
  const messageId = `${input.sessionKey}-assistant-${input.messages.length}`;

  return [
    {
      type: "text-delta",
      text: reply.text,
    },
    ...reply.guidanceBlocks.map((block) => ({
      type: "guidance-block" as const,
      block,
    })),
    {
      type: "message-complete",
      messageId,
    },
  ];
}

export function createProductComparisonContext(input: {
  comparisonContextId: string;
  request: ProductComparisonRequest;
}) {
  const now = new Date().toISOString();
  const record: ProductComparisonContextRecord = {
    comparisonContextId: input.comparisonContextId,
    requestId: input.request.requestId,
    shop: input.request.shop,
    sessionKey: input.request.sessionKey,
    status: "generated",
    productRefs: input.request.productRefs,
    createdAt: now,
    updatedAt: now,
  };

  productComparisonContextStore.set(record.comparisonContextId, record);
  return record;
}

export function getProductComparisonContext(comparisonContextId: string) {
  return productComparisonContextStore.get(comparisonContextId);
}

export function validateProductComparisonContextScope(input: {
  comparisonContextId: string;
  shop: string;
  sessionKey: string;
}) {
  const record = getProductComparisonContext(input.comparisonContextId);

  if (!record) {
    return { ok: false as const, code: "CONTEXT_NOT_FOUND", message: "Comparison context was not found." };
  }

  if (record.shop !== input.shop || record.sessionKey !== input.sessionKey) {
    return { ok: false as const, code: "CONTEXT_SCOPE_MISMATCH", message: "Comparison context does not match this session." };
  }

  return { ok: true as const, record };
}

export function setProductComparisonContextResult(input: {
  comparisonContextId: string;
  result: ProductComparisonResult;
}) {
  const current = getProductComparisonContext(input.comparisonContextId);

  if (!current) {
    return null;
  }

  const updated: ProductComparisonContextRecord = {
    ...current,
    status: "generated",
    result: input.result,
    updatedAt: new Date().toISOString(),
  };

  productComparisonContextStore.set(updated.comparisonContextId, updated);
  return updated;
}

export function setProductComparisonContextError(input: {
  comparisonContextId: string;
  error: ProductComparisonError;
}) {
  const current = getProductComparisonContext(input.comparisonContextId);

  if (!current) {
    return null;
  }

  const updated: ProductComparisonContextRecord = {
    ...current,
    status: "failed",
    error: input.error,
    updatedAt: new Date().toISOString(),
  };

  productComparisonContextStore.set(updated.comparisonContextId, updated);
  return updated;
}

export function createBudgetOptimizationContext(input: {
  optimizationContextId: string;
  request: BudgetOptimizationRequest;
}) {
  const now = new Date().toISOString();
  const record: BudgetOptimizationContextRecord = {
    optimizationContextId: input.optimizationContextId,
    requestId: input.request.requestId,
    shop: input.request.shop,
    sessionKey: input.request.sessionKey,
    status: "generated",
    targetBudgetAmount: input.request.targetBudgetAmount,
    currencyCode: input.request.currencyCode,
    createdAt: now,
    updatedAt: now,
  };

  budgetOptimizationContextStore.set(record.optimizationContextId, record);
  return record;
}

export function getBudgetOptimizationContext(optimizationContextId: string) {
  return budgetOptimizationContextStore.get(optimizationContextId);
}

export function validateBudgetOptimizationContextScope(input: {
  optimizationContextId: string;
  shop: string;
  sessionKey: string;
}) {
  const record = getBudgetOptimizationContext(input.optimizationContextId);

  if (!record) {
    return { ok: false as const, code: "CONTEXT_NOT_FOUND", message: "Budget optimization context was not found." };
  }

  if (record.shop !== input.shop || record.sessionKey !== input.sessionKey) {
    return { ok: false as const, code: "CONTEXT_SCOPE_MISMATCH", message: "Budget optimization context does not match this session." };
  }

  return { ok: true as const, record };
}

export function setBudgetOptimizationContextResult(input: {
  optimizationContextId: string;
  result: BudgetOptimizationResult;
}) {
  const current = getBudgetOptimizationContext(input.optimizationContextId);

  if (!current) {
    return null;
  }

  const updated: BudgetOptimizationContextRecord = {
    ...current,
    status: "generated",
    result: input.result,
    updatedAt: new Date().toISOString(),
  };

  budgetOptimizationContextStore.set(updated.optimizationContextId, updated);
  return updated;
}

export function setBudgetOptimizationContextError(input: {
  optimizationContextId: string;
  error: BudgetOptimizationError;
}) {
  const current = getBudgetOptimizationContext(input.optimizationContextId);

  if (!current) {
    return null;
  }

  const updated: BudgetOptimizationContextRecord = {
    ...current,
    status: "failed",
    error: input.error,
    updatedAt: new Date().toISOString(),
  };

  budgetOptimizationContextStore.set(updated.optimizationContextId, updated);
  return updated;
}

export function buildProductComparisonDataError(input: {
  comparisonContextId: string;
  requestedRefs: string[];
  snapshots: ProductComparisonSnapshot[];
}) {
  if (input.snapshots.length < input.requestedRefs.length) {
    return {
      comparisonContextId: input.comparisonContextId,
      code: "UNRESOLVED_PRODUCT_REF" as const,
      message: "Some selected products could not be resolved for comparison.",
      retryable: true,
      suggestedNextStep: "Refresh your cart and ask CartMind to compare again.",
    };
  }

  if (input.snapshots.some((item) => item.availability === "unavailable")) {
    return {
      comparisonContextId: input.comparisonContextId,
      code: "UNAVAILABLE_VARIANT" as const,
      message: "One or more selected products are currently unavailable.",
      retryable: true,
      suggestedNextStep: "Pick available alternatives and rerun comparison.",
    };
  }

  if (input.snapshots.some((item) => item.availability === "unknown")) {
    return {
      comparisonContextId: input.comparisonContextId,
      code: "PARTIAL_DATA" as const,
      message: "Comparison data is partial for one or more products.",
      retryable: true,
      suggestedNextStep: "Try again in a moment for fresher product data.",
    };
  }

  return null;
}

function buildProductComparisonDimensions(snapshots: ProductComparisonSnapshot[]): ProductComparisonDimension[] {
  const keySpecValues = Object.fromEntries(snapshots.map((item) => {
    const firstAttribute = Object.entries(item.attributes)[0];
    const value = firstAttribute ? String(firstAttribute[1]) : "not_available";

    return [item.productId, value];
  }));

  const tradeoffValues = Object.fromEntries(snapshots.map((item) => [
    item.productId,
    item.availability === "available" ? "Ready to buy" : "Availability check recommended",
  ]));

  return [
    {
      key: "price",
      label: "Price",
      values: Object.fromEntries(snapshots.map((item) => [item.productId, item.price])),
    },
    {
      key: "availability",
      label: "Availability",
      values: Object.fromEntries(snapshots.map((item) => [item.productId, item.availability])),
    },
    {
      key: "key_specs",
      label: "Key specs",
      values: keySpecValues,
    },
    {
      key: "tradeoffs",
      label: "Trade-offs",
      values: tradeoffValues,
    },
  ];
}

function selectComparisonRecommendation(snapshots: ProductComparisonSnapshot[]) {
  const available = snapshots.find((item) => item.availability === "available") || snapshots[0];

  if (!available) {
    return undefined;
  }

  return {
    recommendedProductId: available.productId,
    rationale: `Recommended ${available.title} based on current availability and cart context.`,
    confidence: 0.62,
  };
}

export function normalizeProductComparisonResult(input: {
  comparisonContextId: string;
  request: ProductComparisonRequest;
  fetchedAt: string;
  snapshots: ProductComparisonSnapshot[];
}): ProductComparisonResult {
  const dimensions = buildProductComparisonDimensions(input.snapshots);
  const recommendation = selectComparisonRecommendation(input.snapshots);

  return {
    comparisonContextId: input.comparisonContextId,
    requestId: input.request.requestId,
    generatedAt: new Date().toISOString(),
    freshness: {
      priceCheckedAt: input.fetchedAt,
      availabilityCheckedAt: input.fetchedAt,
    },
    products: input.snapshots,
    dimensions,
    ...(recommendation ? { recommendation } : {}),
  };
}

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100;
}

export function normalizeBudgetOptimizationResult(
  result: BudgetOptimizationResult,
): BudgetOptimizationResult {
  return {
    ...result,
    baselineSubtotal: roundCurrency(result.baselineSubtotal),
    targetBudgetAmount: roundCurrency(result.targetBudgetAmount),
    projectedSubtotal: roundCurrency(result.projectedSubtotal),
    projectedGapAmount: roundCurrency(result.projectedGapAmount),
    candidates: result.candidates.map((candidate) => ({
      ...candidate,
      estimatedSavings: roundCurrency(candidate.estimatedSavings),
    })),
  };
}