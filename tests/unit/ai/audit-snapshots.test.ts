import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../app/db.server", () => ({
  default: {
    aIBehaviorAuditEntry: {
      create: vi.fn(),
    },
  },
}));

import { writeAIBehaviorDraftSavedAudit } from "../../../app/lib/db/queries";
import db from "../../../app/db.server";

describe("AI behavior audit snapshot integrity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("preserves before/after config snapshots exactly when writing a draft-saved audit entry", async () => {
    const beforeSnapshot = {
      tone: "PROFESSIONAL" as const,
      aggressiveness: 0.3,
      safetyPriority: "SAFETY_FIRST" as const,
      customGuidance: "",
      conversationStarters: ["Can you check my cart?"],
    };
    const afterSnapshot = {
      tone: "FRIENDLY" as const,
      aggressiveness: 0.4,
      safetyPriority: "SAFETY_FIRST" as const,
      customGuidance: "Be warm and concise.",
      conversationStarters: ["Can you check my cart?", "What fits my budget?"],
    };

    vi.mocked(db.aIBehaviorAuditEntry.create).mockResolvedValue({} as never);

    await writeAIBehaviorDraftSavedAudit({
      shop: "test.myshopify.com",
      actorId: "test.myshopify.com",
      draftId: "draft_1",
      beforeSnapshot,
      afterSnapshot,
    });

    expect(db.aIBehaviorAuditEntry.create).toHaveBeenCalledTimes(1);
    const call = vi.mocked(db.aIBehaviorAuditEntry.create).mock.calls[0][0] as {
      data: {
        actionType: string;
        beforeSnapshot: unknown;
        afterSnapshot: unknown;
      };
    };

    expect(call.data.actionType).toBe("DRAFT_SAVED");
    expect(call.data.beforeSnapshot).toEqual(beforeSnapshot);
    expect(call.data.afterSnapshot).toEqual(afterSnapshot);
  });

  it("omits beforeSnapshot when no prior draft existed", async () => {
    vi.mocked(db.aIBehaviorAuditEntry.create).mockResolvedValue({} as never);

    await writeAIBehaviorDraftSavedAudit({
      shop: "test.myshopify.com",
      actorId: "test.myshopify.com",
      draftId: "draft_1",
      afterSnapshot: {
        tone: "PROFESSIONAL",
        aggressiveness: 0.3,
        safetyPriority: "SAFETY_FIRST",
        customGuidance: "",
        conversationStarters: [],
      },
    });

    const call = vi.mocked(db.aIBehaviorAuditEntry.create).mock.calls[0][0] as {
      data: { beforeSnapshot: unknown };
    };

    expect(call.data.beforeSnapshot).toBeUndefined();
  });
});
