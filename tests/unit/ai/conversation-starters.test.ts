import { describe, expect, it } from "vitest";

import { normalizeConversationStarters, AI_BEHAVIOR_LIMITS } from "../../../app/lib/ai/behavior-config";

describe("conversation starters normalization", () => {
  it("trims, dedupes, and caps starter count", () => {
    const starters = normalizeConversationStarters([
      "  Check my cart  ",
      "Check my cart",
      "What fits my budget?",
      "", // dropped
      42, // dropped, non-string
    ]);

    expect(starters).toEqual(["Check my cart", "What fits my budget?"]);
  });

  it("caps the number of starters at the configured maximum", () => {
    const many = Array.from({ length: 12 }, (_, index) => `Starter ${index}`);
    const starters = normalizeConversationStarters(many);

    expect(starters).toHaveLength(AI_BEHAVIOR_LIMITS.maxConversationStarters);
  });

  it("truncates individual starters exceeding the max length", () => {
    const long = "x".repeat(AI_BEHAVIOR_LIMITS.maxConversationStarterLength + 50);
    const starters = normalizeConversationStarters([long]);

    expect(starters[0]?.length).toBe(AI_BEHAVIOR_LIMITS.maxConversationStarterLength);
  });

  it("stops accumulating starters once total character budget is exceeded", () => {
    const starters = normalizeConversationStarters([
      "a".repeat(AI_BEHAVIOR_LIMITS.maxTotalStarterCharacters - 10),
      "b".repeat(50),
    ]);

    const totalChars = starters.reduce((sum, starter) => sum + starter.length, 0);
    expect(totalChars).toBeLessThanOrEqual(AI_BEHAVIOR_LIMITS.maxTotalStarterCharacters);
  });

  it("returns an empty array for non-array input", () => {
    expect(normalizeConversationStarters(undefined)).toEqual([]);
    expect(normalizeConversationStarters("not-an-array")).toEqual([]);
  });
});
