import { beforeEach, describe, expect, it } from "vitest";

import { action as confirmAction } from "../../../app/routes/api.ai.chat.actions.confirm";
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

    const proposal = buildCartToolActionProposal(request);
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

    const proposal = buildCartToolActionProposal(request);
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

    const proposal = buildCartToolActionProposal(request);
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

    const proposal = buildCartToolActionProposal(request);

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

    const proposal = buildCartToolActionProposal(request);
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

    const proposal = buildCartToolActionProposal(request);
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

    const proposal = buildCartToolActionProposal(request);
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
});
