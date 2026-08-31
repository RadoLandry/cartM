import { describe, it, expect, vi, beforeEach } from "vitest";
import { action as createAction } from "../../../app/routes/webhooks.products.create";
import { action as updateAction } from "../../../app/routes/webhooks.products.update";
import { action as deleteAction } from "../../../app/routes/webhooks.products.delete";
import { authenticate } from "../../../app/shopify.server";
import { handleProductWebhook } from "../../../app/lib/knowledge-graph/ingestion";
import { createWebhookEvent } from "../../../app/lib/db/queries";

vi.mock("../../../app/shopify.server", () => ({
  authenticate: {
    webhook: vi.fn(),
  },
}));

vi.mock("../../../app/lib/knowledge-graph/ingestion", () => ({
  handleProductWebhook: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../../app/lib/db/queries", () => ({
  createWebhookEvent: vi.fn(),
  markWebhookProcessed: vi.fn().mockResolvedValue(undefined), // kept in mock for route internals
}));

const getMockRequest = () => new Request("http://localhost/webhooks", { method: "POST" });

describe("Product Webhooks Routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should block unauthenticated webhooks (no admin returned)", async () => {
    vi.mocked(authenticate.webhook).mockResolvedValueOnce({
      admin: undefined,
    } as any);

    const response = await createAction({ request: getMockRequest(), params: {}, context: {} } as unknown as Parameters<typeof createAction>[0]);
    expect(response.status).toBe(401);
    expect(handleProductWebhook).not.toHaveBeenCalled();
  });

  it("should suppress duplicate webhooks and return 200", async () => {
    vi.mocked(authenticate.webhook).mockResolvedValueOnce({
      admin: {} as any,
      topic: "products/update",
      shop: "test.myshopify.com",
      webhookId: "wh_123",
      payload: { id: "gid://shopify/Product/1" },
    } as any);

    vi.mocked(createWebhookEvent).mockResolvedValueOnce({ processingStatus: "DUPLICATE" } as any);

    const response = await updateAction({ request: getMockRequest(), params: {}, context: {} } as unknown as Parameters<typeof updateAction>[0]);
    expect(response.status).toBe(200);
    expect(createWebhookEvent).toHaveBeenCalledWith("test.myshopify.com", "wh_123", "products/update", { id: "gid://shopify/Product/1" });
    expect(handleProductWebhook).not.toHaveBeenCalled();
  });

  it("should process valid webhooks asynchronously", async () => {
    const admin = { graphql: vi.fn().mockResolvedValue({ json: vi.fn().mockResolvedValue({}) }) };

    vi.mocked(authenticate.webhook).mockResolvedValueOnce({
      admin,
      topic: "products/delete",
      shop: "test.myshopify.com",
      webhookId: "wh_new",
      payload: { id: "gid://shopify/Product/1" },
    } as any);

    vi.mocked(createWebhookEvent).mockResolvedValueOnce({ processingStatus: "PENDING" } as any);

    const response = await deleteAction({ request: getMockRequest(), params: {}, context: {} } as unknown as Parameters<typeof deleteAction>[0]);
    
    expect(response.status).toBe(200);
    expect(handleProductWebhook).toHaveBeenCalledWith("test.myshopify.com", { id: "gid://shopify/Product/1" }, "products/delete", admin);
  });
});

// T026 — Product lifecycle regression: relationship invalidation contract
describe("Product lifecycle — relationship invalidation contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  it("handleProductWebhook is invoked for delete events (relationship invalidation delegation)", async () => {
    const admin = { graphql: vi.fn() };

    vi.mocked(authenticate.webhook).mockResolvedValueOnce({
      admin,
      topic: "products/delete",
      shop: "test.myshopify.com",
      webhookId: "wh_del_001",
      payload: { id: "gid://shopify/Product/999" },
    } as any);

    vi.mocked(createWebhookEvent).mockResolvedValueOnce({ processingStatus: "PENDING" } as any);

    const response = await deleteAction({ request: getMockRequest(), params: {}, context: {} } as unknown as Parameters<typeof deleteAction>[0]);

    expect(response.status).toBe(200);
    // handleProductWebhook is responsible for calling invalidateRelationshipsForProduct internally
    expect(handleProductWebhook).toHaveBeenCalledWith(
      "test.myshopify.com",
      { id: "gid://shopify/Product/999" },
      "products/delete",
      admin,
    );
  });

  it("handleProductWebhook is not called for duplicate delete events", async () => {
    vi.mocked(authenticate.webhook).mockResolvedValueOnce({
      admin: {} as any,
      topic: "products/delete",
      shop: "test.myshopify.com",
      webhookId: "wh_dup_del",
      payload: { id: "gid://shopify/Product/999" },
    } as any);

    vi.mocked(createWebhookEvent).mockResolvedValueOnce({ processingStatus: "DUPLICATE" } as any);

    const response = await deleteAction({ request: getMockRequest(), params: {}, context: {} } as unknown as Parameters<typeof deleteAction>[0]);

    expect(response.status).toBe(200);
    expect(handleProductWebhook).not.toHaveBeenCalled();
  });
});
