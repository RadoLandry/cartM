import { z } from "zod";
import type { ActionFunctionArgs } from "react-router";

import {
  assertAllowedStorefrontOrigin,
  verifyActionConfirmationToken,
} from "../lib/shopify/app-proxy";
import {
  getCartToolActionIdempotentReplay,
  getCartToolActionRecord,
  getProductComparisonContext,
  isCartToolActionTerminalStatus,
  transitionCartToolActionRecord,
  validateProductComparisonContextScope,
} from "../lib/ai/storefront-chat";
import { storefrontCartMutationAdapter } from "../lib/shopify/storefront-cart";
import { applyComparisonSelectionToCart } from "../lib/shopify/cart";

const ConfirmCartActionRequestSchema = z.object({
  shop: z.string().min(1),
  sessionKey: z.string().min(1),
  actionId: z.string().min(1),
  confirmationToken: z.string().min(1),
  decision: z.enum(["approve", "decline"]),
  actionType: z.enum(["cart_tool", "comparison_select"]).default("cart_tool"),
  comparisonContextId: z.string().min(1).optional(),
  selectedProductId: z.string().min(1).optional(),
  selectedVariantId: z.string().min(1).optional(),
  cart: z.object({
    cartId: z.string().min(1).optional(),
    currencyCode: z.string().length(3).default("USD"),
    items: z.array(z.object({
      lineId: z.string().min(1).optional(),
      productId: z.string().min(1),
      variantId: z.string().min(1).optional(),
      quantity: z.coerce.number().int().min(1),
    })).default([]),
    subtotal: z.string().min(1).optional(),
  }).optional(),
});

export const action = async ({ request }: ActionFunctionArgs) => {
  const body = await request.json().catch(() => null);
  const parsed = ConfirmCartActionRequestSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json({ ok: false, error: parsed.error.flatten() }, { status: 400 });
  }

  const tokenCheck = verifyActionConfirmationToken(parsed.data.confirmationToken);
  if (!tokenCheck.ok) {
    return Response.json(
      {
        ok: false,
        error: {
          code: tokenCheck.code,
          message: tokenCheck.message,
          recoveryOptions: [
            "Ask the assistant to propose the action again",
            "Refresh your cart and retry",
          ],
        },
      },
      { status: tokenCheck.code === "ACTION_EXPIRED" ? 401 : 403 },
    );
  }

  if (
    tokenCheck.payload.actionId !== parsed.data.actionId
    || tokenCheck.payload.shop !== parsed.data.shop
    || tokenCheck.payload.sessionKey !== parsed.data.sessionKey
  ) {
    return Response.json(
      {
        ok: false,
        error: {
          code: "INVALID_TOKEN_SCOPE",
          message: "Confirmation token scope does not match this request.",
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

  const record = getCartToolActionRecord(parsed.data.actionId);
  if (!record) {
    return Response.json(
      {
        ok: false,
        error: {
          code: "ACTION_NOT_FOUND",
          message: "No matching cart action was found.",
        },
      },
      { status: 404 },
    );
  }

  if (isCartToolActionTerminalStatus(record.status)) {
    const replay = getCartToolActionIdempotentReplay(record.actionId);

    return Response.json({
      ok: true,
      result: replay || {
        actionId: record.actionId,
        status: record.status,
        idempotentReplay: true,
        summary: record.summary || "Action already resolved earlier.",
      },
    });
  }

  if (record.status !== "proposed") {
    return Response.json(
      {
        ok: false,
        error: {
          code: "INVALID_ACTION_STATE",
          message: `Action is currently ${record.status} and cannot accept a new decision.`,
        },
      },
      { status: 409 },
    );
  }

  const nextStatus = parsed.data.decision === "approve" ? "approved" : "declined";
  const transition = transitionCartToolActionRecord({
    actionId: parsed.data.actionId,
    nextStatus,
    summary: parsed.data.decision === "approve"
      ? "Action approved and queued for execution."
      : "No cart changes were made.",
  });

  if (!transition.ok) {
    return Response.json(
      {
        ok: false,
        error: {
          code: transition.code,
          message: transition.message,
        },
      },
      { status: 409 },
    );
  }

  if (parsed.data.decision === "approve") {
    if (parsed.data.actionType === "comparison_select") {
      if (!parsed.data.comparisonContextId || !parsed.data.selectedProductId) {
        return Response.json(
          {
            ok: false,
            error: {
              code: "INVALID_PAYLOAD",
              message: "comparisonContextId and selectedProductId are required for comparison selections.",
            },
          },
          { status: 400 },
        );
      }

      const contextScope = validateProductComparisonContextScope({
        comparisonContextId: parsed.data.comparisonContextId,
        shop: parsed.data.shop,
        sessionKey: parsed.data.sessionKey,
      });

      if (!contextScope.ok) {
        const failedTransition = transitionCartToolActionRecord({
          actionId: parsed.data.actionId,
          nextStatus: "failed",
          summary: contextScope.message,
        });

        return Response.json(
          {
            ok: false,
            error: {
              code: contextScope.code,
              message: failedTransition.ok ? failedTransition.record.summary : contextScope.message,
            },
          },
          { status: 404 },
        );
      }

      const comparisonContext = getProductComparisonContext(parsed.data.comparisonContextId);
      const comparisonResult = comparisonContext?.result;

      if (!comparisonResult) {
        const failedTransition = transitionCartToolActionRecord({
          actionId: parsed.data.actionId,
          nextStatus: "failed",
          summary: "Comparison result is no longer available. Please run comparison again.",
        });

        return Response.json(
          {
            ok: false,
            error: {
              code: "COMPARISON_STALE",
              message: failedTransition.ok
                ? failedTransition.record.summary
                : "Comparison result is no longer available. Please run comparison again.",
              recoveryOptions: [
                "Ask CartMind to compare products again",
                "Refresh cart and retry",
              ],
            },
          },
          { status: 409 },
        );
      }

      const selectedSnapshot = comparisonResult.products.find((product) => (
        product.productId === parsed.data.selectedProductId
      ));

      if (!selectedSnapshot) {
        const failedTransition = transitionCartToolActionRecord({
          actionId: parsed.data.actionId,
          nextStatus: "failed",
          summary: "Selected product is not part of this comparison context.",
        });

        return Response.json(
          {
            ok: false,
            error: {
              code: "INVALID_SELECTION",
              message: failedTransition.ok
                ? failedTransition.record.summary
                : "Selected product is not part of this comparison context.",
            },
          },
          { status: 422 },
        );
      }

      if (selectedSnapshot.availability === "unavailable") {
        const failedTransition = transitionCartToolActionRecord({
          actionId: parsed.data.actionId,
          nextStatus: "failed",
          summary: "Selected product is currently unavailable.",
        });

        return Response.json(
          {
            ok: false,
            error: {
              code: "PRODUCT_UNAVAILABLE",
              message: failedTransition.ok ? failedTransition.record.summary : "Selected product is currently unavailable.",
            },
          },
          { status: 422 },
        );
      }

      const payload = record.payload as {
        actionType?: string;
        recommended?: { productId: string; variantId?: string };
      };

      const mutationOutcome = await applyComparisonSelectionToCart({
        actionId: parsed.data.actionId,
        cartId: record.cartId || parsed.data.cart?.cartId,
        selectedProductId: parsed.data.selectedProductId,
        selectedVariantId: parsed.data.selectedVariantId || selectedSnapshot.variantId,
        fallbackVariantId: payload.recommended?.variantId,
        cart: {
          cartId: parsed.data.cart?.cartId,
          currencyCode: parsed.data.cart?.currencyCode || "USD",
          items: parsed.data.cart?.items.map((item) => ({
            lineId: item.lineId || item.productId,
            productId: item.productId,
            variantId: item.variantId,
            quantity: item.quantity,
          })) || [],
          subtotal: parsed.data.cart?.subtotal,
        },
      });

      if (!mutationOutcome.ok) {
        const failedTransition = transitionCartToolActionRecord({
          actionId: parsed.data.actionId,
          nextStatus: "failed",
          summary: mutationOutcome.message,
        });

        return Response.json(
          {
            ok: false,
            error: {
              code: mutationOutcome.code || "MUTATION_ERROR",
              message: failedTransition.ok ? failedTransition.record.summary : mutationOutcome.message,
            },
          },
          { status: 422 },
        );
      }

      const executedTransition = transitionCartToolActionRecord({
        actionId: parsed.data.actionId,
        nextStatus: "executed",
        summary: `Applied comparison selection for ${selectedSnapshot.title} (${selectedSnapshot.price} ${selectedSnapshot.currencyCode}).`,
      });

      return Response.json({
        ok: true,
        result: {
          actionId: parsed.data.actionId,
          status: executedTransition.ok ? executedTransition.record.status : "executed",
          summary: executedTransition.ok
            ? executedTransition.record.summary
            : `Applied comparison selection for ${selectedSnapshot.title}.`,
          comparisonContextId: parsed.data.comparisonContextId,
          selectedProductId: parsed.data.selectedProductId,
          ...(parsed.data.selectedVariantId ? { selectedVariantId: parsed.data.selectedVariantId } : {}),
          cart: mutationOutcome.cart,
        },
      });
    }

    const executingTransition = transitionCartToolActionRecord({
      actionId: parsed.data.actionId,
      nextStatus: "executing",
      summary: "Applying approved cart action.",
    });

    if (!executingTransition.ok) {
      return Response.json(
        {
          ok: false,
          error: {
            code: executingTransition.code,
            message: executingTransition.message,
          },
        },
        { status: 409 },
      );
    }

    const actionPayload = record.payload as {
      actionType?: string;
      merchandiseId?: string;
      newMerchandiseId?: string;
      quantity?: number;
      lineId?: string;
    };
    const cartSnapshot = {
      cartId: parsed.data.cart?.cartId,
      currencyCode: parsed.data.cart?.currencyCode || "USD",
      items: parsed.data.cart?.items.map((item) => ({
        lineId: item.lineId || item.productId,
        productId: item.productId,
        variantId: item.variantId,
        quantity: item.quantity,
      })) || [],
      subtotal: parsed.data.cart?.subtotal,
    };

    const missingLine = actionPayload.lineId
      ? !cartSnapshot.items.some((item) => item.lineId === actionPayload.lineId)
      : false;
    if (missingLine) {
      const failedTransition = transitionCartToolActionRecord({
        actionId: parsed.data.actionId,
        nextStatus: "failed",
        summary: "The selected cart line changed before confirmation.",
      });

      return Response.json(
        {
          ok: false,
          error: {
            code: "CART_CONFLICT",
            message: failedTransition.ok ? failedTransition.record.summary : "The selected cart line changed before confirmation.",
            recoveryOptions: ["Refresh cart", "Ask the assistant to propose the action again"],
          },
        },
        { status: 409 },
      );
    }

    if (actionPayload.actionType === "add" && actionPayload.merchandiseId && actionPayload.quantity) {
      const mutationOutcome = await storefrontCartMutationAdapter.addLine({
        cartId: record.cartId || parsed.data.cart?.cartId || "",
        merchandiseId: actionPayload.merchandiseId,
        quantity: actionPayload.quantity,
        idempotencyKey: record.actionId,
        cart: cartSnapshot,
      });

      if (!mutationOutcome.ok) {
        const failedTransition = transitionCartToolActionRecord({
          actionId: parsed.data.actionId,
          nextStatus: "failed",
          summary: mutationOutcome.message,
        });

        return Response.json(
          {
            ok: false,
            error: {
              code: mutationOutcome.code || "MUTATION_ERROR",
              message: failedTransition.ok ? failedTransition.record.summary : mutationOutcome.message,
            },
          },
          { status: 422 },
        );
      }

      const executedTransition = transitionCartToolActionRecord({
        actionId: parsed.data.actionId,
        nextStatus: "executed",
        summary: mutationOutcome.message,
      });

      if (!executedTransition.ok) {
        return Response.json(
          {
            ok: false,
            error: {
              code: executedTransition.code,
              message: executedTransition.message,
            },
          },
          { status: 409 },
        );
      }

      return Response.json({
        ok: true,
        result: {
          actionId: executedTransition.record.actionId,
          status: executedTransition.record.status,
          summary: executedTransition.record.summary,
          cart: mutationOutcome.cart,
        },
      });
    }

    if (actionPayload.actionType === "change_quantity" && actionPayload.lineId && actionPayload.quantity) {
      const mutationOutcome = await storefrontCartMutationAdapter.updateLineQuantity({
        cartId: record.cartId || parsed.data.cart?.cartId || "",
        lineId: actionPayload.lineId,
        quantity: actionPayload.quantity,
        idempotencyKey: record.actionId,
        cart: cartSnapshot,
      });

      if (!mutationOutcome.ok) {
        const failedTransition = transitionCartToolActionRecord({
          actionId: parsed.data.actionId,
          nextStatus: "failed",
          summary: mutationOutcome.message,
        });

        return Response.json(
          {
            ok: false,
            error: {
              code: mutationOutcome.code || "MUTATION_ERROR",
              message: failedTransition.ok ? failedTransition.record.summary : mutationOutcome.message,
            },
          },
          { status: 422 },
        );
      }

      const executedTransition = transitionCartToolActionRecord({
        actionId: parsed.data.actionId,
        nextStatus: "executed",
        summary: mutationOutcome.message,
      });

      return Response.json({
        ok: true,
        result: {
          actionId: parsed.data.actionId,
          status: executedTransition.ok ? executedTransition.record.status : "executed",
          summary: mutationOutcome.message,
          cart: mutationOutcome.cart,
        },
      });
    }

    if (actionPayload.actionType === "remove" && actionPayload.lineId) {
      const mutationOutcome = await storefrontCartMutationAdapter.removeLine({
        cartId: record.cartId || parsed.data.cart?.cartId || "",
        lineId: actionPayload.lineId,
        idempotencyKey: record.actionId,
        cart: cartSnapshot,
      });

      if (!mutationOutcome.ok) {
        const failedTransition = transitionCartToolActionRecord({
          actionId: parsed.data.actionId,
          nextStatus: "failed",
          summary: mutationOutcome.message,
        });

        return Response.json(
          {
            ok: false,
            error: {
              code: mutationOutcome.code || "MUTATION_ERROR",
              message: failedTransition.ok ? failedTransition.record.summary : mutationOutcome.message,
            },
          },
          { status: 422 },
        );
      }

      const executedTransition = transitionCartToolActionRecord({
        actionId: parsed.data.actionId,
        nextStatus: "executed",
        summary: mutationOutcome.message,
      });

      return Response.json({
        ok: true,
        result: {
          actionId: parsed.data.actionId,
          status: executedTransition.ok ? executedTransition.record.status : "executed",
          summary: mutationOutcome.message,
          cart: mutationOutcome.cart,
        },
      });
    }

    if (actionPayload.actionType === "swap_variant" && actionPayload.lineId && actionPayload.newMerchandiseId && actionPayload.quantity) {
      const currentLine = cartSnapshot.items.find((item) => item.lineId === actionPayload.lineId);
      if (!currentLine || !currentLine.variantId) {
        const failedTransition = transitionCartToolActionRecord({
          actionId: parsed.data.actionId,
          nextStatus: "failed",
          summary: "Swap target line is no longer available in the cart.",
        });

        return Response.json(
          {
            ok: false,
            error: {
              code: "CART_CONFLICT",
              message: failedTransition.ok ? failedTransition.record.summary : "Swap target line is no longer available in the cart.",
            },
          },
          { status: 409 },
        );
      }

      if (currentLine.variantId === actionPayload.newMerchandiseId) {
        const failedTransition = transitionCartToolActionRecord({
          actionId: parsed.data.actionId,
          nextStatus: "failed",
          summary: "Requested swap variant matches the current selection.",
        });

        return Response.json(
          {
            ok: false,
            error: {
              code: "VARIANT_UNAVAILABLE",
              message: failedTransition.ok ? failedTransition.record.summary : "Requested swap variant matches the current selection.",
            },
          },
          { status: 422 },
        );
      }

      const mutationOutcome = await storefrontCartMutationAdapter.swapLineVariant({
        cartId: record.cartId || parsed.data.cart?.cartId || "",
        lineId: actionPayload.lineId,
        newMerchandiseId: actionPayload.newMerchandiseId,
        quantity: actionPayload.quantity,
        idempotencyKey: record.actionId,
        cart: cartSnapshot,
      });

      if (!mutationOutcome.ok) {
        const failedTransition = transitionCartToolActionRecord({
          actionId: parsed.data.actionId,
          nextStatus: "failed",
          summary: mutationOutcome.message,
        });

        return Response.json(
          {
            ok: false,
            error: {
              code: mutationOutcome.code || "MUTATION_ERROR",
              message: failedTransition.ok ? failedTransition.record.summary : mutationOutcome.message,
            },
          },
          { status: 422 },
        );
      }

      const executedTransition = transitionCartToolActionRecord({
        actionId: parsed.data.actionId,
        nextStatus: "executed",
        summary: mutationOutcome.message,
      });

      return Response.json({
        ok: true,
        result: {
          actionId: parsed.data.actionId,
          status: executedTransition.ok ? executedTransition.record.status : "executed",
          summary: mutationOutcome.message,
          cart: mutationOutcome.cart,
        },
      });
    }

    const failedTransition = transitionCartToolActionRecord({
      actionId: parsed.data.actionId,
      nextStatus: "failed",
      summary: "Unsupported approved action payload.",
    });

    return Response.json(
      {
        ok: false,
        error: {
          code: "UNSUPPORTED_ACTION",
          message: failedTransition.ok ? failedTransition.record.summary : "Unsupported approved action payload.",
        },
      },
      { status: 422 },
    );
  }

  return Response.json({
    ok: true,
    result: {
      actionId: transition.record.actionId,
      status: transition.record.status,
      summary: transition.record.summary,
    },
  });
};

export const loader = async () => Response.json(
  {
    ok: false,
    error: {
      code: "METHOD_NOT_ALLOWED",
      message: "Use POST.",
    },
  },
  { status: 405 },
);
