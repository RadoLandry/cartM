import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { issueStorefrontChatToken } from "../../../app/lib/shopify/app-proxy";
import { action } from "../../../app/routes/api.ai.chat";
import {
  makeStorefrontChatBootstrapRequest,
  makeStorefrontChatRequest,
} from "../../helpers/storefront-chat-fixtures";

async function readResponseText(response: Response) {
  return await response.text();
}

afterEach(() => {
  vi.useRealTimers();
});

const ORIGINAL_SIGNING_SECRET = process.env.STOREFRONT_CHAT_SIGNING_SECRET;
const ORIGINAL_OPENAI_KEY = process.env.OPENAI_API_KEY;

describe("storefront chat stream route", () => {
  beforeEach(() => {
    delete process.env.OPENAI_API_KEY;
  });

  afterEach(() => {
    if (ORIGINAL_SIGNING_SECRET) {
      process.env.STOREFRONT_CHAT_SIGNING_SECRET = ORIGINAL_SIGNING_SECRET;
    } else {
      delete process.env.STOREFRONT_CHAT_SIGNING_SECRET;
    }

    if (ORIGINAL_OPENAI_KEY) {
      process.env.OPENAI_API_KEY = ORIGINAL_OPENAI_KEY;
    } else {
      delete process.env.OPENAI_API_KEY;
    }
  });

  it("streams text and guidance parts for a valid shopper request", async () => {
    process.env.STOREFRONT_CHAT_SIGNING_SECRET = "test-signing-secret";
    const input = makeStorefrontChatRequest();
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

    expect(response.headers.get("content-type")).toContain("text/event-stream");
    expect(body).toContain('"type":"text-delta"');
    expect(body).toContain('"type":"guidance-block"');
    expect(body).toContain('"type":"message-complete"');
    expect(body).toContain("Core Training Gloves");
    expect(body).toContain('"action":"keep"');
  });

  it("answers product and sparring suitability questions from the current cart", async () => {
    process.env.STOREFRONT_CHAT_SIGNING_SECRET = "test-signing-secret";
    const input = makeStorefrontChatRequest({
      messages: [{ role: "user", content: "Ces gants sont-ils adaptes au sparring ?" }],
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

    expect(body).toContain("Core Training Gloves");
    // Response should be in French because the question is in French
    expect(body).toContain("sparring");
    expect(body).toContain("confirmez le poids des gants");
    expect(body).toContain('"type":"size_summary"');
    expect(body).toContain("R\u00e9sum\u00e9 des tailles");
  });

  it("answers discipline compatibility questions like a cart-aware coach", async () => {
    process.env.STOREFRONT_CHAT_SIGNING_SECRET = "test-signing-secret";
    const input = makeStorefrontChatRequest({
      cart: {
        cartId: "gid://shopify/Cart/123",
        currencyCode: "EUR",
        items: [
          {
            productId: "gid://shopify/Product/99",
            productTitle: "Gants de Boxe Venum Impact Evo Scales - Muay Thai",
            variantId: "gid://shopify/ProductVariant/991",
            variantTitle: "10 oz / Vert Armee",
            quantity: 1,
          },
        ],
      },
      messages: [{ role: "user", content: "est ce que ce gant est compatible a la pratique du Muay Thai?" }],
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

    expect(body).toContain("Oui");
    expect(body).toContain("Muay Thai");
    expect(body).toContain("10 oz");
    expect(body).toContain("v\u00e9rifiez aussi le rembourrage");
    expect(body).toContain('"type":"size_summary"');
  });

  it("honors storefront feature flags when streaming guidance blocks", async () => {
    process.env.STOREFRONT_CHAT_SIGNING_SECRET = "test-signing-secret";
    const input = makeStorefrontChatRequest({
      features: {
        showRecommendations: false,
        showKitCompleteness: false,
        showSizeWarnings: false,
        showChatEntry: true,
        showReasonTags: true,
      },
      messages: [{ role: "user", content: "Check size and kit completeness for this cart" }],
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

    expect(body).toContain('"type":"text-delta"');
    expect(body).toContain('"type":"message-complete"');
    expect(body).not.toContain('"type":"size_summary"');
    expect(body).not.toContain('"type":"recommendation_list"');
  });

  it("emits proposed tool action and status events for add requests", async () => {
    process.env.STOREFRONT_CHAT_SIGNING_SECRET = "test-signing-secret";
    const input = makeStorefrontChatRequest({
      messages: [{ role: "user", content: "add 2 of these" }],
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

    expect(body).toContain('"type":"tool-action-proposed"');
    expect(body).toContain('"type":"tool-action-status"');
    expect(body).toContain('"status":"proposed"');
  });

  it("rejects malformed tokens before streaming begins", async () => {
    process.env.STOREFRONT_CHAT_SIGNING_SECRET = "test-signing-secret";
    const input = makeStorefrontChatRequest({ streamToken: "invalid.token" });
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
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload.ok).toBe(false);
    expect(payload.error.code).toBe("INVALID_TOKEN");
  });

  it("rejects expired tokens with a recoverable session error", async () => {
    process.env.STOREFRONT_CHAT_SIGNING_SECRET = "test-signing-secret";
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-28T09:00:00.000Z"));

    const bootstrap = makeStorefrontChatBootstrapRequest();
    const token = issueStorefrontChatToken(bootstrap);

    vi.setSystemTime(new Date("2026-05-28T09:06:00.000Z"));

    const input = makeStorefrontChatRequest({
      sessionKey: token.sessionKey,
      streamToken: token.streamToken,
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
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload.ok).toBe(false);
    expect(payload.error.code).toBe("TOKEN_EXPIRED");
  });

  it("rejects invalid request origins", async () => {
    process.env.STOREFRONT_CHAT_SIGNING_SECRET = "test-signing-secret";
    const input = makeStorefrontChatRequest();
    const response = await action({
      request: new Request("http://localhost/api/ai/chat", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "https://malicious.example",
        },
        body: JSON.stringify(input),
      }),
      params: {},
      context: {},
    } as never);
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload.error.code).toBe("INVALID_ORIGIN");
  });

  it("rejects mismatched token scope", async () => {
    process.env.STOREFRONT_CHAT_SIGNING_SECRET = "test-signing-secret";
    const input = makeStorefrontChatRequest({
      cart: {
        cartId: "gid://shopify/Cart/different",
        currencyCode: "USD",
        items: [
          {
            productId: "gid://shopify/Product/1",
            productTitle: "Core Training Gloves",
            variantId: "gid://shopify/ProductVariant/11",
            variantTitle: "12 oz / Black",
            quantity: 1,
          },
        ],
      },
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
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload.error.code).toBe("INVALID_TOKEN_SCOPE");
  });

  it("returns explicit empty-cart fallback guidance", async () => {
    process.env.STOREFRONT_CHAT_SIGNING_SECRET = "test-signing-secret";
    const input = makeStorefrontChatRequest({
      cart: {
        cartId: "gid://shopify/Cart/123",
        currencyCode: "USD",
        items: [],
      },
      messages: [{ role: "user", content: "What should I buy first?" }],
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

    expect(body).toContain('"type":"guidance-block"');
    expect(body).toContain('"type":"fallback_notice"');
    expect(body).toContain("Add at least one cart item");
  });

  it("uses the latest cart lines on follow-up turns when cart content changes", async () => {
    process.env.STOREFRONT_CHAT_SIGNING_SECRET = "test-signing-secret";
    const base = makeStorefrontChatRequest();

    const updatedInput = {
      ...base,
      cart: {
        ...base.cart,
        items: [
          {
            productId: "gid://shopify/Product/99",
            productTitle: "Sparring Headgear",
            variantId: "gid://shopify/ProductVariant/99",
            variantTitle: "Medium / Black",
            quantity: 1,
          },
        ],
      },
      messages: [{ role: "user" as const, content: "What should I adjust now?" }],
    };

    const response = await action({
      request: new Request("http://localhost/api/ai/chat", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "https://test.myshopify.com",
        },
        body: JSON.stringify(updatedInput),
      }),
      params: {},
      context: {},
    } as never);
    const body = await readResponseText(response);

    expect(body).toContain("Sparring Headgear");
  });

  it("returns kit-specific fallback notice instead of generic fallback trio for missing-kit intent", async () => {
    process.env.STOREFRONT_CHAT_SIGNING_SECRET = "test-signing-secret";
    const input = makeStorefrontChatRequest({
      cart: {
        cartId: "gid://shopify/Cart/123",
        currencyCode: "USD",
        items: [
          {
            productId: "gid://shopify/Product/999999",
            productTitle: "Unknown Training Top",
            variantId: "gid://shopify/ProductVariant/999999",
            variantTitle: "L",
            quantity: 1,
          },
        ],
      },
      messages: [{ role: "user", content: "what is missing in my kit" }],
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

    expect(body).toContain('"type":"guidance-block"');
    expect(body).toContain('"type":"fallback_notice"');
    expect(body).toContain("No complete kit baseline was detected");
    expect(body).not.toContain("keep current choice");
  });
});