import { beforeEach, describe, expect, it, vi } from "vitest";

import { action } from "../../../app/routes/api.ai.behavior.config";

vi.mock("../../../app/shopify.server", () => ({
  authenticate: {
    admin: vi.fn(),
  },
}));

vi.mock("../../../app/lib/db/queries", () => ({
  AIBehaviorVersionConflictError: class AIBehaviorVersionConflictError extends Error {},
  getAIBehaviorDraft: vi.fn(),
  getAIBehaviorVersionHistory: vi.fn().mockResolvedValue([]),
  getActiveAIBehaviorConfigWithFallback: vi.fn().mockResolvedValue({
    source: "defaults",
    config: {
      tone: "PROFESSIONAL",
      aggressiveness: 0.35,
      safetyPriority: "SAFETY_FIRST",
      customGuidance: "",
      conversationStarters: [],
    },
  }),
  saveAIBehaviorDraft: vi.fn(),
  writeAIBehaviorDraftSavedAudit: vi.fn(),
  publishAIBehaviorDraft: vi.fn(),
  rollbackAIBehaviorVersion: vi.fn(),
}));

import { authenticate } from "../../../app/shopify.server";
import { saveAIBehaviorDraft, writeAIBehaviorDraftSavedAudit } from "../../../app/lib/db/queries";

describe("ai behavior config route validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(authenticate.admin).mockResolvedValue({
      session: { shop: "test.myshopify.com" },
    } as never);

    vi.mocked(saveAIBehaviorDraft).mockResolvedValue({
      id: "draft_1",
      shop: "test.myshopify.com",
      versionToken: "next-token",
      updatedBy: "test.myshopify.com",
      updatedAt: new Date("2026-06-03T10:00:00.000Z"),
      createdAt: new Date("2026-06-03T09:00:00.000Z"),
      config: {
        tone: "PROFESSIONAL",
        aggressiveness: 0.6,
        safetyPriority: "SAFETY_FIRST",
        customGuidance: "",
        conversationStarters: [],
      },
    } as never);
  });

  it("returns 400 for malformed payload", async () => {
    const response = await action({
      request: new Request("http://localhost/api/ai/behavior/config", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ versionToken: "abc" }),
      }),
      params: {},
      context: {},
    } as never);

    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error.code).toBe("INVALID_CONFIG_REQUEST");
  });

  it("applies policy conflict resolution before persistence", async () => {
    const response = await action({
      request: new Request("http://localhost/api/ai/behavior/config", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          versionToken: "abc",
          draft: {
            tone: "COACHING",
            aggressiveness: 0.95,
            safetyPriority: "SAFETY_FIRST",
            customGuidance: "Guide safely",
            conversationStarters: ["Starter"],
          },
        }),
      }),
      params: {},
      context: {},
    } as never);

    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(saveAIBehaviorDraft).toHaveBeenCalledWith(expect.objectContaining({
      config: expect.objectContaining({
        aggressiveness: 0.6,
      }),
    }));
    expect(payload.ok).toBe(true);
    expect(writeAIBehaviorDraftSavedAudit).toHaveBeenCalledTimes(1);
  });
});
