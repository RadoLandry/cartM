import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../app/shopify.server", () => ({
  authenticate: {
    admin: vi.fn(),
  },
}));

vi.mock("../../../app/lib/db/queries", () => ({
  createAIBehaviorPreviewRun: vi.fn(),
}));

vi.mock("../../../app/lib/ai/behavior-preview", () => ({
  runAIBehaviorPreviewScenarios: vi.fn(),
}));

import { action } from "../../../app/routes/api.ai.behavior.preview";
import { authenticate } from "../../../app/shopify.server";
import { createAIBehaviorPreviewRun } from "../../../app/lib/db/queries";
import { runAIBehaviorPreviewScenarios } from "../../../app/lib/ai/behavior-preview";

describe("ai behavior preview route contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(authenticate.admin).mockResolvedValue({
      session: { shop: "test.myshopify.com" },
    } as never);

    vi.mocked(createAIBehaviorPreviewRun).mockResolvedValue({
      id: "preview_run_1",
    } as never);
    vi.mocked(runAIBehaviorPreviewScenarios).mockImplementation((input) => [
      {
        scenarioId: input.scenarios[0]?.scenarioId ?? "s1",
        assistantResponse: "I can help with that.",
        policyChecks: { safetyCompliant: true, notes: [] },
      },
    ]);
  });

  it("returns 400 for an invalid preview request", async () => {
    const response = await action({
      request: new Request("http://localhost/api/ai/behavior/preview", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ draft: {} }),
      }),
      params: {},
      context: {},
    } as never);

    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.ok).toBe(false);
    expect(payload.error.code).toBe("INVALID_PREVIEW_REQUEST");
  });

  it("returns READY with scenario results for a valid draft", async () => {
    const response = await action({
      request: new Request("http://localhost/api/ai/behavior/preview", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          draft: {
            tone: "PROFESSIONAL",
            aggressiveness: 0.4,
            safetyPriority: "SAFETY_FIRST",
            customGuidance: "Always double-check fit.",
            conversationStarters: ["Can you check my cart?"],
          },
          scenarios: [
            { scenarioId: "s1", shopperMessage: "Can I remove my helmet to save money?" },
          ],
        }),
      }),
      params: {},
      context: {},
    } as never);

    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.status).toBe("READY");
    expect(payload.previewRunId).toBe("preview_run_1");
    expect(payload.results).toHaveLength(1);
    expect(payload.results[0].scenarioId).toBe("s1");
    expect(payload.results[0].policyChecks.safetyCompliant).toBe(true);
    expect(createAIBehaviorPreviewRun).toHaveBeenCalledWith(expect.objectContaining({
      status: "READY",
    }));
  });

  it("returns a retryable 500 and persists a FAILED run when the scenario runner throws", async () => {
    vi.mocked(runAIBehaviorPreviewScenarios).mockImplementation(() => {
      throw new Error("boom");
    });

    const response = await action({
      request: new Request("http://localhost/api/ai/behavior/preview", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          draft: {
            tone: "PROFESSIONAL",
            aggressiveness: 0.4,
            safetyPriority: "SAFETY_FIRST",
            customGuidance: "",
            conversationStarters: [],
          },
          scenarios: [{ scenarioId: "s1", shopperMessage: "Can I remove my helmet?" }],
        }),
      }),
      params: {},
      context: {},
    } as never);

    const payload = await response.json();

    expect(response.status).toBe(500);
    expect(payload.ok).toBe(false);
    expect(payload.error.code).toBe("PREVIEW_RUNNER_FAILED");
    expect(payload.error.retryable).toBe(true);
    expect(createAIBehaviorPreviewRun).toHaveBeenCalledWith(expect.objectContaining({
      status: "FAILED",
    }));
  });

  it("still returns READY results when persisting the preview run fails", async () => {
    vi.mocked(createAIBehaviorPreviewRun).mockRejectedValue(new Error("db unavailable"));

    const response = await action({
      request: new Request("http://localhost/api/ai/behavior/preview", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          draft: {
            tone: "PROFESSIONAL",
            aggressiveness: 0.4,
            safetyPriority: "SAFETY_FIRST",
            customGuidance: "",
            conversationStarters: [],
          },
          scenarios: [{ scenarioId: "s1", shopperMessage: "Can I remove my helmet?" }],
        }),
      }),
      params: {},
      context: {},
    } as never);

    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.status).toBe("READY");
    expect(payload.previewRunId).toBe("unpersisted");
    expect(payload.results).toHaveLength(1);
  });
});
