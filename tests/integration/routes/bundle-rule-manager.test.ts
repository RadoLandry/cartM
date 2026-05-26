import { beforeEach, describe, expect, it, vi } from "vitest";

import { action, loader } from "../../../app/routes/app.bundles";
import { detectBundles } from "../../../app/lib/cart-intelligence/bundles";
import * as dbQueries from "../../../app/lib/db/queries";
import { authenticate } from "../../../app/shopify.server";

vi.mock("../../../app/shopify.server", () => ({
  authenticate: {
    admin: vi.fn(),
  },
}));

vi.mock("../../../app/lib/cart-intelligence/bundles", () => ({
  detectBundles: vi.fn(),
}));

vi.mock("../../../app/lib/db/queries", () => ({
  archiveBundleRule: vi.fn(),
  deleteBundleRuleComponent: vi.fn(),
  getBundleRuleById: vi.fn(),
  getDistinctProductCategoryTagsForShop: vi.fn(),
  listBundlePreviewCartItems: vi.fn(),
  listBundleRulesForShop: vi.fn(),
  listProductsForBundleEditor: vi.fn(),
  upsertBundleRule: vi.fn(),
  upsertBundleRuleComponent: vi.fn(),
}));

describe("bundle rule manager route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authenticate.admin).mockResolvedValue({ session: { shop: "test.myshopify.com" } } as never);
    vi.mocked(dbQueries.listBundleRulesForShop).mockResolvedValue([] as never);
    vi.mocked(dbQueries.listProductsForBundleEditor).mockResolvedValue([] as never);
    vi.mocked(dbQueries.getDistinctProductCategoryTagsForShop).mockResolvedValue([] as never);
  });

  it("loads bundle rules, products, and category tags for the authenticated shop", async () => {
    vi.mocked(dbQueries.listBundleRulesForShop).mockResolvedValueOnce([
      { id: "bundle-1", key: "starter", label: "Starter", status: "ACTIVE", priority: 10, completionThreshold: 0.8, discountType: "PERCENTAGE", discountValue: "10.00", components: [] },
    ] as never);
    vi.mocked(dbQueries.listProductsForBundleEditor).mockResolvedValueOnce([
      { id: "prod-1", shopifyProductId: "gid://shopify/Product/1", title: "Gloves", disciplineTags: ["boxing"], categoryTags: ["gloves"], status: "ACTIVE", variants: [] },
    ] as never);
    vi.mocked(dbQueries.getDistinctProductCategoryTagsForShop).mockResolvedValueOnce(["gloves", "mouthguard"] as never);

    const result = await loader({ request: new Request("http://localhost/app/bundles"), params: {}, context: {} } as never);

    expect(dbQueries.listBundleRulesForShop).toHaveBeenCalledWith("test.myshopify.com");
    expect(dbQueries.listProductsForBundleEditor).toHaveBeenCalledWith("test.myshopify.com");
    expect(dbQueries.getDistinctProductCategoryTagsForShop).toHaveBeenCalledWith("test.myshopify.com");
    expect(result.categoryTags).toEqual(["gloves", "mouthguard"]);
    expect(result.bundleRules).toHaveLength(1);
  });

  it("saves a bundle rule shell", async () => {
    const request = new Request("http://localhost/app/bundles", {
      method: "POST",
      body: new URLSearchParams({
        intent: "save-bundle-rule",
        key: "boxing-starter-bundle",
        label: "Boxing Starter Bundle",
        description: "Starter boxing essentials",
        status: "DRAFT",
        priority: "10",
        completionThreshold: "0.8",
        discountType: "PERCENTAGE",
        discountValue: "10.00",
      }),
    });

    const result = await action({ request, params: {}, context: {} } as never);

    expect(dbQueries.upsertBundleRule).toHaveBeenCalledWith({
      shop: "test.myshopify.com",
      key: "boxing-starter-bundle",
      label: "Boxing Starter Bundle",
      description: "Starter boxing essentials",
      status: "DRAFT",
      priority: 10,
      completionThreshold: 0.8,
      discountType: "PERCENTAGE",
      discountValue: "10.00",
    });
    expect(result).toEqual({ ok: true, intent: "save-bundle-rule" });
  });

  it("saves a bundle component and normalizes csv list inputs", async () => {
    const request = new Request("http://localhost/app/bundles", {
      method: "POST",
      body: new URLSearchParams({
        intent: "save-bundle-component",
        bundleRuleId: "bundle-1",
        componentKey: "mouthguard",
        label: "Mouthguard",
        isRequired: "true",
        sortOrder: "30",
        minQuantity: "1",
        matchMode: "CATEGORY_OR_PRODUCT",
        acceptedCategoryTags: "mouthguard, protection",
        acceptedShopifyProductIds: "gid://shopify/Product/3",
        acceptedShopifyVariantIds: "gid://shopify/ProductVariant/30",
      }),
    });

    const result = await action({ request, params: {}, context: {} } as never);

    expect(dbQueries.upsertBundleRuleComponent).toHaveBeenCalledWith({
      bundleRuleId: "bundle-1",
      componentKey: "mouthguard",
      label: "Mouthguard",
      isRequired: true,
      sortOrder: 30,
      minQuantity: 1,
      matchMode: "CATEGORY_OR_PRODUCT",
      acceptedCategoryTags: ["mouthguard", "protection"],
      acceptedShopifyProductIds: ["gid://shopify/Product/3"],
      acceptedShopifyVariantIds: ["gid://shopify/ProductVariant/30"],
    });
    expect(result).toEqual({ ok: true, intent: "save-bundle-component" });
  });

  it("archives a bundle rule", async () => {
    const request = new Request("http://localhost/app/bundles", {
      method: "POST",
      body: new URLSearchParams({
        intent: "archive-bundle-rule",
        bundleRuleId: "bundle-1",
      }),
    });

    const result = await action({ request, params: {}, context: {} } as never);

    expect(dbQueries.archiveBundleRule).toHaveBeenCalledWith("bundle-1");
    expect(result).toEqual({ ok: true, intent: "archive-bundle-rule" });
  });

  it("previews a bundle rule against a supplied cart fixture", async () => {
    vi.mocked(dbQueries.getBundleRuleById).mockResolvedValueOnce({
      id: "bundle-1",
      key: "boxing-starter-bundle",
      label: "Boxing Starter Bundle",
      description: "Starter boxing essentials",
      source: "MERCHANT",
      status: "ACTIVE",
      priority: 10,
      completionThreshold: 0.8,
      discountType: "PERCENTAGE",
      discountValue: "10.00",
      components: [],
    } as never);
    vi.mocked(dbQueries.listBundlePreviewCartItems).mockResolvedValueOnce([
      {
        productId: "prod-1",
        shopifyProductId: "gid://shopify/Product/1",
        variantId: "var-1",
        shopifyVariantId: "gid://shopify/ProductVariant/1",
        title: "Gloves",
        quantity: 1,
        availableForSale: true,
        categoryTags: ["gloves"],
        disciplineTags: ["boxing"],
      },
    ] as never);
    vi.mocked(detectBundles).mockReturnValueOnce({
      matches: [{ bundleKey: "boxing-starter-bundle", status: "partial" }],
      summary: { qualifiedCount: 0, nearCompleteCount: 0, competingOfferCount: 0 },
    } as never);

    const request = new Request("http://localhost/app/bundles", {
      method: "POST",
      body: new URLSearchParams({
        intent: "preview-bundle-rule",
        bundleRuleId: "bundle-1",
        cartFixture: JSON.stringify([{ productId: "prod-1", variantId: "var-1", quantity: 1 }]),
      }),
    });

    const result = await action({ request, params: {}, context: {} } as never);

    expect(dbQueries.getBundleRuleById).toHaveBeenCalledWith("bundle-1");
    expect(dbQueries.listBundlePreviewCartItems).toHaveBeenCalledWith("test.myshopify.com", [
      { productId: "prod-1", variantId: "var-1", quantity: 1 },
    ]);
    expect(detectBundles).toHaveBeenCalledWith({
      shop: "test.myshopify.com",
      cartItems: expect.any(Array),
      bundleRules: [expect.objectContaining({ key: "boxing-starter-bundle" })],
    });
    expect(result).toEqual({
      ok: true,
      intent: "preview-bundle-rule",
      preview: { bundleKey: "boxing-starter-bundle", status: "partial" },
    });
  });
});