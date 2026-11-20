import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import db from "../../../app/db.server";
import type { CartToolAction } from "../../../app/lib/ai/schemas";
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

  afterEach(() => {
    vi.restoreAllMocks();
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

  it.each([
    "replace with gid://shopify/ProductVariant/22",
    "Mets les gants en 14 oz.",
    "Passe les gants en taille 14 oz.",
  ])("streams and executes an approved variant change: %s", async (content) => {
    vi.spyOn(db.product, "findFirst").mockResolvedValue({
      variants: [
        { shopifyVariantId: "gid://shopify/ProductVariant/11", title: "12 oz / Black", inventoryQuantity: 5 },
        { shopifyVariantId: "gid://shopify/ProductVariant/22", title: "14 oz / Black", inventoryQuantity: 5 },
      ],
    } as never);
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
      messages: [{ role: "user", content }],
    });

    const streamResponse = await chatAction({
      request: new Request("http://localhost/api/ai/chat", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "https://test.myshopify.com",
        },
        body: JSON.stringify(request),
      }),
      params: {},
      context: {},
    } as never);
    const events = parseSseEvents(await readResponseText(streamResponse));
    const proposal = events.find((event) => event.type === "tool-action-proposed")?.action as CartToolAction | undefined;
    expect(proposal?.payload.actionType).toBe("swap_variant");
    expect(events).toContainEqual(expect.objectContaining({ type: "tool-action-status", status: "proposed" }));
    expect(request.cart.items[0].variantId).toBe("gid://shopify/ProductVariant/11");

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
    expect(payload.result.cart.items[0].quantity).toBe(1);
  });

  it.each([true, false])("keeps the pants replacement intent and quantity (size available: %s)", async (available) => {
    vi.spyOn(db.product, "findFirst").mockResolvedValue({
      variants: [
        { shopifyVariantId: "gid://shopify/ProductVariant/441", title: "XS / Bordeaux", inventoryQuantity: 10 },
        { shopifyVariantId: "gid://shopify/ProductVariant/442", title: "S / Bordeaux", inventoryQuantity: available ? 10 : 0 },
      ],
    } as never);
    const request = makeStorefrontChatRequest({
      cart: {
        ...buildBaseCart(),
        items: [
          { ...buildBaseCart().items[0], productTitle: "Gants de Boxe Venum Impact Evo Scales", variantTitle: "8 oz" },
          { lineId: "line-pants", productId: "gid://shopify/Product/44", productTitle: "Pantalon Venum Bordeaux", variantId: "gid://shopify/ProductVariant/441", variantTitle: "XS / Bordeaux", quantity: 5 },
        ],
      },
      messages: [{ role: "user", content: "Remplace le pantalon  par le même modèle en taille S en gardant la quantité." }],
    });
    const response = await chatAction({
      request: new Request("http://localhost/api/ai/chat", {
        method: "POST",
        headers: { "content-type": "application/json", origin: "https://test.myshopify.com" },
        body: JSON.stringify(request),
      }),
      params: {},
      context: {},
    } as never);
    const events = parseSseEvents(await readResponseText(response));
    const text = events.filter((event) => event.type === "text-delta").map((event) => event.text).join("");
    const proposal = events.find((event) => event.type === "tool-action-proposed")?.action as CartToolAction | undefined;

    expect(text).toContain("Pantalon Venum Bordeaux");
    expect(text).not.toContain("Gants");
    expect(events.some((event) => event.type === "guidance-block")).toBe(false);
    if (!available) {
      expect(proposal).toBeUndefined();
      expect(text).toContain("taille S");
      expect(text).toContain("restent inchangés");
      return;
    }

    expect(text).toContain("Quantité conservée : 5");
    expect(proposal?.payload).toMatchObject({ actionType: "swap_variant", lineId: "line-pants", newMerchandiseId: "gid://shopify/ProductVariant/442", quantity: 5 });
    const confirmation = await confirmAction({
      request: new Request("http://localhost/api/ai/chat/actions/confirm", {
        method: "POST",
        headers: { "content-type": "application/json", origin: "https://test.myshopify.com" },
        body: JSON.stringify({
          shop: request.shop,
          sessionKey: request.sessionKey,
          actionId: proposal?.actionId,
          confirmationToken: proposal?.confirmationToken,
          decision: "approve",
          actionType: "cart_tool",
          cart: request.cart,
        }),
      }),
      params: {},
      context: {},
    } as never);
    const payload = await confirmation.json();
    expect(payload.result.status).toBe("executed");
    expect(payload.result.cart.items).toHaveLength(2);
    expect(payload.result.cart.items).toEqual(expect.arrayContaining([
      expect.objectContaining({ variantId: "gid://shopify/ProductVariant/11", quantity: 1 }),
      expect.objectContaining({ variantId: "gid://shopify/ProductVariant/442", quantity: 5 }),
    ]));
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
            finalLinePrice: 34,
            quantity: 1,
          },
          {
            lineId: "line_2",
            productId: "gid://shopify/Product/2",
            productTitle: "Optional Bag",
            variantId: "gid://shopify/ProductVariant/2",
            finalLinePrice: 16,
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
