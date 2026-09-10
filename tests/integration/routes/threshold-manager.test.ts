import { beforeEach, describe, expect, it, vi } from "vitest";

import { action, loader } from "../../../app/routes/app.thresholds";
import { evaluateThreshold } from "../../../app/lib/cart-intelligence/threshold";
import * as dbQueries from "../../../app/lib/db/queries";
import { authenticate } from "../../../app/shopify.server";

vi.mock("../../../app/shopify.server", () => ({
  authenticate: {
    admin: vi.fn(),
  },
}));

vi.mock("../../../app/lib/cart-intelligence/threshold", () => ({
  evaluateThreshold: vi.fn(),
}));

vi.mock("../../../app/lib/db/queries", () => ({
  archiveThresholdRule: vi.fn(),
  getDistinctDisciplineTagsForShop: vi.fn(),
  getDistinctProductCategoryTagsForShop: vi.fn(),
  getThresholdRuleById: vi.fn(),
  listProductsForThresholdEditor: vi.fn(),
  listThresholdPreviewCartItems: vi.fn(),
  listThresholdRulesForShop: vi.fn(),
  upsertThresholdRule: vi.fn(),
}));

describe("threshold manager route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authenticate.admin).mockResolvedValue({ session: { shop: "test.myshopify.com" } } as never);
    vi.mocked(dbQueries.listThresholdRulesForShop).mockResolvedValue([] as never);
    vi.mocked(dbQueries.listProductsForThresholdEditor).mockResolvedValue([] as never);
    vi.mocked(dbQueries.getDistinctProductCategoryTagsForShop).mockResolvedValue([] as never);
    vi.mocked(dbQueries.getDistinctDisciplineTagsForShop).mockResolvedValue([] as never);
  });

  it("loads threshold rules, products, category tags, and discipline tags for the authenticated shop", async () => {
    vi.mocked(dbQueries.listThresholdRulesForShop).mockResolvedValueOnce([
      { id: "threshold-1", key: "free-shipping-default", label: "Free Shipping", status: "ACTIVE", priority: 10, targetSubtotal: 100, actionableWindow: 25 },
    ] as never);
    vi.mocked(dbQueries.getDistinctProductCategoryTagsForShop).mockResolvedValueOnce(["gloves"] as never);
    vi.mocked(dbQueries.getDistinctDisciplineTagsForShop).mockResolvedValueOnce(["boxing"] as never);

    const result = await loader({ request: new Request("http://localhost/app/thresholds"), params: {}, context: {} } as never);

    expect(dbQueries.listThresholdRulesForShop).toHaveBeenCalledWith("test.myshopify.com");
    expect(dbQueries.getDistinctProductCategoryTagsForShop).toHaveBeenCalledWith("test.myshopify.com");
    expect(dbQueries.getDistinctDisciplineTagsForShop).toHaveBeenCalledWith("test.myshopify.com");
    expect(result.thresholdRules).toHaveLength(1);
    expect(result.categoryTags).toEqual(["gloves"]);
    expect(result.disciplineTags).toEqual(["boxing"]);
  });

  it("saves a threshold rule", async () => {
    vi.mocked(dbQueries.upsertThresholdRule).mockResolvedValueOnce({ id: "threshold-1" } as never);

    const request = new Request("http://localhost/app/thresholds", {
      method: "POST",
      body: new URLSearchParams({
        intent: "save-threshold-rule",
        key: "free-shipping-default",
        label: "Free Shipping Threshold",
        status: "DRAFT",
        priority: "10",
        benefitType: "FREE_SHIPPING",
        benefitLabel: "Free shipping",
        targetSubtotal: "100",
        actionableWindow: "25",
        allowOvershoot: "true",
        maxSuggestions: "3",
        duplicatePurchasePolicy: "DISALLOW",
      }),
    });

    const result = await action({ request, params: {}, context: {} } as never);

    expect(dbQueries.upsertThresholdRule).toHaveBeenCalledWith(expect.objectContaining({
      shop: "test.myshopify.com",
      key: "free-shipping-default",
      label: "Free Shipping Threshold",
      benefitType: "FREE_SHIPPING",
      targetSubtotal: "100",
      actionableWindow: "25",
    }));
    expect(result).toEqual({ ok: true, intent: "save-threshold-rule", ruleId: "threshold-1" });
  });

  it("rejects a duplicate threshold key", async () => {
    vi.mocked(dbQueries.upsertThresholdRule).mockRejectedValueOnce({ code: "P2002" });

    const request = new Request("http://localhost/app/thresholds", {
      method: "POST",
      body: new URLSearchParams({
        intent: "save-threshold-rule",
        key: "free-shipping-default",
        label: "Free Shipping Threshold",
        status: "DRAFT",
        priority: "10",
        benefitType: "FREE_SHIPPING",
        benefitLabel: "Free shipping",
        targetSubtotal: "100",
        actionableWindow: "25",
        allowOvershoot: "true",
        maxSuggestions: "3",
        duplicatePurchasePolicy: "DISALLOW",
      }),
    });

    const result = await action({ request, params: {}, context: {} } as never);

    expect(result).toEqual({
      ok: false,
      intent: "save-threshold-rule",
      error: "A threshold rule with this key already exists.",
    });
  });

  it("archives a threshold rule", async () => {
    const request = new Request("http://localhost/app/thresholds", {
      method: "POST",
      body: new URLSearchParams({
        intent: "archive-threshold-rule",
        thresholdRuleId: "threshold-1",
      }),
    });

    const result = await action({ request, params: {}, context: {} } as never);

    expect(dbQueries.archiveThresholdRule).toHaveBeenCalledWith("threshold-1");
    expect(result).toEqual({ ok: true, intent: "archive-threshold-rule" });
  });

  it("previews a threshold rule against a cart fixture", async () => {
    vi.mocked(dbQueries.getThresholdRuleById).mockResolvedValueOnce({ id: "threshold-1", key: "free-shipping-default" } as never);
    vi.mocked(dbQueries.listThresholdPreviewCartItems).mockResolvedValueOnce([] as never);
    vi.mocked(evaluateThreshold).mockReturnValueOnce({ status: "eligible", gapAmount: 10, candidates: [] } as never);

    const request = new Request("http://localhost/app/thresholds", {
      method: "POST",
      body: new URLSearchParams({
        intent: "preview-threshold-rule",
        thresholdRuleId: "threshold-1",
        cartSubtotal: "90",
        cartFixture: JSON.stringify([{ productId: "prod-1", variantId: "var-1", quantity: 1 }]),
      }),
    });

    const result = await action({ request, params: {}, context: {} } as never);

    expect(dbQueries.getThresholdRuleById).toHaveBeenCalledWith("threshold-1");
    expect(evaluateThreshold).toHaveBeenCalled();
    expect(result).toEqual({
      ok: true,
      intent: "preview-threshold-rule",
      preview: { status: "eligible", gapAmount: 10, candidates: [] },
    });
  });

  it("rejects an unknown threshold action intent", async () => {
    const request = new Request("http://localhost/app/thresholds", {
      method: "POST",
      body: new URLSearchParams({ intent: "unknown-intent" }),
    });

    const result = await action({ request, params: {}, context: {} } as never);

    expect(result).toEqual({ ok: false, intent: "unknown-intent", error: "Unknown threshold action intent." });
  });
});
