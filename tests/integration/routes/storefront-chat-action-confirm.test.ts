import { beforeEach, describe, expect, it } from "vitest";

import { action as confirmAction } from "../../../app/routes/api.ai.chat.actions.confirm";
import { action as chatAction } from "../../../app/routes/api.ai.chat";
import { buildCartToolActionProposal } from "../../../app/lib/ai/tools";
import { createCartToolActionRecord } from "../../../app/lib/ai/storefront-chat";
import { issueActionConfirmationToken } from "../../../app/lib/shopify/app-proxy";
import { makeStorefrontChatRequest } from "../../helpers/storefront-chat-fixtures";

function buildBaseCart() {
  return {
    cartId: "gid://shopify/Cart/123",
    currencyCode: "USD",
    items: [
      {
        lineId: "line-gloves",
        productId: "gid://shopify/Product/1",
        variantId: "gid://shopify/ProductVariant/11",
        quantity: 1,
      },
    ],
  };
}

async function readResponseText(response: Response) {
  return await response.text();
}

function parseSseEvents(body: string) {
  return body
    .split("\n\n")
    .flatMap((frame) => frame.split("\n").filter((line) => line.startsWith("data: ")))
    .map((line) => JSON.parse(line.slice(6)) as { type: string; [key: string]: unknown });
}

describe("storefront chat action confirmation route", () => {
  beforeEach(() => {
    process.env.STOREFRONT_CHAT_SIGNING_SECRET = "test-signing-secret";
  });

  it("executes approved add-to-cart action", async () => {
    const request = makeStorefrontChatRequest({
      cart: {
        ...buildBaseCart(),
        items: [
          {
            ...buildBaseCart().items[0],
            productTitle: "Core Training Gloves",
            variantTitle: "12 oz / Black",
          },
        ],
      },
      messages: [{ role: "user", content: "add 2 more" }],
    });

    const proposal = await buildCartToolActionProposal(request);
    expect(proposal).not.toBeNull();

    const response = await confirmAction({
      request: new Request("http://localhost/api/ai/chat/actions/confirm", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "https://test.myshopify.com",
        },
        body: JSON.stringify({
          shop: request.shop,
          sessionKey: request.sessionKey,
          actionId: proposal?.actionId,
          confirmationToken: proposal?.confirmationToken,
          decision: "approve",
          actionType: "cart_tool",
          cart: buildBaseCart(),
        }),
      }),
      params: {},
      context: {},
    } as never);

    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.result.status).toBe("executed");
    expect(payload.result.cart.items).toHaveLength(2);
  });

  it("executes approved remove action and removes target line", async () => {
    const request = makeStorefrontChatRequest({
      cart: {
        ...buildBaseCart(),
        items: [
          {
            ...buildBaseCart().items[0],
            productTitle: "Core Training Gloves",
            variantTitle: "12 oz / Black",
          },
        ],
      },
      messages: [{ role: "user", content: "remove gloves" }],
    });

    const proposal = await buildCartToolActionProposal(request);
    expect(proposal?.payload.actionType).toBe("remove");

    const response = await confirmAction({
      request: new Request("http://localhost/api/ai/chat/actions/confirm", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "https://test.myshopify.com",
        },
        body: JSON.stringify({
          shop: request.shop,
          sessionKey: request.sessionKey,
          actionId: proposal?.actionId,
          confirmationToken: proposal?.confirmationToken,
          decision: "approve",
          actionType: "cart_tool",
          cart: buildBaseCart(),
        }),
      }),
      params: {},
      context: {},
    } as never);

    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.result.cart.items).toHaveLength(0);
  });

  it("executes approved quantity change action", async () => {
    const request = makeStorefrontChatRequest({
      cart: {
        ...buildBaseCart(),
        items: [
          {
            ...buildBaseCart().items[0],
            productTitle: "Core Training Gloves",
            variantTitle: "12 oz / Black",
          },
        ],
      },
      messages: [{ role: "user", content: "increase quantity to 3" }],
    });

    const proposal = await buildCartToolActionProposal(request);
    expect(proposal?.payload.actionType).toBe("change_quantity");

    const response = await confirmAction({
      request: new Request("http://localhost/api/ai/chat/actions/confirm", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "https://test.myshopify.com",
        },
        body: JSON.stringify({
          shop: request.shop,
          sessionKey: request.sessionKey,
          actionId: proposal?.actionId,
          confirmationToken: proposal?.confirmationToken,
          decision: "approve",
          actionType: "cart_tool",
          cart: buildBaseCart(),
        }),
      }),
      params: {},
      context: {},
    } as never);

    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.result.cart.items[0].quantity).toBe(3);
  });

  it("executes approved quantity changes on multiple cart lines", async () => {
    const actionId = `action-multi-qty-${Date.now()}`;
    const request = makeStorefrontChatRequest({
      cart: {
        cartId: "gid://shopify/Cart/123",
        currencyCode: "USD",
        items: [
          {
            lineId: "line-shorts",
            productId: "gid://shopify/Product/20",
            variantId: "gid://shopify/ProductVariant/201",
            quantity: 7,
          },
          {
            lineId: "line-jacket",
            productId: "gid://shopify/Product/10",
            variantId: "gid://shopify/ProductVariant/101",
            quantity: 6,
          },
        ],
      },
    });

    createCartToolActionRecord({
      actionId,
      shop: request.shop,
      sessionKey: request.sessionKey,
      cartId: "gid://shopify/Cart/123",
      payload: {
        actionType: "change_quantity",
        lineId: "line-shorts",
        quantity: 5,
        changes: [
          {
            lineId: "line-shorts",
            quantity: 5,
          },
          {
            lineId: "line-jacket",
            quantity: 3,
          },
        ],
      },
    });

    const token = issueActionConfirmationToken({
      actionId,
      shop: request.shop,
      sessionKey: request.sessionKey,
      cartId: "gid://shopify/Cart/123",
    });

    const response = await confirmAction({
      request: new Request("http://localhost/api/ai/chat/actions/confirm", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "https://test.myshopify.com",
        },
        body: JSON.stringify({
          shop: request.shop,
          sessionKey: request.sessionKey,
          actionId,
          confirmationToken: token.token,
          decision: "approve",
          actionType: "cart_tool",
          cart: request.cart,
        }),
      }),
      params: {},
      context: {},
    } as never);

    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.result.status).toBe("executed");
    expect(payload.result.cart.items.find((item: { lineId: string }) => item.lineId === "line-shorts")?.quantity).toBe(5);
    expect(payload.result.cart.items.find((item: { lineId: string }) => item.lineId === "line-jacket")?.quantity).toBe(3);
  });

  it("declines action without mutating cart", async () => {
    const request = makeStorefrontChatRequest({
      cart: {
        ...buildBaseCart(),
        items: [
          {
            ...buildBaseCart().items[0],
            productTitle: "Core Training Gloves",
            variantTitle: "12 oz / Black",
          },
        ],
      },
      messages: [{ role: "user", content: "remove gloves" }],
    });

    const proposal = await buildCartToolActionProposal(request);

    const response = await confirmAction({
      request: new Request("http://localhost/api/ai/chat/actions/confirm", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "https://test.myshopify.com",
        },
        body: JSON.stringify({
          shop: request.shop,
          sessionKey: request.sessionKey,
          actionId: proposal?.actionId,
          confirmationToken: proposal?.confirmationToken,
          decision: "decline",
          actionType: "cart_tool",
          cart: buildBaseCart(),
        }),
      }),
      params: {},
      context: {},
    } as never);

    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.result.status).toBe("declined");
    expect(payload.result.summary).toContain("No cart changes were made");
  });

  it("executes approved swap action and replaces variant", async () => {
    const request = makeStorefrontChatRequest({
      cart: {
        ...buildBaseCart(),
        items: [
          {
            ...buildBaseCart().items[0],
            productTitle: "Core Training Gloves",
            variantTitle: "12 oz / Black",
          },
        ],
      },
      messages: [{ role: "user", content: "replace with gid://shopify/ProductVariant/22" }],
    });

    const proposal = await buildCartToolActionProposal(request);
    expect(proposal?.payload.actionType).toBe("swap_variant");

    const response = await confirmAction({
      request: new Request("http://localhost/api/ai/chat/actions/confirm", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "https://test.myshopify.com",
        },
        body: JSON.stringify({
          shop: request.shop,
          sessionKey: request.sessionKey,
          actionId: proposal?.actionId,
          confirmationToken: proposal?.confirmationToken,
          decision: "approve",
          actionType: "cart_tool",
          cart: buildBaseCart(),
        }),
      }),
      params: {},
      context: {},
    } as never);

    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.result.status).toBe("executed");
    expect(payload.result.cart.items.some((item: { variantId?: string }) => item.variantId === "gid://shopify/ProductVariant/22")).toBe(true);
  });

  it("fails swap action safely when target variant is unavailable", async () => {
    const request = makeStorefrontChatRequest({
      cart: {
        ...buildBaseCart(),
        items: [
          {
            ...buildBaseCart().items[0],
            productTitle: "Core Training Gloves",
            variantTitle: "12 oz / Black",
          },
        ],
      },
      messages: [{ role: "user", content: "replace with gid://shopify/ProductVariant/unavailable" }],
    });

    const proposal = await buildCartToolActionProposal(request);
    expect(proposal?.payload.actionType).toBe("swap_variant");

    const response = await confirmAction({
      request: new Request("http://localhost/api/ai/chat/actions/confirm", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "https://test.myshopify.com",
        },
        body: JSON.stringify({
          shop: request.shop,
          sessionKey: request.sessionKey,
          actionId: proposal?.actionId,
          confirmationToken: proposal?.confirmationToken,
          decision: "approve",
          actionType: "cart_tool",
          cart: buildBaseCart(),
        }),
      }),
      params: {},
      context: {},
    } as never);

    const payload = await response.json();

    expect(response.status).toBe(422);
    expect(payload.ok).toBe(false);
    expect(payload.error.code).toBe("CART_CONFLICT");
  });

  it("rejects quantity updates below minimum with QUANTITY_INVALID", async () => {
    const actionId = `action-invalid-qty-${Date.now()}`;
    const request = makeStorefrontChatRequest();

    createCartToolActionRecord({
      actionId,
      shop: request.shop,
      sessionKey: request.sessionKey,
      cartId: "gid://shopify/Cart/123",
      payload: {
        actionType: "change_quantity",
        lineId: "line-gloves",
        quantity: 0,
      },
    });

    const token = issueActionConfirmationToken({
      actionId,
      shop: request.shop,
      sessionKey: request.sessionKey,
      cartId: "gid://shopify/Cart/123",
    });

    const response = await confirmAction({
      request: new Request("http://localhost/api/ai/chat/actions/confirm", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "https://test.myshopify.com",
        },
        body: JSON.stringify({
          shop: request.shop,
          sessionKey: request.sessionKey,
          actionId,
          confirmationToken: token.token,
          decision: "approve",
          actionType: "cart_tool",
          cart: buildBaseCart(),
        }),
      }),
      params: {},
      context: {},
    } as never);

    const payload = await response.json();

    expect(response.status).toBe(422);
    expect(payload.ok).toBe(false);
    expect(payload.error.code).toBe("QUANTITY_INVALID");
  });

  it("returns idempotent replay for duplicate approvals on terminal actions", async () => {
    const request = makeStorefrontChatRequest({
      cart: {
        ...buildBaseCart(),
        items: [
          {
            ...buildBaseCart().items[0],
            productTitle: "Core Training Gloves",
            variantTitle: "12 oz / Black",
          },
        ],
      },
      messages: [{ role: "user", content: "increase quantity to 3" }],
    });

    const proposal = await buildCartToolActionProposal(request);
    expect(proposal?.payload.actionType).toBe("change_quantity");

    const baseBody = {
      shop: request.shop,
      sessionKey: request.sessionKey,
      actionId: proposal?.actionId,
      confirmationToken: proposal?.confirmationToken,
      decision: "approve",
      actionType: "cart_tool",
      cart: buildBaseCart(),
    };

    const firstResponse = await confirmAction({
      request: new Request("http://localhost/api/ai/chat/actions/confirm", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "https://test.myshopify.com",
        },
        body: JSON.stringify(baseBody),
      }),
      params: {},
      context: {},
    } as never);

    expect(firstResponse.status).toBe(200);

    const replayResponse = await confirmAction({
      request: new Request("http://localhost/api/ai/chat/actions/confirm", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "https://test.myshopify.com",
        },
        body: JSON.stringify(baseBody),
      }),
      params: {},
      context: {},
    } as never);

    const replayPayload = await replayResponse.json();

    expect(replayResponse.status).toBe(200);
    expect(replayPayload.ok).toBe(true);
    expect(replayPayload.result.idempotentReplay).toBe(true);
    expect(replayPayload.result.status).toBe("executed");
  });

  it("returns ACTION_NOT_FOUND for unknown action confirmation requests", async () => {
    const request = makeStorefrontChatRequest();
    const token = issueActionConfirmationToken({
      actionId: "missing-action-id",
      shop: request.shop,
      sessionKey: request.sessionKey,
      cartId: "gid://shopify/Cart/123",
    });

    const response = await confirmAction({
      request: new Request("http://localhost/api/ai/chat/actions/confirm", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "https://test.myshopify.com",
        },
        body: JSON.stringify({
          shop: request.shop,
          sessionKey: request.sessionKey,
          actionId: "missing-action-id",
          confirmationToken: token.token,
          decision: "approve",
          actionType: "cart_tool",
          cart: buildBaseCart(),
        }),
      }),
      params: {},
      context: {},
    } as never);

    const payload = await response.json();

    expect(response.status).toBe(404);
    expect(payload.ok).toBe(false);
    expect(payload.error.code).toBe("ACTION_NOT_FOUND");
  });

  it("executes approved budget optimization selection and updates cart", async () => {
    const chatRequest = makeStorefrontChatRequest({
      cart: {
        cartId: "gid://shopify/Cart/123",
        currencyCode: "USD",
        items: [
          {
            lineId: "line_1",
            productId: "gid://shopify/Product/1",
            productTitle: "Safety Gloves",
            variantId: "gid://shopify/ProductVariant/1",
            quantity: 1,
          },
          {
            lineId: "line_2",
            productId: "gid://shopify/Product/2",
            productTitle: "Optional Bag",
            variantId: "gid://shopify/ProductVariant/2",
            quantity: 1,
          },
        ],
      },
      messages: [{ role: "user", content: "Optimize my cart to budget $40" }],
    });

    const chatResponse = await chatAction({
      request: new Request("http://localhost/api/ai/chat", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "https://test.myshopify.com",
        },
        body: JSON.stringify(chatRequest),
      }),
      params: {},
      context: {},
    } as never);

    const streamBody = await readResponseText(chatResponse);
    const events = parseSseEvents(streamBody);
    const actionEvent = events.find((event) => (
      event.type === "tool-action-proposed"
      && (event.action as { toolName?: string } | undefined)?.toolName === "optimizeBudget"
    )) as {
      type: "tool-action-proposed";
      action: {
        actionId: string;
        sessionKey: string;
        confirmationToken: string;
        payload: {
          actionType: "budget_optimization_select";
          optimizationContextId: string;
          candidateIds: string[];
        };
      };
    } | undefined;

    expect(actionEvent).toBeDefined();

    const response = await confirmAction({
      request: new Request("http://localhost/api/ai/chat/actions/confirm", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "https://test.myshopify.com",
        },
        body: JSON.stringify({
          shop: chatRequest.shop,
          sessionKey: actionEvent?.action.sessionKey,
          actionId: actionEvent?.action.actionId,
          confirmationToken: actionEvent?.action.confirmationToken,
          decision: "approve",
          actionType: "budget_optimization_select",
          optimizationContextId: actionEvent?.action.payload.optimizationContextId,
          candidateIds: actionEvent?.action.payload.candidateIds,
          cart: chatRequest.cart,
        }),
      }),
      params: {},
      context: {},
    } as never);

    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.result.status).toBe("executed");
    expect(payload.result.cart.items.length).toBeLessThan(chatRequest.cart.items.length);
  });
});
