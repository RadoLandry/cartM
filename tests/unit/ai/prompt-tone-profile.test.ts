import { describe, expect, it } from "vitest";

import { buildStorefrontChatSystemPrompt } from "../../../app/lib/ai/prompts";

function baseInput() {
  return {
    shop: "test.myshopify.com",
    cart: { items: [] } as never,
  };
}

describe("prompt tone profile composition", () => {
  it("reflects a friendly tone profile in the system prompt", () => {
    const prompt = buildStorefrontChatSystemPrompt({
      ...baseInput(),
      behavior: {
        tone: "FRIENDLY",
        aggressiveness: 0.3,
        safetyPriority: "BALANCED",
        customGuidance: "",
        conversationStarters: [],
      },
    });

    expect(prompt).toContain("Tone profile: friendly");
  });

  it("reflects a coaching tone profile in the system prompt", () => {
    const prompt = buildStorefrontChatSystemPrompt({
      ...baseInput(),
      behavior: {
        tone: "COACHING",
        aggressiveness: 0.3,
        safetyPriority: "SAFETY_FIRST",
        customGuidance: "",
        conversationStarters: [],
      },
    });

    expect(prompt).toContain("Tone profile: coaching");
  });
});
