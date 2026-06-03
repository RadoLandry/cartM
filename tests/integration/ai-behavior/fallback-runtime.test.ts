import { beforeEach, describe, expect, it, vi } from "vitest";

import { resolveStorefrontChatBehavior } from "../../../app/lib/ai/storefront-chat";

vi.mock("../../../app/lib/db/queries", () => ({
  getActiveAIBehaviorConfigWithFallback: vi.fn(),
}));

import { getActiveAIBehaviorConfigWithFallback } from "../../../app/lib/db/queries";

describe("storefront runtime behavior fallback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses active behavior when available", async () => {
    vi.mocked(getActiveAIBehaviorConfigWithFallback).mockResolvedValue({
      source: "active",
      config: {
        tone: "FRIENDLY",
        aggressiveness: 0.5,
        safetyPriority: "BALANCED",
        customGuidance: "Be concise.",
        conversationStarters: ["Quick check"],
      },
    } as never);

    const behavior = await resolveStorefrontChatBehavior("test.myshopify.com");

    expect(behavior.source).toBe("active");
    expect(behavior.config.tone).toBe("FRIENDLY");
  });

  it("falls back safely when active resolution fails", async () => {
    vi.mocked(getActiveAIBehaviorConfigWithFallback).mockRejectedValue(new Error("db unavailable"));

    const behavior = await resolveStorefrontChatBehavior("test.myshopify.com");

    expect(behavior.source).toBe("defaults");
    expect(behavior.config.safetyPriority).toBe("SAFETY_FIRST");
    expect(behavior.config.aggressiveness).toBeLessThanOrEqual(0.6);
  });
});
