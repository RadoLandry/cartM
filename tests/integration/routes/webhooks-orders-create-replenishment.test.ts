import { beforeEach, describe, expect, it, vi } from "vitest";

import { action } from "../../../app/routes/webhooks.orders.create";
import { updateCustomerPurchaseSummary } from "../../../app/lib/db/queries";
import { authenticate } from "../../../app/shopify.server";
import { makeOrderWebhookPayload, TEST_SHOP } from "../../helpers/replenishment-fixtures";

vi.mock("../../../app/shopify.server", () => ({
  authenticate: {
    webhook: vi.fn(),
  },
}));

vi.mock("../../../app/lib/db/queries", () => ({
  updateCustomerPurchaseSummary: vi.fn(),
}));

describe("orders create replenishment webhook scaffold", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(updateCustomerPurchaseSummary).mockResolvedValue(null as never);
  });

  it("blocks unauthenticated order webhooks", async () => {
    vi.mocked(authenticate.webhook).mockResolvedValueOnce({
      admin: undefined,
    } as never);

    const response = await action({
      request: new Request("http://localhost/webhooks/orders/create", { method: "POST" }),
      params: {},
      context: {},
    } as never);

    expect(response.status).toBe(401);
    expect(updateCustomerPurchaseSummary).not.toHaveBeenCalled();
  });

  it("continues to refresh purchase summary for authenticated order webhooks", async () => {
    const payload = makeOrderWebhookPayload();

    vi.mocked(authenticate.webhook).mockResolvedValueOnce({
      admin: {},
      shop: TEST_SHOP,
      payload,
    } as never);

    const response = await action({
      request: new Request("http://localhost/webhooks/orders/create", { method: "POST" }),
      params: {},
      context: {},
    } as never);

    expect(response.status).toBe(200);
    expect(updateCustomerPurchaseSummary).toHaveBeenCalledWith(
      TEST_SHOP,
      payload.customer.admin_graphql_api_id,
      expect.objectContaining({
        orderId: String(payload.id),
        currencyCode: payload.currency,
        productTitles: ["Hand Wraps", "Mouthguard"],
      }),
    );
  });
});