import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { streamText } from "ai";

import { StorefrontChatRequestSchema } from "../lib/ai/schemas";
import {
  buildProductComparisonDataError,
  buildStorefrontChatReply,
  createBudgetOptimizationContext,
  resolveStorefrontChatBehavior,
  resolveCompatibleAddActionProposals,
  createProductComparisonContext,
  normalizeBudgetOptimizationResult,
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
  buildCartToolActionProposal,
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
import { getCustomerProfile } from "../lib/db/queries";
import { resolveCustomerProfile, buildProfileKey } from "../lib/cart-intelligence/customer-profile";

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

  const cartActionProposals = compatibleActionProposals.length > 0
    ? compatibleActionProposals
    : [buildCartToolActionProposal(parsed.data)].filter((action): action is NonNullable<typeof action> => Boolean(action));
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
  const latestMessage = parsed.data.messages[parsed.data.messages.length - 1]?.content.toLowerCase() ?? "";
  const hasCompatibleActionProposals = compatibleActionProposals.length > 0;
  const replyText = hasCompatibleActionProposals ? buildCompatibleActionIntro(latestMessage, compatibleActionProposals.length) : guidanceReply.text;
  const guidanceBlocks = hasCompatibleActionProposals ? [] : guidanceReply.guidanceBlocks;
  const shouldBypassLLM = /\b(budget|optimi[sz]|compare|add|remove|swap|quantit|quantity|size|fit|sparring|combat|taille|adapt[eé])\b/.test(latestMessage);
  const shouldUseLLM = aiEnabled && !shouldBypassLLM;
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