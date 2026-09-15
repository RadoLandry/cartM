import { describe, expect, it } from "vitest";

import { buildStorefrontChatSystemPrompt } from "../../../app/lib/ai/prompts";
import { AI_BEHAVIOR_LIMITS } from "../../../app/lib/ai/behavior-config";

function baseInput() {
  return {
    shop: "test.myshopify.com",
    cart: { items: [] } as never,
  };
}

describe("prompt aggressiveness composition", () => {
  it("surfaces the configured aggressiveness value in the system prompt", () => {
    const prompt = buildStorefrontChatSystemPrompt({
      ...baseInput(),
      behavior: {
        tone: "PROFESSIONAL",
        aggressiveness: 0.5,
        safetyPriority: "BALANCED",
        customGuidance: "",
        conversationStarters: [],
      },
    });

    expect(prompt).toContain("Upsell aggressiveness: 0.5");
  });

  it("clamps aggressiveness to the safety-first ceiling in the composed prompt", () => {
    const prompt = buildStorefrontChatSystemPrompt({
      ...baseInput(),
      behavior: {
        tone: "PROFESSIONAL",
        aggressiveness: 0.95,
        safetyPriority: "SAFETY_FIRST",
        customGuidance: "",
        conversationStarters: [],
      },
    });

    expect(prompt).toContain(`Upsell aggressiveness: ${AI_BEHAVIOR_LIMITS.maxSafetyFirstAggressiveness}`);
  });
});
