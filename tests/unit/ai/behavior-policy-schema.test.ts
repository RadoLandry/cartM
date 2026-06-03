import { describe, expect, it } from "vitest";

import {
  AIBehaviorDraftUpdateRequestSchema,
} from "../../../app/lib/ai/schemas";
import {
  normalizeAIBehaviorDraftPayload,
  resolveBehaviorPolicyConflict,
  validateAIBehaviorDraftPayload,
} from "../../../app/lib/ai/behavior-config";

describe("ai behavior policy schema", () => {
  it("accepts a valid draft request payload", () => {
    const payload = {
      versionToken: "v1",
      draft: {
        tone: "PROFESSIONAL",
        aggressiveness: 0.45,
        safetyPriority: "BALANCED",
        customGuidance: "Prioritize fit and budget framing.",
        conversationStarters: ["Can you check my cart for safety gaps?"],
      },
    };

    const parsed = AIBehaviorDraftUpdateRequestSchema.safeParse(payload);

    expect(parsed.success).toBe(true);
  });

  it("rejects invalid aggressiveness values", () => {
    const payload = {
      versionToken: "v1",
      draft: {
        tone: "FRIENDLY",
        aggressiveness: 1.2,
        safetyPriority: "SAFETY_FIRST",
        customGuidance: "",
        conversationStarters: [],
      },
    };

    const parsed = AIBehaviorDraftUpdateRequestSchema.safeParse(payload);

    expect(parsed.success).toBe(false);
  });

  it("normalizes starter values and detects policy conflicts", () => {
    const normalized = normalizeAIBehaviorDraftPayload({
      tone: "COACHING",
      aggressiveness: 0.95,
      safetyPriority: "SAFETY_FIRST",
      customGuidance: "  Keep recommendations practical.  ",
      conversationStarters: [
        "  Start with safety checks first.  ",
        "Start with safety checks first.",
        "",
      ],
    });

    expect(normalized.customGuidance).toBe("Keep recommendations practical.");
    expect(normalized.conversationStarters).toEqual(["Start with safety checks first."]);

    const conflict = resolveBehaviorPolicyConflict(normalized);
    expect(conflict.adjusted.aggressiveness).toBeLessThanOrEqual(0.6);
    expect(conflict.conflicts.length).toBeGreaterThan(0);
  });

  it("returns structured validation errors for oversized guidance", () => {
    const validation = validateAIBehaviorDraftPayload({
      tone: "PROFESSIONAL",
      aggressiveness: 0.5,
      safetyPriority: "BALANCED",
      customGuidance: "x".repeat(3000),
      conversationStarters: ["Starter"],
    });

    expect(validation.ok).toBe(false);
    expect(validation.issues.some((issue) => issue.code === "CUSTOM_GUIDANCE_TOO_LONG")).toBe(true);
  });
});
