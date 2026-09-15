import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../app/shopify.server", () => ({
  authenticate: {
    admin: vi.fn(),
  },
}));

vi.mock("../../../app/lib/db/queries", () => ({
  AIBehaviorVersionConflictError: class AIBehaviorVersionConflictError extends Error {},
  getAIBehaviorDraft: vi.fn(),
  getAIBehaviorVersionHistory: vi.fn().mockResolvedValue([]),
  getActiveAIBehaviorConfigWithFallback: vi.fn(),
  publishAIBehaviorDraft: vi.fn(),
  rollbackAIBehaviorVersion: vi.fn(),
  saveAIBehaviorDraft: vi.fn(),
  writeAIBehaviorDraftSavedAudit: vi.fn(),
}));

import { action } from "../../../app/routes/api.ai.behavior.config";
import { authenticate } from "../../../app/shopify.server";
import { publishAIBehaviorDraft } from "../../../app/lib/db/queries";

describe("ai behavior publish lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(authenticate.admin).mockResolvedValue({
      session: { shop: "test.myshopify.com" },
    } as never);
  });

  it("publishes the current draft and returns the new active version", async () => {
    vi.mocked(publishAIBehaviorDraft).mockResolvedValue({
      id: "version_2",
      versionNumber: 2,
      status: "ACTIVE",
      publishedAt: new Date("2026-06-04T10:00:00.000Z"),
      publishedBy: "test.myshopify.com",
    } as never);

    const response = await action({
      request: new Request("http://localhost/api/ai/behavior/config", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reason: "Quarterly tone update" }),
      }),
      params: {},
      context: {},
    } as never);

    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.activeVersion.versionNumber).toBe(2);
    expect(publishAIBehaviorDraft).toHaveBeenCalledWith(expect.objectContaining({
      shop: "test.myshopify.com",
      reason: "Quarterly tone update",
    }));
  });

  it("returns 422 when publish fails", async () => {
    vi.mocked(publishAIBehaviorDraft).mockRejectedValue(new Error("No AI behavior draft found for shop"));

    const response = await action({
      request: new Request("http://localhost/api/ai/behavior/config", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      }),
      params: {},
      context: {},
    } as never);

    const payload = await response.json();

    expect(response.status).toBe(422);
    expect(payload.ok).toBe(false);
    expect(payload.error.code).toBe("PUBLISH_FAILED");
  });
});
