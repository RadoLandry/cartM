import { describe, expect, it } from "vitest";

import { action } from "../../../app/routes/api.ai.chat";
import { action as confirmAction } from "../../../app/routes/api.ai.chat.actions.confirm";
import { makeStorefrontChatRequest } from "../../helpers/storefront-chat-fixtures";

async function readResponseText(response: Response) {
  return await response.text();
}

function parseSseEvents(body: string) {
  return body
    .split("\n\n")
    .flatMap((frame) => frame.split("\n").filter((line) => line.startsWith("data: ")))
    .map((line) => JSON.parse(line.slice(6)) as { type: string; [key: string]: unknown });
}

describe("storefront chat budget optimization route", () => {
  it("generates an optimization proposal with projected subtotal for over-budget carts", async () => {
    process.env.STOREFRONT_CHAT_SIGNING_SECRET = "test-signing-secret";

    const input = makeStorefrontChatRequest({
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

    const response = await action({
      request: new Request("http://localhost/api/ai/chat", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "https://test.myshopify.com",
        },
        body: JSON.stringify(input),
      }),
      params: {},
      context: {},
    } as never);

    const body = await readResponseText(response);
    const events = parseSseEvents(body);

    const proposed = events.find((event) => event.type === "budget-optimization.proposed") as {
      type: "budget-optimization.proposed";
      optimization: {
        optimizationContextId: string;
        request: { targetBudgetAmount: number };
      };
    } | undefined;
    const result = events.find((event) => event.type === "budget-optimization.result") as {
      type: "budget-optimization.result";
      optimization: {
        optimizationContextId: string;
        targetBudgetAmount: number;
        projectedSubtotal: number;
        projectedGapAmount: number;
      };
    } | undefined;

    expect(proposed).toBeDefined();
    expect(result).toBeDefined();
    expect(result?.optimization.optimizationContextId).toBe(proposed?.optimization.optimizationContextId);
    expect(result?.optimization.targetBudgetAmount).toBe(40);
    expect(result?.optimization.projectedSubtotal).toBeLessThanOrEqual(result!.optimization.targetBudgetAmount);
    expect(result?.optimization.projectedGapAmount).toBeGreaterThanOrEqual(0);
    expect(body).not.toContain('"title":"Recommended cart actions"');
    expect(body).toContain("Review the proposed changes below, then choose whether to apply or decline.");
  });

  it("preserves safety-critical items when proposing changes", async () => {
    process.env.STOREFRONT_CHAT_SIGNING_SECRET = "test-signing-secret";

    const input = makeStorefrontChatRequest({
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
      messages: [{ role: "user", content: "Optimize my cart to budget $39" }],
    });

    const response = await action({
      request: new Request("http://localhost/api/ai/chat", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "https://test.myshopify.com",
        },
        body: JSON.stringify(input),
      }),
      params: {},
      context: {},
    } as never);

    const body = await readResponseText(response);
    const events = parseSseEvents(body);

    const result = events.find((event) => event.type === "budget-optimization.result") as {
      type: "budget-optimization.result";
      optimization: {
        status: string;
        candidates: Array<{ sourceProductId: string; safetyCriticalImpact: string }>;
      };
    } | undefined;

    expect(result).toBeDefined();
    expect(result?.optimization.candidates.map((candidate) => candidate.sourceProductId)).toEqual(["gid://shopify/Product/2"]);
    expect(result?.optimization.candidates.map((candidate) => candidate.sourceProductId)).not.toContain("gid://shopify/Product/1");
  });

  it("recomputes remaining gap after candidate rejection", async () => {
    process.env.STOREFRONT_CHAT_SIGNING_SECRET = "test-signing-secret";

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
      messages: [{ role: "user", content: "Optimize my cart to budget $15" }],
    });

    const chatResponse = await action({
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

    const result = events.find((event) => event.type === "budget-optimization.result") as {
      type: "budget-optimization.result";
      optimization: {
        candidates: Array<{ candidateId: string; sourceProductId: string }>;
        projectedSubtotal: number;
      };
    } | undefined;
    const actionEvent = events.find((event) => (
      event.type === "tool-action-proposed"
      && (event.action as { toolName?: string } | undefined)?.toolName === "optimizeBudget"
    )) as {
      type: "tool-action-proposed";
      action: {
        actionId: string;
        sessionKey: string;
        confirmationToken: string;
        payload: { optimizationContextId: string };
      };
    } | undefined;

    expect(result).toBeDefined();
    expect(result?.optimization.candidates.length).toBeGreaterThanOrEqual(2);
    const bagCandidate = result?.optimization.candidates.find((candidate) => candidate.sourceProductId === "gid://shopify/Product/2");
    expect(bagCandidate).toBeDefined();

    const confirmResponse = await confirmAction({
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
          candidateIds: [bagCandidate?.candidateId],
          cart: chatRequest.cart,
        }),
      }),
      params: {},
      context: {},
    } as never);

    const confirmPayload = await confirmResponse.json();

    expect(confirmResponse.status).toBe(200);
    expect(confirmPayload.ok).toBe(true);
    expect(confirmPayload.result.selectedCandidateIds).toEqual([bagCandidate?.candidateId]);
    expect(confirmPayload.result.projectedSubtotal).not.toBe(result?.optimization.projectedSubtotal);
    expect(confirmPayload.result.projectedGapAmount).toBeGreaterThan(0);
  });
});
