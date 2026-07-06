import { describe, expect, it } from "vitest";

import { action } from "../../../app/routes/api.ai.chat";
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

  it.todo("preserves safety-critical items when proposing changes");
  it.todo("recomputes remaining gap after candidate rejection");
});
