import { beforeEach, describe, expect, it, vi } from "vitest";

import { action } from "../../../app/routes/api.ai.recommendations";
import * as dbQueries from "../../../app/lib/db/queries";
import { makeCoordinatedCart } from "../../helpers/style-fixtures";
import {
  makeReplenishmentRecommendationRequest,
  TEST_SHOP,
} from "../../helpers/replenishment-fixtures";

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

describe("replenishment recommendations route scaffold", () => {
  beforeEach(() => {
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

  it("accepts replenishment request fixtures without breaking the existing recommendation response", async () => {
    const input = makeReplenishmentRecommendationRequest();

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
    expect(payload.request.shopifyCustomerId).toBe(input.shopifyCustomerId);
  });

  it("keeps the current style payload stable while replenishment wiring is still pending", async () => {
    const response = await action({
      request: new Request("http://localhost/api/ai/recommendations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(makeReplenishmentRecommendationRequest()),
      }),
      params: {},
      context: {},
    } as never);
    const payload = await response.json();

    expect(payload.style.summary).toEqual({
      status: "hidden",
      coherenceScore: "0.90",
      reason: "The cart is already visually coordinated.",
    });
    expect(payload.replenishment).toBeUndefined();
  });
});