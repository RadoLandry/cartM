import { beforeEach, describe, expect, it, vi } from "vitest";

import { action } from "../../../app/routes/api.app-proxy.chat-bootstrap";
import { verifyStorefrontChatToken } from "../../../app/lib/shopify/app-proxy";
import { makeStorefrontChatBootstrapRequest, TEST_SHOP } from "../../helpers/storefront-chat-fixtures";

vi.mock("../../../app/shopify.server", () => ({
  authenticate: {
    public: {
      appProxy: vi.fn(),
    },
  },
}));

import { authenticate } from "../../../app/shopify.server";

describe("storefront chat bootstrap route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.STOREFRONT_CHAT_SIGNING_SECRET = "test-signing-secret";
    vi.mocked(authenticate.public.appProxy).mockResolvedValue({
      session: { shop: TEST_SHOP },
    } as never);
  });

  it("issues a signed stream token for a valid proxied request", async () => {
    const input = makeStorefrontChatBootstrapRequest();
    const response = await action({
      request: new Request("http://localhost/api/app-proxy/chat-bootstrap", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      }),
      params: {},
      context: {},
    } as never);
    const payload = await response.json();

    expect(payload.ok).toBe(true);
    expect(payload.bootstrap.shop).toBe(TEST_SHOP);
    expect(payload.bootstrap.sessionKey).toMatch(/^chat_/);
    expect(payload.bootstrap.chatUrl).toBe("http://localhost/api/ai/chat");
    expect(verifyStorefrontChatToken(payload.bootstrap.streamToken)).toMatchObject({
      ok: true,
      payload: expect.objectContaining({
        shop: TEST_SHOP,
        sessionKey: payload.bootstrap.sessionKey,
      }),
    });
  });

  it("rejects an invalid bootstrap body", async () => {
    const response = await action({
      request: new Request("http://localhost/api/app-proxy/chat-bootstrap", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ shop: TEST_SHOP }),
      }),
      params: {},
      context: {},
    } as never);
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.ok).toBe(false);
    expect(payload.error.fieldErrors).toHaveProperty("surface");
  });

  it("invokes app proxy authentication before issuing bootstrap payload", async () => {
    const input = makeStorefrontChatBootstrapRequest();
    await action({
      request: new Request("http://localhost/api/app-proxy/chat-bootstrap", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      }),
      params: {},
      context: {},
    } as never);

    expect(authenticate.public.appProxy).toHaveBeenCalledTimes(1);
  });
});