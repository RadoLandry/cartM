import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { action } from "../../../app/routes/api.ai.recommendations";
import * as dbQueries from "../../../app/lib/db/queries";
import { makeCoordinatedCart } from "../../helpers/style-fixtures";
import {
  TEST_SHOP,
  TEST_SESSION_ID,
  makeCustomerProfileRecommendationRequest,
} from "../../helpers/customer-profile-fixtures";

vi.mock("../../../app/lib/db/queries", () => ({
  getColorCompatibilityRulesForKeys: vi.fn(),
  getCustomerProfile: vi.fn(),
  getReplenishmentActionTargets: vi.fn(),
  getSessionCustomerProfile: vi.fn(),
  listActiveReplenishmentLifecycleRules: vi.fn(),
  listCustomerPurchaseSnapshots: vi.fn(),
  listCartVisualItems: vi.fn(),
  listStyleCandidateProducts: vi.fn(),
}));

describe("customer profile recommendations route scaffold", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-27T12:00:00.000Z"));
    vi.clearAllMocks();
    vi.mocked(dbQueries.getColorCompatibilityRulesForKeys).mockResolvedValue([] as never);
    vi.mocked(dbQueries.getCustomerProfile).mockResolvedValue(null as never);
    vi.mocked(dbQueries.getReplenishmentActionTargets).mockResolvedValue(new Map() as never);
    vi.mocked(dbQueries.getSessionCustomerProfile).mockResolvedValue(null as never);
    vi.mocked(dbQueries.listActiveReplenishmentLifecycleRules).mockResolvedValue([] as never);
    vi.mocked(dbQueries.listCustomerPurchaseSnapshots).mockResolvedValue([] as never);
    vi.mocked(dbQueries.listCartVisualItems).mockResolvedValue(makeCoordinatedCart() as never);
    vi.mocked(dbQueries.listStyleCandidateProducts).mockResolvedValue([] as never);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("accepts customer-profile scenario fixtures without breaking the existing style response", async () => {
    const input = makeCustomerProfileRecommendationRequest();

    const response = await action({
      request: new Request("http://localhost/api/ai/recommendations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      }),
      params: {},
      context: {},
    } as never);
    const payload = await response.json();

    expect(dbQueries.listCartVisualItems).toHaveBeenCalledWith(TEST_SHOP, input.cart);
    expect(payload.ok).toBe(true);
    expect(payload.style.summary).toEqual({
      status: "hidden",
      coherenceScore: "0.90",
      reason: "The cart is already visually coordinated.",
    });
  });

  it("preserves shopper identity and explicit profile input in the validated action request contract", async () => {
    const input = makeCustomerProfileRecommendationRequest({
      profileInput: {
        discipline: "muay-thai",
        experienceLevel: "intermediate",
        weightClass: "lightweight",
        knownSizes: {
          gloves_oz: "12oz",
          apparel_alpha: "S",
        },
      },
    });

    const response = await action({
      request: new Request("http://localhost/api/ai/recommendations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      }),
      params: {},
      context: {},
    } as never);
    const payload = await response.json();

    expect(payload.request.shopifyCustomerId).toBe(input.shopifyCustomerId);
    expect(payload.request.sessionId).toBe(input.sessionId);
    expect(payload.request.profileInput).toEqual(input.profileInput);
  });

  it("returns a recognized-shopper personalization summary when stored history exists", async () => {
    const input = makeCustomerProfileRecommendationRequest({
      profileInput: undefined,
    });

    vi.mocked(dbQueries.getCustomerProfile).mockResolvedValue({
      id: "profile-1",
      shop: TEST_SHOP,
      shopifyCustomerId: input.shopifyCustomerId,
      sessionId: undefined,
      sizeProfile: {
        gloves_oz: "14oz",
        apparel_alpha: "M",
      },
      disciplineProfile: {
        primaryDiscipline: "boxing",
        weights: {
          boxing: 0.91,
        },
      },
      explicitProfile: {
        experienceLevel: "advanced",
      },
      purchaseSummary: {
        totalOrders: 4,
        repeatCategoryTags: ["gloves", "headgear"],
      },
      behaviorSummary: {
        recentCategoryTags: ["gloves", "boxing-gloves"],
      },
      confidenceSummary: {
        overall: 0.87,
        sizeProfile: 0.93,
      },
      lastActiveAt: new Date("2026-05-26T12:00:00.000Z"),
      createdAt: new Date("2026-05-01T12:00:00.000Z"),
      updatedAt: new Date("2026-05-26T12:00:00.000Z"),
    } as never);

    const response = await action({
      request: new Request("http://localhost/api/ai/recommendations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      }),
      params: {},
      context: {},
    } as never);
    const payload = await response.json();

    expect(dbQueries.getCustomerProfile).toHaveBeenCalledWith(
      TEST_SHOP,
      input.shopifyCustomerId,
      input.sessionId,
    );
    expect(payload.personalization).toEqual({
      profileKey: `${TEST_SHOP}:customer:${input.shopifyCustomerId}`,
      identityMode: "customer",
      guidanceMode: "strong_personalization",
      recencyState: "fresh",
      confidence: 0.87,
      purchaseFrequency: "repeat",
      knownSizes: {
        gloves_oz: "14oz",
        apparel_alpha: "M",
      },
      disciplinePreferences: [
        {
          discipline: "boxing",
          score: 0.91,
          source: "purchase_history",
        },
      ],
      sourceSummary: expect.arrayContaining([
        expect.objectContaining({
          attribute: "discipline",
          source: "purchase_history",
          confidence: 0.91,
        }),
      ]),
    });
  });

  it("returns an anonymous-session personalization summary scoped to the provided session id", async () => {
    const input = makeCustomerProfileRecommendationRequest({
      shopifyCustomerId: undefined,
      sessionId: TEST_SESSION_ID,
      profileInput: undefined,
    });

    vi.mocked(dbQueries.getSessionCustomerProfile).mockResolvedValue({
      id: "profile-session-1",
      shop: TEST_SHOP,
      shopifyCustomerId: undefined,
      sessionId: TEST_SESSION_ID,
      sizeProfile: {
        gloves_oz: "12oz",
      },
      disciplineProfile: {
        primaryDiscipline: "muay-thai",
        weights: {
          "muay-thai": 0.72,
        },
      },
      explicitProfile: {},
      purchaseSummary: {},
      behaviorSummary: {
        recentCategoryTags: ["shin-guards"],
      },
      confidenceSummary: {
        overall: 0.68,
        sizeProfile: 0.8,
      },
      lastActiveAt: new Date("2026-05-26T12:00:00.000Z"),
      createdAt: new Date("2026-05-25T12:00:00.000Z"),
      updatedAt: new Date("2026-05-26T12:00:00.000Z"),
    } as never);

    const response = await action({
      request: new Request("http://localhost/api/ai/recommendations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      }),
      params: {},
      context: {},
    } as never);
    const payload = await response.json();

    expect(dbQueries.getSessionCustomerProfile).toHaveBeenCalledWith(
      TEST_SHOP,
      TEST_SESSION_ID,
    );
    expect(payload.personalization).toEqual({
      profileKey: `${TEST_SHOP}:session:${TEST_SESSION_ID}`,
      identityMode: "session",
      guidanceMode: "light_personalization",
      recencyState: "fresh",
      confidence: 0.68,
      knownSizes: {
        gloves_oz: "12oz",
      },
      disciplinePreferences: [
        {
          discipline: "muay-thai",
          score: 0.72,
          source: "purchase_history",
        },
      ],
      sourceSummary: expect.arrayContaining([
        expect.objectContaining({
          attribute: "discipline",
          source: "purchase_history",
          confidence: 0.72,
        }),
      ]),
    });
  });

  it("lets explicit profileInput override a conflicting stored discipline and size in the personalization response", async () => {
    const input = makeCustomerProfileRecommendationRequest({
      profileInput: {
        discipline: "muay-thai",
        knownSizes: { gloves_oz: "16oz" },
      },
    });

    vi.mocked(dbQueries.getCustomerProfile).mockResolvedValue({
      id: "profile-1",
      shop: TEST_SHOP,
      shopifyCustomerId: input.shopifyCustomerId,
      sessionId: undefined,
      sizeProfile: { gloves_oz: "14oz" },
      disciplineProfile: { primaryDiscipline: "boxing", weights: { boxing: 0.91 } },
      explicitProfile: {},
      purchaseSummary: { totalOrders: 4 },
      behaviorSummary: {},
      confidenceSummary: { overall: 0.87, sizeProfile: 0.93 },
      lastActiveAt: new Date("2026-05-26T12:00:00.000Z"),
      createdAt: new Date("2026-05-01T12:00:00.000Z"),
      updatedAt: new Date("2026-05-26T12:00:00.000Z"),
    } as never);

    const response = await action({
      request: new Request("http://localhost/api/ai/recommendations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      }),
      params: {},
      context: {},
    } as never);
    const payload = await response.json();

    expect(payload.personalization.disciplinePreferences[0]).toEqual({
      discipline: "muay-thai",
      score: 1,
      source: "explicit",
    });
    expect(payload.personalization.knownSizes.gloves_oz).toBe("16oz");
  });
});