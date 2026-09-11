import { beforeEach, describe, expect, it, vi } from "vitest";

import { action } from "../../../app/routes/webhooks.orders.create";
import { getReplenishmentActionTargets, updateCustomerPurchaseSummary, upsertCustomerPurchaseSnapshot } from "../../../app/lib/db/queries";
import { authenticate } from "../../../app/shopify.server";
import { makeOrderWebhookPayload, TEST_SHOP } from "../../helpers/replenishment-fixtures";

vi.mock("../../../app/shopify.server", () => ({
  authenticate: {
    webhook: vi.fn(),
  },
}));

vi.mock("../../../app/lib/db/queries", () => ({
  updateCustomerPurchaseSummary: vi.fn(),
  getReplenishmentActionTargets: vi.fn(),
  upsertCustomerPurchaseSnapshot: vi.fn(),
}));

describe("orders create replenishment webhook scaffold", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(updateCustomerPurchaseSummary).mockResolvedValue(null as never);
    vi.mocked(getReplenishmentActionTargets).mockResolvedValue(new Map() as never);
    vi.mocked(upsertCustomerPurchaseSnapshot).mockResolvedValue(null as never);
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

  it("upserts replenishment purchase snapshots and resets the due-window clock for known-category line items", async () => {
    const payload = {
      ...makeOrderWebhookPayload(),
      line_items: [
        {
          title: "Hand Wraps",
          quantity: 1,
          price: "14.99",
          admin_graphql_api_id: "gid://shopify/Product/1",
        },
      ],
    };

    vi.mocked(authenticate.webhook).mockResolvedValueOnce({
      admin: {},
      shop: TEST_SHOP,
      payload,
    } as never);
    vi.mocked(getReplenishmentActionTargets).mockResolvedValueOnce(
      new Map([["gid://shopify/Product/1", { productId: "gid://shopify/Product/1", categoryTag: "hand-wraps", available: true }]]) as never,
    );

    const response = await action({
      request: new Request("http://localhost/webhooks/orders/create", { method: "POST" }),
      params: {},
      context: {},
    } as never);

    expect(response.status).toBe(200);
    expect(upsertCustomerPurchaseSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        shop: TEST_SHOP,
        shopifyCustomerId: payload.customer.admin_graphql_api_id,
        productId: "gid://shopify/Product/1",
        categoryTag: "hand-wraps",
        quantity: 1,
        title: "Hand Wraps",
      }),
    );
  });
});