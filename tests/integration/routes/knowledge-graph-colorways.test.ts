import { beforeEach, describe, expect, it, vi } from "vitest";
import { ColorCompatibility, VisualProfileSource, VisualReviewStatus } from "@prisma/client";
import { action, loader } from "../../../app/routes/app.knowledge-graph";
import { authenticate } from "../../../app/shopify.server";
import * as dbQueries from "../../../app/lib/db/queries";

vi.mock("../../../app/shopify.server", () => ({
  authenticate: {
    admin: vi.fn(),
  },
}));

vi.mock("../../../app/lib/db/queries", () => ({
  getLowConfidenceProducts: vi.fn(),
  getProductsWithTaxonomy: vi.fn(),
  listVisualProfilesForReview: vi.fn(),
  listColorCompatibilityRules: vi.fn(),
  saveProductVisualOverride: vi.fn(),
  resetProductVisualOverride: vi.fn(),
  createColorCompatibilityRule: vi.fn(),
  deleteColorCompatibilityRule: vi.fn(),
  getSizeChartsForShop: vi.fn(),
  getCrossSizeMappingsForShop: vi.fn(),
  getDistinctSizeCategoryTagsForShop: vi.fn(),
  saveSizeChartOverride: vi.fn(),
  resetSizeChartOverride: vi.fn(),
  createCrossSizeMapping: vi.fn(),
  deleteCrossSizeMapping: vi.fn(),
  applyMerchantTaxonomyOverride: vi.fn(),
  getRelationshipCandidatesForAdmin: vi.fn(),
  getMerchantActiveRelationships: vi.fn(),
  approveRelationship: vi.fn(),
  rejectRelationship: vi.fn(),
  disableRelationship: vi.fn(),
  upsertMerchantRelationship: vi.fn(),
  listKnowledgeGraphChangeLogPage: vi.fn(),
}));

describe("knowledge graph colorways route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authenticate.admin).mockResolvedValue({ session: { shop: "test.myshopify.com" } } as never);
    vi.mocked(dbQueries.getLowConfidenceProducts).mockResolvedValue([] as never);
    vi.mocked(dbQueries.getProductsWithTaxonomy).mockResolvedValue([] as never);
    vi.mocked(dbQueries.getSizeChartsForShop).mockResolvedValue([] as never);
    vi.mocked(dbQueries.getCrossSizeMappingsForShop).mockResolvedValue([] as never);
    vi.mocked(dbQueries.getDistinctSizeCategoryTagsForShop).mockResolvedValue([] as never);
    vi.mocked(dbQueries.getRelationshipCandidatesForAdmin).mockResolvedValue([] as never);
    vi.mocked(dbQueries.getMerchantActiveRelationships).mockResolvedValue([] as never);
    vi.mocked(dbQueries.listKnowledgeGraphChangeLogPage).mockResolvedValue([] as never);
  });

  it("loads visual profile review rows and compatibility rules", async () => {
    vi.mocked(dbQueries.listVisualProfilesForReview).mockResolvedValueOnce([
      {
        id: "profile-1",
        productId: "prod-1",
        product: {
          id: "prod-1",
          shopifyProductId: "gid://shopify/Product/1",
          title: "Matte Black Gloves",
          handle: "matte-black-gloves",
        },
        dominantColors: ["#111827"],
        detectedColorwayKeys: ["black"],
        overrideColorwayKeys: [],
        detectedCollections: [{ shopifyCollectionId: "col-1", title: "Pro", handle: "pro" }],
        overrideCollections: null,
        visualConfidence: 0.81,
        reviewStatus: VisualReviewStatus.AUTO_APPROVED,
        source: VisualProfileSource.AUTO,
        extractionSummary: { paletteSource: "image", notes: [] },
      },
    ] as never);
    vi.mocked(dbQueries.listColorCompatibilityRules).mockResolvedValueOnce([
      {
        id: "rule-1",
        shop: "test.myshopify.com",
        sourceColorwayKey: "black",
        targetColorwayKey: "gold",
        compatibility: ColorCompatibility.COMPLEMENTARY,
        source: VisualProfileSource.MERCHANT,
        rationale: "Classic pairing",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ] as never);

    const result = await loader({
      request: new Request("http://localhost/app/knowledge-graph"),
      params: {},
      context: {},
    } as never);

    expect(dbQueries.listVisualProfilesForReview).toHaveBeenCalledWith("test.myshopify.com", 50);
    expect(dbQueries.listColorCompatibilityRules).toHaveBeenCalledWith("test.myshopify.com");
    expect(result.visualProfiles).toHaveLength(1);
    expect(result.visualProfiles[0].effectiveColorwayKeys).toEqual(["black"]);
    expect(result.compatibilityRules).toHaveLength(1);
  });

  it("saves a visual override", async () => {
    const request = new Request("http://localhost/app/knowledge-graph", {
      method: "POST",
      body: new URLSearchParams({
        intent: "save-visual-override",
        productId: "prod-1",
        overrideColorways: "Black, Gold",
        overrideCollections: "Pro Series, Legacy",
      }),
    });

    const result = await action({ request, params: {}, context: {} } as never);

    expect(dbQueries.saveProductVisualOverride).toHaveBeenCalledWith(
      "prod-1",
      ["black", "gold"],
      [
        { shopifyCollectionId: "manual:pro-series", title: "Pro Series", handle: "pro-series" },
        { shopifyCollectionId: "manual:legacy", title: "Legacy", handle: "legacy" },
      ],
    );
    expect(result).toEqual({ ok: true });
  });

  it("resets a visual override", async () => {
    const request = new Request("http://localhost/app/knowledge-graph", {
      method: "POST",
      body: new URLSearchParams({
        intent: "reset-visual-override",
        productId: "prod-1",
      }),
    });

    const result = await action({ request, params: {}, context: {} } as never);

    expect(dbQueries.resetProductVisualOverride).toHaveBeenCalledWith("prod-1");
    expect(result).toEqual({ ok: true });
  });

  it("creates a compatibility rule and normalizes colorway keys", async () => {
    const request = new Request("http://localhost/app/knowledge-graph", {
      method: "POST",
      body: new URLSearchParams({
        intent: "save-compatibility-rule",
        sourceColorwayKey: "Black Gold",
        targetColorwayKey: "Grey",
        compatibility: ColorCompatibility.COMPLEMENTARY,
        rationale: "High contrast",
      }),
    });

    const result = await action({ request, params: {}, context: {} } as never);

    expect(dbQueries.createColorCompatibilityRule).toHaveBeenCalledWith({
      shop: "test.myshopify.com",
      sourceColorwayKey: "black-gold",
      targetColorwayKey: "gray",
      compatibility: ColorCompatibility.COMPLEMENTARY,
      rationale: "High contrast",
    });
    expect(result).toEqual({ ok: true });
  });

  it("returns duplicate when rule creation hits the unique constraint", async () => {
    vi.mocked(dbQueries.createColorCompatibilityRule).mockRejectedValueOnce(
      Object.assign(new Error("duplicate"), { code: "P2002" }),
    );

    const request = new Request("http://localhost/app/knowledge-graph", {
      method: "POST",
      body: new URLSearchParams({
        intent: "save-compatibility-rule",
        sourceColorwayKey: "Black",
        targetColorwayKey: "Gold",
        compatibility: ColorCompatibility.MATCHING,
      }),
    });

    const result = await action({ request, params: {}, context: {} } as never);

    expect(result).toEqual({ ok: false, error: "duplicate" });
  });

  it("deletes a compatibility rule", async () => {
    const request = new Request("http://localhost/app/knowledge-graph", {
      method: "POST",
      body: new URLSearchParams({
        intent: "delete-compatibility-rule",
        ruleId: "rule-1",
      }),
    });

    const result = await action({ request, params: {}, context: {} } as never);

    expect(dbQueries.deleteColorCompatibilityRule).toHaveBeenCalledWith("rule-1");
    expect(result).toEqual({ ok: true });
  });
});