import { afterEach, describe, expect, it, vi } from "vitest";

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

describe("storefront chat stream route", () => {
  it("streams text and guidance parts for a valid shopper request", async () => {
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
  });

  it("rejects malformed tokens before streaming begins", async () => {
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
});