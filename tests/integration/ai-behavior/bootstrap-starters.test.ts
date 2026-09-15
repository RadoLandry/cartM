import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../app/shopify.server", () => ({
  authenticate: {
    public: {
      appProxy: vi.fn(),
    },
  },
}));

vi.mock("../../../app/lib/db/queries", () => ({
  getActiveAIBehaviorConfigWithFallback: vi.fn(),
}));

import { action } from "../../../app/routes/api.app-proxy.chat-bootstrap";
import { authenticate } from "../../../app/shopify.server";
import { getActiveAIBehaviorConfigWithFallback } from "../../../app/lib/db/queries";

describe("chat bootstrap conversation starters", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.STOREFRONT_CHAT_SIGNING_SECRET = "test-signing-secret";
    vi.mocked(authenticate.public.appProxy).mockResolvedValue(undefined as never);
  });

  it("returns the active behavior's conversation starters in the bootstrap payload", async () => {
    vi.mocked(getActiveAIBehaviorConfigWithFallback).mockResolvedValue({
      source: "active",
      config: {
        tone: "PROFESSIONAL",
        aggressiveness: 0.35,
        safetyPriority: "SAFETY_FIRST",
        customGuidance: "",
        conversationStarters: ["Can you check my cart?", "What fits my budget?"],
      },
    } as never);

    const response = await action({
      request: new Request("http://localhost/apps/cartmind/chat-bootstrap", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          shop: "test.myshopify.com",
          surface: "cart_drawer",
          sessionId: "session-1",
          currencyCode: "USD",
        }),
      }),
      params: {},
      context: {},
    } as never);

    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.bootstrap.conversationStarters).toEqual(["Can you check my cart?", "What fits my budget?"]);
  });

  it("falls back to an empty starter list when behavior resolution fails", async () => {
    vi.mocked(getActiveAIBehaviorConfigWithFallback).mockRejectedValue(new Error("db unavailable"));

    const response = await action({
      request: new Request("http://localhost/apps/cartmind/chat-bootstrap", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          shop: "test.myshopify.com",
          surface: "cart_drawer",
          sessionId: "session-2",
          currencyCode: "USD",
        }),
      }),
      params: {},
      context: {},
    } as never);

    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.bootstrap.conversationStarters).toEqual([]);
  });
});
