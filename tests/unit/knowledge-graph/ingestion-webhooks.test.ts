import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../app/lib/db/queries", () => ({
  createSyncJob: vi.fn(),
  deleteProduct: vi.fn().mockResolvedValue(undefined),
  getActiveSyncJob: vi.fn(),
  upsertProduct: vi.fn().mockResolvedValue({ id: "product-1" }),
  updateProductEmbedding: vi.fn().mockResolvedValue(undefined),
  updateProductClassification: vi.fn().mockResolvedValue(undefined),
  findProductByShopifyId: vi.fn().mockResolvedValue(null),
  getProductVisualProfile: vi.fn().mockResolvedValue(null),
  getProductSnapshotsForShop: vi.fn().mockResolvedValue([]),
  upsertProductVisualProfile: vi.fn().mockResolvedValue(null),
  upsertCandidateRelationship: vi.fn().mockResolvedValue(null),
  invalidateRelationshipsForProduct: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../../app/lib/knowledge-graph/embeddings", () => ({
  generateProductEmbeddingWithRetry: vi.fn().mockResolvedValue([0.1, 0.2]),
}));

vi.mock("../../../app/lib/knowledge-graph/colorways", () => ({
  extractDominantColors: vi.fn().mockResolvedValue(["black"]),
  mapProductToVisualProfile: vi.fn().mockReturnValue({
    dominantColors: ["black"],
    colorwayKey: "black",
    colorFamily: "black",
    visualSignature: "black",
    confidence: 0.8,
  }),
}));

vi.mock("../../../app/lib/knowledge-graph/llm-classifier", () => ({
  classifyProduct: vi.fn().mockResolvedValue({
    disciplineTags: ["Boxing"],
    categoryTags: ["Protection"],
    classificationConfidence: 0.9,
  }),
}));

import { deleteProduct, upsertProduct, updateProductEmbedding, invalidateRelationshipsForProduct, findProductByShopifyId } from "../../../app/lib/db/queries";
import { handleProductWebhook } from "../../../app/lib/knowledge-graph/ingestion";

describe("handleProductWebhook", () => {
  const admin = {
    graphql: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("refetches the canonical product for create and update webhooks", async () => {
    admin.graphql.mockResolvedValueOnce({
      json: async () => ({
        data: {
          product: {
            id: "gid://shopify/Product/123",
            title: "Boxing Gloves",
            description: "Training gloves",
            handle: "boxing-gloves",
            vendor: "Venum",
            productType: "Gloves",
            status: "ACTIVE",
            tags: ["boxing"],
            images: {
              nodes: [{ url: "https://cdn.example.com/gloves.jpg" }],
            },
            collections: {
              nodes: [{ id: "gid://shopify/Collection/1" }],
            },
            metafields: {
              nodes: [{ namespace: "custom", key: "discipline", value: "Boxing" }],
            },
            variants: {
              nodes: [
                {
                  id: "gid://shopify/ProductVariant/456",
                  title: "16 oz",
                  price: "99.00",
                  selectedOptions: [{ name: "Size", value: "16 oz" }],
                },
              ],
            },
          },
        },
      }),
    });

    await handleProductWebhook(
      "test.myshopify.com",
      { id: 123, admin_graphql_api_id: "gid://shopify/Product/123" },
      "products/update",
      admin,
    );

    expect(admin.graphql).toHaveBeenCalledWith(expect.any(String), {
      variables: { id: "gid://shopify/Product/123" },
    });
    expect(upsertProduct).toHaveBeenCalledWith(
      "test.myshopify.com",
      expect.objectContaining({
        shopifyProductId: "gid://shopify/Product/123",
        title: "Boxing Gloves",
      }),
    );
    expect(updateProductEmbedding).toHaveBeenCalledWith(
      "gid://shopify/Product/123",
      [0.1, 0.2],
    );
  });

  it("normalizes numeric delete webhook ids to GraphQL product ids", async () => {
    await handleProductWebhook(
      "test.myshopify.com",
      { id: 123 },
      "products/delete",
      admin,
    );

    expect(deleteProduct).toHaveBeenCalledWith("gid://shopify/Product/123");
  });

  // T025 — relationship invalidation regression
  it("invalidates relationships when a product is deleted and has an internal record", async () => {
    // When the internal product exists, invalidation should be called
    vi.mocked(findProductByShopifyId).mockResolvedValueOnce({ id: "internal_123" } as never);
    vi.mocked(deleteProduct).mockResolvedValueOnce({ id: "internal_123" } as never);

    await handleProductWebhook(
      "test.myshopify.com",
      { id: 123 },
      "products/delete",
      admin,
    );

    expect(invalidateRelationshipsForProduct).toHaveBeenCalledWith(
      "test.myshopify.com",
      "internal_123",
    );
  });

  it("skips relationship invalidation when the internal product record does not exist", async () => {
    vi.mocked(findProductByShopifyId).mockResolvedValueOnce(null);

    await handleProductWebhook(
      "test.myshopify.com",
      { id: 999 },
      "products/delete",
      admin,
    );

    expect(invalidateRelationshipsForProduct).not.toHaveBeenCalled();
  });

  it("does not invalidate relationships when a product is created or updated", async () => {
    admin.graphql.mockResolvedValueOnce({
      json: async () => ({
        data: {
          product: {
            id: "gid://shopify/Product/456",
            title: "Test Product",
            description: "",
            handle: "test-product",
            vendor: "Test",
            productType: "gloves",
            status: "ACTIVE",
            tags: [],
            images: { nodes: [] },
            collections: { nodes: [] },
            metafields: { nodes: [] },
            variants: {
              nodes: [
                {
                  id: "gid://shopify/ProductVariant/789",
                  title: "Default Title",
                  price: "50.00",
                  selectedOptions: [],
                },
              ],
            },
          },
        },
      }),
    });

    await handleProductWebhook(
      "test.myshopify.com",
      { id: 456, admin_graphql_api_id: "gid://shopify/Product/456" },
      "products/update",
      admin,
    );

    expect(invalidateRelationshipsForProduct).not.toHaveBeenCalled();
  });
});