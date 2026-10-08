import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { streamText } from "ai";

import type { CartToolAction, StorefrontChatRequest } from "../lib/ai/schemas";
import { StorefrontChatRequestSchema } from "../lib/ai/schemas";
import {
  buildProductComparisonDataError,
  buildStorefrontChatReply,
  createBudgetOptimizationContext,
  rememberCatalogActionCandidates,
  resolveStorefrontChatBehavior,
  resolveCompatibleAddActionProposals,
  createProductComparisonContext,
  normalizeBudgetOptimizationResult,
  resolveBudgetOptimizationStreamOutcome,
  normalizeProductComparisonResult,
  setBudgetOptimizationContextError,
  setBudgetOptimizationContextResult,
  setProductComparisonContextError,
  setProductComparisonContextResult,
} from "../lib/ai/storefront-chat";
import { buildStorefrontChatSystemPrompt } from "../lib/ai/prompts";
import { getPrimaryModel, isAIAvailable } from "../lib/ai/providers";
import {
  buildBudgetOptimizationSelectionActionProposal,
  buildBudgetOptimizationToolRequest,
  resolveCartToolActionProposal,
  type CartToolClarification,
  buildCompareProductsToolRequest,
  buildComparisonSelectionActionProposal,
  createBudgetOptimizationContextId,
  createComparisonContextId,
  getBudgetOptimizationValidationError,
  getCompareProductsValidationError,
} from "../lib/ai/tools";
import { buildBudgetOptimizationProposal } from "../lib/cart-intelligence/budget-optimization";
import { fetchBudgetOptimizationCandidates, fetchComparisonProducts } from "../lib/shopify/cart";
import {
  assertAllowedStorefrontOrigin,
  verifyStorefrontChatToken,
} from "../lib/shopify/app-proxy";
import { findSimilarProducts, getCustomerProfile } from "../lib/db/queries";
import { resolveCustomerProfile, buildProfileKey } from "../lib/cart-intelligence/customer-profile";
import { generateEmbedding } from "../lib/knowledge-graph/embeddings";

const CORS_BASE_HEADERS = {
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "content-type",
  "access-control-max-age": "86400",
};

function getCorsHeaders(request: Request) {
  const origin = request.headers.get("origin");
  return origin
    ? { ...CORS_BASE_HEADERS, "access-control-allow-origin": origin, vary: "Origin" }
    : CORS_BASE_HEADERS;
}

function encodeSseEvent(payload: unknown) {
  return `data: ${JSON.stringify(payload)}\n\n`;
}

function buildCompatibleActionIntro(latestMessage: string, count: number) {
  const isFrench = /\b(gants|avec|article|produit|trouve|cherche|recommande|compatible)\b/i.test(latestMessage);
  if (count > 1) {
    return isFrench
      ? `J'ai trouvé ${count} articles compatibles dans le catalogue. Faites défiler les propositions ci-dessous, puis validez le produit à ajouter au panier.`
      : `I found ${count} compatible products in the catalog. Swipe through the options below, then approve the product to add to cart.`;
  }

  return isFrench
    ? "J'ai trouvé un article compatible dans le catalogue. Vérifiez la proposition ci-dessous avant de l'ajouter au panier."
    : "I found a compatible product in the catalog. Review the proposed cart action below before adding it.";
}

// Reflects the deterministic cart mutation actually proposed (changeQuantity,
// swapVariant, addToCart, removeFromCart), so the conversational text never
// contradicts the action card the shopper is asked to confirm.
function buildCartMutationIntroText(action: CartToolAction | null, latestMessage: string) {
  const isFrench = /\b(mets|mettez|mettre|change|changer|modifie|modifier|passe|passer|diminue|augmente|retire|ajoute|remplace|taille|quantite|quantité|exemplaire)\b/i.test(latestMessage);
  const afterLabel = action?.preview?.after;
  const quantitySummary = action?.payload.actionType === "swap_variant"
    ? (isFrench ? ` Quantité conservée : ${action.payload.quantity}.` : ` Quantity preserved: ${action.payload.quantity}.`)
    : "";

  return isFrench
    ? (afterLabel
      ? `J'ai préparé la modification suivante : ${afterLabel}.${quantitySummary} Confirmez ci-dessous pour l'appliquer.`
      : "J'ai préparé la modification demandée pour votre panier. Confirmez ci-dessous pour l'appliquer.")
    : (afterLabel
      ? `I prepared the following cart change: ${afterLabel}.${quantitySummary} Confirm below to apply it.`
      : "I prepared the requested cart change. Confirm below to apply it.");
}

function buildCartClarificationText(clarification: CartToolClarification, latestMessage: string) {
  const isFrench = /\b(taille|remplace|mets|passe|pantalon|quantit[eé])\b/i.test(latestMessage);
  const product = clarification.productTitle || (isFrench ? "cet article" : "this item");
  const size = clarification.requestedSize?.toUpperCase();
  switch (clarification.code) {
    case "SIZE_REQUIRED":
      return isFrench
        ? "Quelle taille souhaitez-vous pour cet article ? Votre panier reste inchangé."
        : "Which size would you like for this item? Your cart is unchanged.";
    case "TARGET_REQUIRED":
      return isFrench
        ? `Je ne peux pas identifier une seule ligne du panier pour ce changement en taille ${size}. Précisez le nom complet et la taille actuelle de l'article. Votre panier reste inchangé.`
        : `I cannot identify a single cart line for the change to size ${size}. Please specify the full product name and current size. Your cart is unchanged.`;
    case "MIXED_CHANGES":
      return isFrench
        ? `Souhaitez-vous changer la taille de ${product} en conservant sa quantité, ou modifier aussi la quantité ? Votre panier reste inchangé.`
        : `Would you like to change the size of ${product} keeping its quantity, or also change the quantity? Your cart is unchanged.`;
    case "VARIANT_UNRESOLVED":
      return isFrench
        ? `Je ne peux pas confirmer une variante disponible de ${product}${size ? ` en taille ${size}` : ""} en conservant les autres options. Votre panier et sa quantité restent inchangés. Vérifiez la disponibilité sur la fiche produit ou indiquez une autre taille.`
        : `I cannot confirm an available variant of ${product}${size ? ` in size ${size}` : ""} with the other options unchanged. Your cart and quantity are unchanged. Check availability on the product page or request another size.`;
  }
}

function formatCatalogContextProduct(product: Awaited<ReturnType<typeof findSimilarProducts>>[number]) {
  const parts: string[] = [product.title, `ProductRef: ${product.shopifyProductId}`];
  if (product.productType) parts.push(`Type: ${product.productType}`);
  if (product.disciplineTags.length > 0) parts.push(`Discipline: ${product.disciplineTags.join(", ")}`);
  if (product.categoryTags.length > 0) parts.push(`Category: ${product.categoryTags.join(", ")}`);
  if (product.shopifyVariantId) parts.push(`VariantRef: ${product.shopifyVariantId}`);
  if (product.description) parts.push(product.description.slice(0, 200));
  return parts.join(" | ");
}

function normalizeCatalogText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function catalogTitleTokens(value: string) {
  return new Set(normalizeCatalogText(value).split(/[^a-z0-9]+/).filter((token) => token.length >= 4));
}

function isLikelyAlreadyInCart(
  product: Awaited<ReturnType<typeof findSimilarProducts>>[number],
  cartItems: StorefrontChatRequest["cart"]["items"],
) {
  const productTitle = normalizeCatalogText(product.title);
  const productTokens = catalogTitleTokens(product.title);

  return cartItems.some((item) => {
    if (product.shopifyProductId === item.productId) {
      return true;
    }

    const cartTitle = normalizeCatalogText(item.productTitle ?? "");
    if (!cartTitle) {
      return false;
    }

    if (productTitle.includes(cartTitle) || cartTitle.includes(productTitle)) {
      return true;
    }

    const cartTokens = catalogTitleTokens(cartTitle);
    let overlap = 0;
    for (const token of cartTokens) {
      if (productTokens.has(token)) {
        overlap += 1;
      }
    }

    return overlap >= Math.max(3, Math.ceil(cartTokens.size * 0.65));
  });
}

async function retrieveCatalogContextForChat(input: StorefrontChatRequest) {
  const latestMessage = input.messages[input.messages.length - 1]?.content ?? "";
  if (!latestMessage.trim() || !isAIAvailable()) {
    return undefined;
  }

  const cartContextText = input.cart.items
    .map((item) => `${item.productTitle ?? item.productId} ${item.variantTitle ?? ""}`.trim())
    .join("; ");
  const cartProductIds = input.cart.items.map((item) => item.productId);

  try {
    const queryEmbedding = await generateEmbedding(`${latestMessage}\nCart: ${cartContextText}`);
    const similarProducts = (await findSimilarProducts(input.shop, queryEmbedding, 8, cartProductIds))
      .filter((product) => !isLikelyAlreadyInCart(product, input.cart.items))
      .slice(0, 5);
    rememberCatalogActionCandidates({
      shop: input.shop,
      sessionKey: input.sessionKey,
      candidates: similarProducts
        .filter((product) => product.shopifyVariantId)
        .map((product) => ({
          shopifyProductId: product.shopifyProductId,
          title: product.title,
          variantId: product.shopifyVariantId!,
          ...(product.variantTitle ? { variantTitle: product.variantTitle } : {}),
          ...(product.variantImageUrl ? { imageUrl: product.variantImageUrl } : {}),
          ...(product.handle ? { productHandle: product.handle } : {}),
        })),
    });
    return similarProducts.length > 0
      ? similarProducts.map(formatCatalogContextProduct)
      : undefined;
  } catch {
    return undefined;
  }
}

export const action = async ({ request }: ActionFunctionArgs) => {
  const body = await request.json().catch(() => null);
  const parsed = StorefrontChatRequestSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json(
      {
        ok: false,
        error: parsed.error.flatten(),
      },
      { status: 400, headers: getCorsHeaders(request) },
    );
  }

  const verification = verifyStorefrontChatToken(parsed.data.streamToken);

  if (!verification.ok) {
    return Response.json(
      {
        ok: false,
        error: {
          code: verification.code,
          message: verification.message,
        },
      },
      {
        status: verification.code === "TOKEN_EXPIRED" ? 401 : 403,
        headers: getCorsHeaders(request),
      },
    );
  }

  if (
    verification.payload.shop !== parsed.data.shop
    || verification.payload.sessionKey !== parsed.data.sessionKey
    || verification.payload.cartId !== parsed.data.cart.cartId
  ) {
    return Response.json(
      {
        ok: false,
        error: {
          code: "INVALID_TOKEN_SCOPE",
          message: "Chat token scope does not match the request.",
        },
      },
      { status: 403, headers: getCorsHeaders(request) },
    );
  }

  const originCheck = assertAllowedStorefrontOrigin(request, parsed.data.shop);

  if (!originCheck.ok) {
    return Response.json(
      {
        ok: false,
        error: {
          code: originCheck.code,
          message: originCheck.message,
        },
      },
      { status: 403, headers: getCorsHeaders(request) },
    );
  }

  const behaviorResolution = await resolveStorefrontChatBehavior(parsed.data.shop);

  const sessionId = verification.payload.sessionKey.startsWith("chat_")
    ? verification.payload.sessionKey.slice(5)
    : undefined;
  const storedRecord = sessionId
    ? await getCustomerProfile(parsed.data.shop, undefined, sessionId).catch(() => null)
    : null;
  const storedProfile = storedRecord
    ? {
        profileKey: buildProfileKey(storedRecord.shop, storedRecord.shopifyCustomerId, storedRecord.sessionId),
        shop: storedRecord.shop,
        shopifyCustomerId: storedRecord.shopifyCustomerId,
        sessionId: storedRecord.sessionId,
        sizeProfile: storedRecord.sizeProfile,
        disciplineProfile: storedRecord.disciplineProfile,
        explicitProfile: storedRecord.explicitProfile,
        purchaseSummary: storedRecord.purchaseSummary,
        behaviorSummary: storedRecord.behaviorSummary,
        confidenceSummary: storedRecord.confidenceSummary,
        lastActiveAt: storedRecord.lastActiveAt,
      }
    : null;
  const resolvedProfile = resolveCustomerProfile({
    shop: parsed.data.shop,
    sessionId,
    storedProfile,
  });

  const compatibleActionProposals = await resolveCompatibleAddActionProposals(parsed.data);
  const guidanceReply = await buildStorefrontChatReply(parsed.data, behaviorResolution.config);
  const comparisonValidationError = getCompareProductsValidationError(parsed.data);
  const comparisonRequest = buildCompareProductsToolRequest(parsed.data);
  const comparisonParts = [] as Array<{ type: string; [key: string]: unknown }>;
  let comparisonActionProposal: ReturnType<typeof buildComparisonSelectionActionProposal> | null = null;
  const budgetValidationError = getBudgetOptimizationValidationError(parsed.data);
  const budgetRequest = buildBudgetOptimizationToolRequest(parsed.data);
  const budgetParts = [] as Array<{ type: string; [key: string]: unknown }>;
  let budgetActionProposal: ReturnType<typeof buildBudgetOptimizationSelectionActionProposal> | null = null;

  if (comparisonValidationError) {
    comparisonParts.push({
      type: "comparison.error",
      error: {
        comparisonContextId: "comparison-validation",
        code: comparisonValidationError.code,
        message: comparisonValidationError.message,
        retryable: true,
        suggestedNextStep: comparisonValidationError.suggestedNextStep,
      },
    });
  }

  if (budgetValidationError) {
    budgetParts.push({
      type: "budget-optimization.error",
      error: {
        optimizationContextId: "budget-validation",
        code: budgetValidationError.code,
        message: budgetValidationError.message,
        retryable: true,
        suggestedNextStep: budgetValidationError.suggestedNextStep,
      },
    });
  }

  if (budgetRequest && !budgetValidationError) {
    const optimizationContextId = createBudgetOptimizationContextId(budgetRequest.requestId);
    createBudgetOptimizationContext({
      optimizationContextId,
      request: budgetRequest,
    });

    budgetParts.push({
      type: "budget-optimization.proposed",
      optimization: {
        optimizationContextId,
        request: budgetRequest,
      },
    });

    const candidateFetch = await fetchBudgetOptimizationCandidates({
      shop: budgetRequest.shop,
      request: budgetRequest,
      cart: parsed.data.cart,
    });

    if (candidateFetch.items.length === 0) {
      const budgetError = {
        optimizationContextId,
        code: "NO_ELIGIBLE_CANDIDATES" as const,
        message: "No eligible budget optimization candidates were found for this cart.",
        retryable: true,
        suggestedNextStep: "Try increasing your budget target or adding alternatives to your cart.",
      };

      setBudgetOptimizationContextError({
        optimizationContextId,
        error: budgetError,
      });

      budgetParts.push({
        type: "budget-optimization.error",
        error: budgetError,
      });
    } else {
      const budgetResult = normalizeBudgetOptimizationResult(buildBudgetOptimizationProposal({
        optimizationContextId,
        requestId: budgetRequest.requestId,
        baselineSubtotal: candidateFetch.baselineSubtotal,
        targetBudgetAmount: budgetRequest.targetBudgetAmount,
        candidates: candidateFetch.items,
        fetchedAt: candidateFetch.fetchedAt,
      }));

      const streamOutcome = resolveBudgetOptimizationStreamOutcome({
        optimizationContextId,
        result: budgetResult,
      });

      if (streamOutcome.kind === "error") {
        setBudgetOptimizationContextError({
          optimizationContextId,
          error: streamOutcome.error,
        });

        budgetParts.push({
          type: "budget-optimization.error",
          error: streamOutcome.error,
        });
      } else {
        setBudgetOptimizationContextResult({
          optimizationContextId,
          result: budgetResult,
        });

        budgetParts.push({
          type: "budget-optimization.result",
          optimization: budgetResult,
        });

        budgetActionProposal = buildBudgetOptimizationSelectionActionProposal({
          shop: parsed.data.shop,
          sessionKey: parsed.data.sessionKey,
          cartId: parsed.data.cart.cartId,
          optimization: budgetResult,
        });
      }
    }
  }

  if (comparisonRequest && !comparisonValidationError) {
    const comparisonContextId = createComparisonContextId(comparisonRequest.requestId);
    createProductComparisonContext({
      comparisonContextId,
      request: comparisonRequest,
    });

    comparisonParts.push({
      type: "comparison.proposed",
      comparison: {
        comparisonContextId,
        request: comparisonRequest,
      },
    });

    const comparisonFetch = await fetchComparisonProducts({
      shop: comparisonRequest.shop,
      productRefs: comparisonRequest.productRefs,
      cart: parsed.data.cart,
    });

    const dataError = buildProductComparisonDataError({
      comparisonContextId,
      requestedRefs: comparisonRequest.productRefs,
      snapshots: comparisonFetch.items,
    });

    if (dataError) {
      setProductComparisonContextError({
        comparisonContextId,
        error: dataError,
      });

      comparisonParts.push({
        type: "comparison.error",
        error: dataError,
      });
    } else if (comparisonFetch.items.length >= 2) {
      const comparisonResult = normalizeProductComparisonResult({
        comparisonContextId,
        request: comparisonRequest,
        fetchedAt: comparisonFetch.fetchedAt,
        snapshots: comparisonFetch.items,
      });

      setProductComparisonContextResult({
        comparisonContextId,
        result: comparisonResult,
      });

      comparisonParts.push({
        type: "comparison.result",
        comparison: comparisonResult,
      });

      comparisonActionProposal = buildComparisonSelectionActionProposal({
        shop: parsed.data.shop,
        sessionKey: parsed.data.sessionKey,
        cartId: parsed.data.cart.cartId,
        comparison: comparisonResult,
      });
    } else {
      const comparisonError = {
        comparisonContextId,
        code: "INSUFFICIENT_PRODUCTS" as const,
        message: "Please select at least two products to compare.",
        retryable: true,
        suggestedNextStep: "Add one more distinct product and ask to compare again.",
      };

      setProductComparisonContextError({
        comparisonContextId,
        error: comparisonError,
      });

      comparisonParts.push({
        type: "comparison.error",
        error: comparisonError,
      });
    }
  }

  const cartResolution = compatibleActionProposals.length > 0
    ? { status: "no_action" as const }
    : await resolveCartToolActionProposal(parsed.data);
  const cartClarification = cartResolution.status === "clarification" ? cartResolution.clarification : null;
  const cartActionProposals = compatibleActionProposals.length > 0
    ? compatibleActionProposals
    : cartResolution.status === "proposed" ? [cartResolution.action] : [];
  const toolActionEvents = [...cartActionProposals, comparisonActionProposal, budgetActionProposal]
    .filter((action): action is NonNullable<typeof action> => Boolean(action))
    .map((action) => ({
      type: "tool-action-proposed" as const,
      action,
    }));
  const toolActionStatusEvents = toolActionEvents.map((event) => ({
    type: "tool-action-status" as const,
    actionId: event.action.actionId,
    status: "proposed" as const,
    summary: "Awaiting shopper confirmation.",
  }));

  const messageId = `${parsed.data.sessionKey}-assistant-${parsed.data.messages.length}`;
  const aiEnabled = isAIAvailable();
  const latestRawMessage = parsed.data.messages[parsed.data.messages.length - 1]?.content ?? "";
  const latestMessage = latestRawMessage.toLowerCase();
  const isConfirmationReply = /^(?:oui|non|yes|no|ok|okay|confirme|je confirme|confirm|annule|cancel|applique|apply)[.!\s]*$/i.test(latestRawMessage.trim());
  const conversationLanguageText = parsed.data.messages.filter((message) => message.role === "user")
    .map((message) => message.content).join(" ");
  const confirmationReply = /\b(oui|non|confirme|annule|applique|taille|remplace|pantalon|quantit[eé])\b/i.test(conversationLanguageText)
    ? "Aucune modification du panier n'est confirmee par ce message. Utilisez Appliquer ou Ignorer sur la carte de modification souhaitee ; si elle est annulee ou expiree, demandez une nouvelle proposition."
    : "This message does not confirm a cart change. Use Apply or Ignore on the intended action card; if it was declined or expired, request a new proposal.";
  const hasCompatibleActionProposals = compatibleActionProposals.length > 0;
  // Direct mutation proposals (changeQuantity/swapVariant/addToCart/removeFromCart)
  // inferred straight from the shopper's own wording, as opposed to compatible-add
  // suggestions surfaced from catalog search.
  const hasDirectCartMutationProposal = !hasCompatibleActionProposals && cartActionProposals.length > 0;
  const replyText = isConfirmationReply ? confirmationReply : hasCompatibleActionProposals
    ? buildCompatibleActionIntro(latestMessage, compatibleActionProposals.length)
    : hasDirectCartMutationProposal
      ? buildCartMutationIntroText(cartActionProposals[0], conversationLanguageText)
      : cartClarification
        ? buildCartClarificationText(cartClarification, latestMessage)
        : guidanceReply.text;
  const guidanceBlocks = (isConfirmationReply || hasCompatibleActionProposals || hasDirectCartMutationProposal || cartClarification) ? [] : guidanceReply.guidanceBlocks;
  const shouldBypassLLM = /\b(budget|optimi[sz]|compare|add|remove|swap|quantit|quantity|size|fit|sparring|combat|taille|pratique|adapt[eé]|muay\s*thai|tha[iï]|kick\s*boxing|kickboxing|boxe|boxing|mma|recommend|recommand|suggest|sugg[eè]re|conseil|propose|s['’]?accorde|accorde|va\s+bien|works?\s+well|goes?\s+well)\b/.test(latestMessage);
  const shouldUseLLM = aiEnabled && !isConfirmationReply && !hasCompatibleActionProposals && !hasDirectCartMutationProposal && !cartClarification && !shouldBypassLLM;
  const catalogContext = shouldUseLLM
    ? await retrieveCatalogContextForChat(parsed.data)
    : undefined;
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (payload: unknown) => {
        controller.enqueue(encoder.encode(encodeSseEvent(payload)));
      };

      // 1. Texte — LLM réel ou fallback rule-based
      if (shouldUseLLM) {
        try {
          const result = streamText({
            model: getPrimaryModel(),
            system: buildStorefrontChatSystemPrompt({
              shop: parsed.data.shop,
              cart: parsed.data.cart,
              behavior: behaviorResolution.config,
              profile: resolvedProfile,
              ...(catalogContext ? { catalogContext } : {}),
            }),
            messages: parsed.data.messages
              .filter((m) => m.role === "user" || m.role === "assistant")
              .map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
            maxOutputTokens: 600,
            temperature: 0.4,
          });
          for await (const chunk of result.textStream) {
            emit({ type: "text-delta", text: chunk });
          }
        } catch {
          emit({ type: "text-delta", text: replyText });
        }
      } else {
        emit({ type: "text-delta", text: replyText });
      }

      // 2. Guidance blocks structurés (cart-aware, rule-based)
      for (const block of guidanceBlocks) {
        emit({ type: "guidance-block", block });
      }

      // 3. Résultats comparaison / budget
      for (const part of comparisonParts) { emit(part); }
      for (const part of budgetParts) { emit(part); }

      // 4. Propositions d'action panier
      for (const event of toolActionEvents) { emit(event); }
      for (const statusEvent of toolActionStatusEvents) { emit(statusEvent); }

      // 5. Fin de stream
      emit({ type: "message-complete", messageId });
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      ...getCorsHeaders(request),
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "content-type": "text/event-stream; charset=utf-8",
    },
  });
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: getCorsHeaders(request),
    });
  }

  return Response.json(
    { ok: false, error: { code: "METHOD_NOT_ALLOWED", message: "Use POST." } },
    { status: 405, headers: getCorsHeaders(request) },
  );
};