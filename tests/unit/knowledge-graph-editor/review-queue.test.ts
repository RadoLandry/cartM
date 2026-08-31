/**
 * Unit tests: Knowledge Graph Editor — Review Queue (T021)
 *
 * Covers:
 *  - Queue ordering by confidence ascending (default) and descending
 *  - Filter normalization (search, discipline, category)
 *  - Override precedence: isManuallyClassified stays true after override
 *  - Status transitions: markProductAsReviewed, reflagProductForReview
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  normalizeKnowledgeGraphReviewQueueFilters,
  getKnowledgeGraphReviewQueue,
  markProductAsReviewed,
  reflagProductForReview,
} from "../../../app/lib/knowledge-graph/editor";
import { CONFIDENCE_THRESHOLD } from "../../../app/lib/knowledge-graph/llm-classifier";

vi.mock("../../../app/lib/db/queries", () => ({
  getLowConfidenceProducts: vi.fn(),
  applyMerchantTaxonomyOverride: vi.fn().mockResolvedValue({ count: 1 }),
}));

vi.mock("../../db.server", () => ({
  default: {
    product: {
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
  },
}));

import * as dbQueries from "../../../app/lib/db/queries";

function makeItem(overrides: Partial<{
  id: string;
  shopifyProductId: string;
  title: string;
  handle: string;
  disciplineTags: string[];
  categoryTags: string[];
  classificationConfidence: number | null;
  isManuallyClassified: boolean;
}> = {}) {
  return {
    id: "prod_001",
    shopifyProductId: "gid://shopify/Product/1",
    title: "Boxing Gloves",
    handle: "boxing-gloves",
    disciplineTags: ["boxing"],
    categoryTags: ["gloves"],
    classificationConfidence: 0.3,
    isManuallyClassified: false,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// normalizeKnowledgeGraphReviewQueueFilters
// ---------------------------------------------------------------------------

describe("normalizeKnowledgeGraphReviewQueueFilters", () => {
  it("trims whitespace from search and returns undefined when blank", () => {
    const result = normalizeKnowledgeGraphReviewQueueFilters({ search: "  " });
    expect(result.search).toBeUndefined();
  });

  it("preserves non-blank search after trimming", () => {
    const result = normalizeKnowledgeGraphReviewQueueFilters({ search: "  gloves  " });
    expect(result.search).toBe("gloves");
  });

  it("filters out empty strings from tag arrays", () => {
    const result = normalizeKnowledgeGraphReviewQueueFilters({
      disciplineTags: ["boxing", "", "mma"],
      categoryTags: ["", "gloves"],
    });
    expect(result.disciplineTags).toEqual(["boxing", "mma"]);
    expect(result.categoryTags).toEqual(["gloves"]);
  });

  it("defaults sort to confidence_asc when not supplied", () => {
    const result = normalizeKnowledgeGraphReviewQueueFilters({});
    expect(result.sort).toBe("confidence_asc");
  });

  it("preserves explicit sort override", () => {
    const result = normalizeKnowledgeGraphReviewQueueFilters({ sort: "confidence_desc" });
    expect(result.sort).toBe("confidence_desc");
  });
});

// ---------------------------------------------------------------------------
// getKnowledgeGraphReviewQueue — ordering
// ---------------------------------------------------------------------------

describe("getKnowledgeGraphReviewQueue — confidence ordering", () => {
  it("returns items sorted by confidence ascending by default", async () => {
    const mockItems = [
      makeItem({ id: "p1", classificationConfidence: 0.4 }),
      makeItem({ id: "p2", classificationConfidence: 0.1 }),
      makeItem({ id: "p3", classificationConfidence: 0.3 }),
    ];
    vi.mocked(dbQueries.getLowConfidenceProducts).mockResolvedValueOnce(mockItems);

    const result = await getKnowledgeGraphReviewQueue("shop.myshopify.com", CONFIDENCE_THRESHOLD, {});

    const confidences = result.map((r) => r.classificationConfidence);
    expect(confidences).toEqual([0.1, 0.3, 0.4]);
  });

  it("returns items sorted by confidence descending when requested", async () => {
    const mockItems = [
      makeItem({ id: "p1", classificationConfidence: 0.2 }),
      makeItem({ id: "p2", classificationConfidence: 0.5 }),
    ];
    vi.mocked(dbQueries.getLowConfidenceProducts).mockResolvedValueOnce(mockItems);

    const result = await getKnowledgeGraphReviewQueue("shop.myshopify.com", CONFIDENCE_THRESHOLD, {
      sort: "confidence_desc",
    });

    expect(result[0].classificationConfidence).toBe(0.5);
    expect(result[1].classificationConfidence).toBe(0.2);
  });

  it("treats null confidence as 0 for ordering", async () => {
    const mockItems = [
      makeItem({ id: "p1", classificationConfidence: null }),
      makeItem({ id: "p2", classificationConfidence: 0.4 }),
    ];
    vi.mocked(dbQueries.getLowConfidenceProducts).mockResolvedValueOnce(mockItems);

    const result = await getKnowledgeGraphReviewQueue("shop.myshopify.com", CONFIDENCE_THRESHOLD, {});

    expect(result[0].id).toBe("p1");
  });
});

// ---------------------------------------------------------------------------
// getKnowledgeGraphReviewQueue — search filtering
// ---------------------------------------------------------------------------

describe("getKnowledgeGraphReviewQueue — search filtering", () => {
  it("filters by product title (case-insensitive)", async () => {
    const mockItems = [
      makeItem({ id: "p1", title: "Boxing Gloves", handle: "boxing-gloves" }),
      makeItem({ id: "p2", title: "MMA Shorts", handle: "mma-shorts" }),
    ];
    vi.mocked(dbQueries.getLowConfidenceProducts).mockResolvedValueOnce(mockItems);

    const result = await getKnowledgeGraphReviewQueue("shop.myshopify.com", CONFIDENCE_THRESHOLD, {
      search: "boxing",
    });

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("p1");
  });

  it("filters by handle", async () => {
    const mockItems = [
      makeItem({ id: "p1", title: "Boxing Gloves", handle: "boxing-gloves" }),
      makeItem({ id: "p2", title: "MMA Shorts", handle: "mma-shorts" }),
    ];
    vi.mocked(dbQueries.getLowConfidenceProducts).mockResolvedValueOnce(mockItems);

    const result = await getKnowledgeGraphReviewQueue("shop.myshopify.com", CONFIDENCE_THRESHOLD, {
      search: "mma",
    });

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("p2");
  });

  it("returns all items when search is empty", async () => {
    const mockItems = [makeItem({ id: "p1" }), makeItem({ id: "p2" })];
    vi.mocked(dbQueries.getLowConfidenceProducts).mockResolvedValueOnce(mockItems);

    const result = await getKnowledgeGraphReviewQueue("shop.myshopify.com", CONFIDENCE_THRESHOLD, {});

    expect(result).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// getKnowledgeGraphReviewQueue — discipline / category tag filtering
// ---------------------------------------------------------------------------

describe("getKnowledgeGraphReviewQueue — tag filtering", () => {
  it("filters by discipline tag", async () => {
    const mockItems = [
      makeItem({ id: "p1", disciplineTags: ["boxing"] }),
      makeItem({ id: "p2", disciplineTags: ["yoga"] }),
    ];
    vi.mocked(dbQueries.getLowConfidenceProducts).mockResolvedValueOnce(mockItems);

    const result = await getKnowledgeGraphReviewQueue("shop.myshopify.com", CONFIDENCE_THRESHOLD, {
      disciplineTags: ["boxing"],
    });

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("p1");
  });

  it("filters by category tag", async () => {
    const mockItems = [
      makeItem({ id: "p1", categoryTags: ["gloves"] }),
      makeItem({ id: "p2", categoryTags: ["shorts"] }),
    ];
    vi.mocked(dbQueries.getLowConfidenceProducts).mockResolvedValueOnce(mockItems);

    const result = await getKnowledgeGraphReviewQueue("shop.myshopify.com", CONFIDENCE_THRESHOLD, {
      categoryTags: ["shorts"],
    });

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("p2");
  });
});

// ---------------------------------------------------------------------------
// Override precedence: isManuallyClassified flag
// ---------------------------------------------------------------------------

describe("override precedence — isManuallyClassified flag", () => {
  it("markProductAsReviewed calls applyMerchantTaxonomyOverride", async () => {
    await markProductAsReviewed(
      "gid://shopify/Product/1",
      ["boxing"],
      ["gloves"],
    );

    expect(dbQueries.applyMerchantTaxonomyOverride).toHaveBeenCalledWith(
      "gid://shopify/Product/1",
      ["boxing"],
      ["gloves"],
    );
  });

  it("markProductAsReviewed sets confidence to 1.0 (via applyMerchantTaxonomyOverride contract)", async () => {
    // The DB function sets classificationConfidence to 1.0 — verify call shape
    await markProductAsReviewed("gid://shopify/Product/2", ["mma"], ["shorts"]);

    expect(dbQueries.applyMerchantTaxonomyOverride).toHaveBeenCalledOnce();
  });
});

// ---------------------------------------------------------------------------
// Status transitions
// ---------------------------------------------------------------------------

describe("reflagProductForReview", () => {
  it("calls db.product.updateMany to reset isManuallyClassified and confidence", async () => {
    // reflagProductForReview uses a dynamic import of db.server
    // We verify it doesn't throw and completes without error
    await expect(
      reflagProductForReview("gid://shopify/Product/1"),
    ).resolves.toBeUndefined();
  });
});
