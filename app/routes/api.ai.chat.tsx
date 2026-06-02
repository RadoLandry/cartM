import type { ActionFunctionArgs } from "react-router";

import { StorefrontChatRequestSchema } from "../lib/ai/schemas";
import {
  buildProductComparisonDataError,
  buildStorefrontChatStreamParts,
  createProductComparisonContext,
  normalizeProductComparisonResult,
  setProductComparisonContextError,
  setProductComparisonContextResult,
} from "../lib/ai/storefront-chat";
import {
  buildCartToolActionProposal,
  buildCompareProductsToolRequest,
  buildComparisonSelectionActionProposal,
  createComparisonContextId,
  getCompareProductsValidationError,
} from "../lib/ai/tools";
import { fetchComparisonProducts } from "../lib/shopify/cart";
import {
  assertAllowedStorefrontOrigin,
  verifyStorefrontChatToken,
} from "../lib/shopify/app-proxy";

function encodeSseEvent(payload: unknown) {
  return `data: ${JSON.stringify(payload)}\n\n`;
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
      { status: 400 },
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
      { status: verification.code === "TOKEN_EXPIRED" ? 401 : 403 },
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
      { status: 403 },
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
      { status: 403 },
    );
  }

  const streamParts = buildStorefrontChatStreamParts(parsed.data);
  const comparisonValidationError = getCompareProductsValidationError(parsed.data);
  const comparisonRequest = buildCompareProductsToolRequest(parsed.data);
  const comparisonParts = [] as Array<(typeof streamParts)[number]>;
  let comparisonActionProposal: ReturnType<typeof buildComparisonSelectionActionProposal> | null = null;

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

  const actionProposal = buildCartToolActionProposal(parsed.data);
  const toolActionEvents = [actionProposal, comparisonActionProposal]
    .filter((action): action is NonNullable<typeof action> => Boolean(action))
    .map((action) => ({
      type: "tool-action-proposed" as const,
      action,
    }));

  const partsWithToolEvents = toolActionEvents.length > 0
    ? [
      ...streamParts.filter((part) => part.type !== "message-complete"),
      ...comparisonParts,
      ...toolActionEvents,
      ...streamParts.filter((part) => part.type === "message-complete"),
    ]
    : [
      ...streamParts.filter((part) => part.type !== "message-complete"),
      ...comparisonParts,
      ...streamParts.filter((part) => part.type === "message-complete"),
    ];
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const part of partsWithToolEvents) {
        controller.enqueue(encoder.encode(encodeSseEvent(part)));
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "content-type": "text/event-stream; charset=utf-8",
      ...(originCheck.origin ? { "access-control-allow-origin": originCheck.origin } : {}),
      vary: "Origin",
    },
  });
};

export const loader = async () => Response.json({ ok: false, error: { code: "METHOD_NOT_ALLOWED", message: "Use POST." } }, { status: 405 });