import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../app/shopify.server", () => ({
  authenticate: {
    admin: vi.fn(),
  },
}));

vi.mock("../../../app/lib/db/queries", () => ({
  AIBehaviorVersionConflictError: class AIBehaviorVersionConflictError extends Error {},
  getAIBehaviorDraft: vi.fn(),
  getAIBehaviorVersionHistory: vi.fn(),
  getActiveAIBehaviorConfigWithFallback: vi.fn(),
  publishAIBehaviorDraft: vi.fn(),
  rollbackAIBehaviorVersion: vi.fn(),
  saveAIBehaviorDraft: vi.fn(),
  writeAIBehaviorDraftSavedAudit: vi.fn(),
  createAIBehaviorPreviewRun: vi.fn(),
}));

import { action as configAction, loader as configLoader } from "../../../app/routes/api.ai.behavior.config";
import { action as previewAction } from "../../../app/routes/api.ai.behavior.preview";
import { authenticate } from "../../../app/shopify.server";
import {
  getAIBehaviorDraft,
  getAIBehaviorVersionHistory,
  getActiveAIBehaviorConfigWithFallback,
  publishAIBehaviorDraft,
  rollbackAIBehaviorVersion,
  saveAIBehaviorDraft,
  createAIBehaviorPreviewRun,
} from "../../../app/lib/db/queries";
import {
  AIBehaviorConfigResponseSchema,
  AIBehaviorDraftUpdateResponseSchema,
  AIBehaviorPreviewReadyResponseSchema,
  AIBehaviorPublishRollbackResponseSchema,
} from "../../../app/lib/ai/schemas";

const SAMPLE_CONFIG = {
  tone: "PROFESSIONAL" as const,
  aggressiveness: 0.35,
  safetyPriority: "SAFETY_FIRST" as const,
  customGuidance: "",
  conversationStarters: [],
};

describe("ai behavior API contract conformance", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(authenticate.admin).mockResolvedValue({
      session: { shop: "test.myshopify.com" },
    } as never);
  });

  it("GET /api/ai/behavior/config matches GetConfigResponse contract", async () => {
    vi.mocked(getAIBehaviorDraft).mockResolvedValue({
      id: "draft_1",
      shop: "test.myshopify.com",
      versionToken: "token_1",
      updatedBy: "test.myshopify.com",
      updatedAt: new Date("2026-06-03T10:00:00.000Z"),
      createdAt: new Date("2026-06-03T09:00:00.000Z"),
      config: SAMPLE_CONFIG,
    } as never);
    vi.mocked(getActiveAIBehaviorConfigWithFallback).mockResolvedValue({
      source: "defaults",
      config: SAMPLE_CONFIG,
    } as never);
    vi.mocked(getAIBehaviorVersionHistory).mockResolvedValue([
      {
        id: "version_1",
        versionNumber: 1,
        status: "ACTIVE",
        publishedAt: new Date("2026-06-03T09:00:00.000Z"),
        publishedBy: "test.myshopify.com",
      },
    ] as never);

    const response = await configLoader({
      request: new Request("http://localhost/api/ai/behavior/config"),
      params: {},
      context: {},
    } as never);

    const payload = await response.json();
    const parsed = AIBehaviorConfigResponseSchema.safeParse(payload);

    expect(parsed.success).toBe(true);
  });

  it("PUT /api/ai/behavior/config matches UpdateDraftResponse contract", async () => {
    vi.mocked(getAIBehaviorDraft).mockResolvedValue(null);
    vi.mocked(saveAIBehaviorDraft).mockResolvedValue({
      id: "draft_1",
      shop: "test.myshopify.com",
      versionToken: "token_2",
      updatedBy: "test.myshopify.com",
      updatedAt: new Date("2026-06-03T10:00:00.000Z"),
      createdAt: new Date("2026-06-03T09:00:00.000Z"),
      config: SAMPLE_CONFIG,
    } as never);

    const response = await configAction({
      request: new Request("http://localhost/api/ai/behavior/config", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ versionToken: "initial", draft: SAMPLE_CONFIG }),
      }),
      params: {},
      context: {},
    } as never);

    const payload = await response.json();
    const parsed = AIBehaviorDraftUpdateResponseSchema.safeParse(payload);

    expect(parsed.success).toBe(true);
  });

  it("POST /api/ai/behavior/config (publish) matches PublishResponse/RollbackResponse shared contract", async () => {
    vi.mocked(publishAIBehaviorDraft).mockResolvedValue({
      id: "version_2",
      versionNumber: 2,
      status: "ACTIVE",
      publishedAt: new Date("2026-06-04T10:00:00.000Z"),
      publishedBy: "test.myshopify.com",
    } as never);

    const response = await configAction({
      request: new Request("http://localhost/api/ai/behavior/config", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      }),
      params: {},
      context: {},
    } as never);

    const payload = await response.json();
    const parsed = AIBehaviorPublishRollbackResponseSchema.safeParse(payload);

    expect(parsed.success).toBe(true);
  });

  it("POST /api/ai/behavior/config (rollback intent) matches PublishResponse/RollbackResponse shared contract", async () => {
    vi.mocked(rollbackAIBehaviorVersion).mockResolvedValue({
      id: "version_restored",
      versionNumber: 3,
      status: "ACTIVE",
      publishedAt: new Date("2026-06-05T10:00:00.000Z"),
      publishedBy: "test.myshopify.com",
    } as never);

    const response = await configAction({
      request: new Request("http://localhost/api/ai/behavior/config", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ intent: "rollback", targetVersionId: "version_1" }),
      }),
      params: {},
      context: {},
    } as never);

    const payload = await response.json();
    const parsed = AIBehaviorPublishRollbackResponseSchema.safeParse(payload);

    expect(parsed.success).toBe(true);
  });

  it("POST /api/ai/behavior/preview matches PreviewReadyResponse contract", async () => {
    vi.mocked(createAIBehaviorPreviewRun).mockResolvedValue({ id: "preview_run_1" } as never);

    const response = await previewAction({
      request: new Request("http://localhost/api/ai/behavior/preview", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          draft: SAMPLE_CONFIG,
          scenarios: [{ scenarioId: "s1", shopperMessage: "Can you check my cart?" }],
        }),
      }),
      params: {},
      context: {},
    } as never);

    const payload = await response.json();
    const parsed = AIBehaviorPreviewReadyResponseSchema.safeParse(payload);

    expect(parsed.success).toBe(true);
  });
});
