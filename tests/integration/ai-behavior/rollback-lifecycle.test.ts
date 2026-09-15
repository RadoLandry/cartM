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
import { rollbackAIBehaviorVersion } from "../../../app/lib/db/queries";

describe("ai behavior rollback lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(authenticate.admin).mockResolvedValue({
      session: { shop: "test.myshopify.com" },
    } as never);
  });

  it("returns 400 when targetVersionId is missing", async () => {
    const response = await action({
      request: new Request("http://localhost/api/ai/behavior/config", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ intent: "rollback" }),
      }),
      params: {},
      context: {},
    } as never);

    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.ok).toBe(false);
    expect(payload.error.code).toBe("INVALID_ROLLBACK_REQUEST");
  });

  it("rolls back to the target version and archives the previous active version", async () => {
    vi.mocked(rollbackAIBehaviorVersion).mockResolvedValue({
      id: "version_restored",
      versionNumber: 3,
      status: "ACTIVE",
      publishedAt: new Date("2026-06-05T10:00:00.000Z"),
      publishedBy: "test.myshopify.com",
    } as never);

    const response = await action({
      request: new Request("http://localhost/api/ai/behavior/config", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ intent: "rollback", targetVersionId: "version_1", reason: "Regression" }),
      }),
      params: {},
      context: {},
    } as never);

    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.activeVersion.versionNumber).toBe(3);
    expect(rollbackAIBehaviorVersion).toHaveBeenCalledWith(expect.objectContaining({
      shop: "test.myshopify.com",
      targetVersionId: "version_1",
      reason: "Regression",
    }));
  });
});
