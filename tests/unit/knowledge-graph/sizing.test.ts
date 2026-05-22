import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the DB queries module so tests run without a real database
vi.mock("../../../app/lib/db/queries", () => ({
  getSizeChartForCategory: vi.fn(),
  getUnprocessedReturnsByCategoryForShop: vi.fn(),
  markReturnRecordsProcessed: vi.fn(),
  upsertSizeChart: vi.fn(),
}));

import { getSizeRecommendation, adjustSizeChartFromReturns } from "../../../app/lib/knowledge-graph/sizing";
import { getSizeChartForCategory, getUnprocessedReturnsByCategoryForShop, markReturnRecordsProcessed, upsertSizeChart } from "../../../app/lib/db/queries";

const mockGetSizeChart = getSizeChartForCategory as ReturnType<typeof vi.fn>;
const mockGetUnprocessedReturns = getUnprocessedReturnsByCategoryForShop as ReturnType<typeof vi.fn>;
const mockMarkProcessed = markReturnRecordsProcessed as ReturnType<typeof vi.fn>;
const mockUpsertSizeChart = upsertSizeChart as ReturnType<typeof vi.fn>;

// Minimal SizeChart-shaped object returned by the mock
function makeChart(breakpoints: object[], overrideBreakpoints?: object[] | null) {
  return {
    id: "chart-1",
    shop: "test.myshopify.com",
    categoryTag: "clothing",
    sizeSystem: "clothing",
    breakpoints,
    overrideBreakpoints: overrideBreakpoints ?? null,
    source: "AUTO",
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

const clothingBreakpoints = [
  { label: "S",  attributeType: "chestCm", min: 88,  max: 96  },
  { label: "M",  attributeType: "chestCm", min: 96,  max: 104 },
  { label: "L",  attributeType: "chestCm", min: 104, max: 112 },
  { label: "XL", attributeType: "chestCm", min: 112, max: 120 },
];

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getSizeRecommendation — profile hit", () => {
  it("returns confidence:high and source:profile when knownSizes contains the categoryTag", async () => {
    mockGetSizeChart.mockResolvedValue(null);

    const result = await getSizeRecommendation({
      shop: "test.myshopify.com",
      productId: "prod-1",
      categoryTag: "clothing",
      sizeSystem: "clothing",
      knownSizes: { clothing: "M", gloves_oz: "16oz" },
    });

    expect(result.recommended).toBe("M");
    expect(result.confidence).toBe("high");
    expect(result.source).toBe("profile");
    // DB should never be queried when a profile hit is found
    expect(mockGetSizeChart).not.toHaveBeenCalled();
  });
});

describe("getSizeRecommendation — chart lookup", () => {
  it("returns correct size label for an attribute in the middle of a breakpoint range", async () => {
    mockGetSizeChart.mockResolvedValue(makeChart(clothingBreakpoints));

    const result = await getSizeRecommendation({
      shop: "test.myshopify.com",
      productId: "prod-2",
      categoryTag: "clothing",
      sizeSystem: "clothing",
      customerAttributes: { chestCm: 100 },
    });

    expect(result.recommended).toBe("M");
    expect(result.confidence).toBe("high");
    expect(result.source).toBe("chart");
  });

  it("returns correct size at lower boundary of a breakpoint range (non-boundary exact match)", async () => {
    mockGetSizeChart.mockResolvedValue(makeChart(clothingBreakpoints));

    const result = await getSizeRecommendation({
      shop: "test.myshopify.com",
      productId: "prod-3",
      categoryTag: "clothing",
      sizeSystem: "clothing",
      customerAttributes: { chestCm: 88 },
    });

    // 88 is the exact min of S — it also is the boundary between no-size and S
    // Since 88 = lo of S (and there's no smaller breakpoint whose max = 88),
    // this sits within the S range [88, 96).
    expect(result.recommended).toBe("S");
    expect(result.source).toBe("chart");
  });

  it("falls back to larger size at exact boundary between two breakpoints, confidence:medium", async () => {
    mockGetSizeChart.mockResolvedValue(makeChart(clothingBreakpoints));

    // chestCm 96 is the exact boundary between S (max=96) and M (min=96)
    const result = await getSizeRecommendation({
      shop: "test.myshopify.com",
      productId: "prod-4",
      categoryTag: "clothing",
      sizeSystem: "clothing",
      customerAttributes: { chestCm: 96 },
    });

    expect(result.recommended).toBe("M");
    expect(result.confidence).toBe("medium");
    expect(result.source).toBe("chart");
    expect(result.alternatives).toContain("S");
    expect(result.alternatives).toContain("M");
  });
});

describe("getSizeRecommendation — no chart / missing attributes", () => {
  it("returns null with source:none when no SizeChart exists", async () => {
    mockGetSizeChart.mockResolvedValue(null);

    const result = await getSizeRecommendation({
      shop: "test.myshopify.com",
      productId: "prod-5",
      categoryTag: "clothing",
      sizeSystem: "clothing",
      customerAttributes: { chestCm: 100 },
    });

    expect(result.recommended).toBeNull();
    expect(result.confidence).toBe("low");
    expect(result.source).toBe("none");
  });

  it("returns null with source:none when chart exists but no customerAttributes provided", async () => {
    mockGetSizeChart.mockResolvedValue(makeChart(clothingBreakpoints));

    const result = await getSizeRecommendation({
      shop: "test.myshopify.com",
      productId: "prod-6",
      categoryTag: "clothing",
      sizeSystem: "clothing",
    });

    expect(result.recommended).toBeNull();
    expect(result.source).toBe("none");
  });

  it("returns null with source:none when customerAttributes has no matching attributeType", async () => {
    mockGetSizeChart.mockResolvedValue(makeChart(clothingBreakpoints));

    const result = await getSizeRecommendation({
      shop: "test.myshopify.com",
      productId: "prod-7",
      categoryTag: "clothing",
      sizeSystem: "clothing",
      customerAttributes: { weightKg: 80 }, // clothing chart uses chestCm, not weightKg
    });

    expect(result.recommended).toBeNull();
    expect(result.source).toBe("none");
  });
});

describe("getSizeRecommendation — overrideBreakpoints precedence", () => {
  it("uses overrideBreakpoints instead of breakpoints when present", async () => {
    const overrideBreakpoints = [
      { label: "S-custom",  attributeType: "chestCm", min: 88,  max: 100 },
      { label: "M-custom",  attributeType: "chestCm", min: 100, max: 112 },
    ];

    // Chart has standard breakpoints but overrideBreakpoints says different labels
    mockGetSizeChart.mockResolvedValue(makeChart(clothingBreakpoints, overrideBreakpoints));

    const result = await getSizeRecommendation({
      shop: "test.myshopify.com",
      productId: "prod-8",
      categoryTag: "clothing",
      sizeSystem: "clothing",
      customerAttributes: { chestCm: 95 }, // falls in S-custom with override
    });

    expect(result.recommended).toBe("S-custom");
    expect(result.source).toBe("chart");
  });
});

// ---------------------------------------------------------------------------
// T023 — adjustSizeChartFromReturns tests
// ---------------------------------------------------------------------------

const SHOP = "test.myshopify.com";

function makeReturnRecord(returnedSize: string, returnReason: string, id?: string) {
  return {
    id: id ?? `ret-${returnedSize}-${Math.random().toString(36).slice(2)}`,
    shop: SHOP,
    shopifyOrderId: "order-1",
    shopifyProductId: "prod-1",
    categoryTag: "clothing",
    returnedSize,
    returnReason,
    returnedAt: new Date(),
    processedForAdjustment: false,
    createdAt: new Date(),
  };
}

describe("adjustSizeChartFromReturns — insufficient samples", () => {
  it("returns adjusted:false when fewer records than minSamples", async () => {
    mockGetUnprocessedReturns.mockResolvedValueOnce([makeReturnRecord("M", "too_large")]);

    const result = await adjustSizeChartFromReturns(SHOP, "clothing", "clothing", 10);

    expect(result.adjusted).toBe(false);
    expect(result.reason).toMatch(/Insufficient samples/);
    expect(mockUpsertSizeChart).not.toHaveBeenCalled();
  });
});

describe("adjustSizeChartFromReturns — no chart found", () => {
  it("returns adjusted:false when no SizeChart exists for the category", async () => {
    mockGetUnprocessedReturns.mockResolvedValueOnce(
      Array.from({ length: 10 }, (_, i) => makeReturnRecord("M", "too_large", `ret-${i}`)),
    );
    mockGetSizeChart.mockResolvedValueOnce(null);

    const result = await adjustSizeChartFromReturns(SHOP, "clothing", "clothing", 10);

    expect(result.adjusted).toBe(false);
    expect(result.reason).toMatch(/No SizeChart found/);
  });
});

describe("adjustSizeChartFromReturns — merchant override active", () => {
  it("marks records processed but does NOT adjust breakpoints when overrideBreakpoints is set", async () => {
    const records = Array.from({ length: 10 }, (_, i) => makeReturnRecord("M", "too_large", `ret-${i}`));
    mockGetUnprocessedReturns.mockResolvedValueOnce(records);
    mockGetSizeChart.mockResolvedValueOnce(
      makeChart(clothingBreakpoints, [{ label: "M-override", attributeType: "chestCm", min: 96, max: 106 }]),
    );
    mockMarkProcessed.mockResolvedValueOnce({ count: 10 });

    const result = await adjustSizeChartFromReturns(SHOP, "clothing", "clothing", 10);

    expect(result.adjusted).toBe(false);
    expect(result.reason).toMatch(/override/);
    expect(mockMarkProcessed).toHaveBeenCalledWith(records.map((r) => r.id));
    expect(mockUpsertSizeChart).not.toHaveBeenCalled();
  });
});

describe("adjustSizeChartFromReturns — significant too_large bias detected", () => {
  it("adjusts breakpoint max by 5% when >60% of returns for a size are too_large", async () => {
    const records = [
      ...Array.from({ length: 7 }, (_, i) => makeReturnRecord("M", "too_large", `ret-tl-${i}`)),
      ...Array.from({ length: 3 }, (_, i) => makeReturnRecord("M", "wrong_item", `ret-wi-${i}`)),
    ]; // 70% too_large for M — should trigger adjustment

    mockGetUnprocessedReturns.mockResolvedValueOnce(records);
    mockGetSizeChart.mockResolvedValueOnce(makeChart(clothingBreakpoints));
    mockUpsertSizeChart.mockResolvedValueOnce({});
    mockMarkProcessed.mockResolvedValueOnce({ count: 10 });

    const result = await adjustSizeChartFromReturns(SHOP, "clothing", "clothing", 10);

    expect(result.adjusted).toBe(true);
    expect(result.reason).toMatch(/adjusted/);
    expect(mockUpsertSizeChart).toHaveBeenCalledOnce();

    // Verify the adjusted breakpoints have M.max shrunk by 5%
    const upsertCall = mockUpsertSizeChart.mock.calls[0][0];
    const mBreakpoint = upsertCall.breakpoints.find((bp: { label: string }) => bp.label === "M");
    expect(mBreakpoint).toBeDefined();
    // Original max = 104; adjusted = Math.round(104 * 0.95 * 100) / 100 = 98.8
    expect(mBreakpoint.max).toBe(98.8);
  });

  it("marks all processed records after adjustment", async () => {
    const records = Array.from({ length: 10 }, (_, i) => makeReturnRecord("L", "too_large", `ret-${i}`));
    mockGetUnprocessedReturns.mockResolvedValueOnce(records);
    mockGetSizeChart.mockResolvedValueOnce(makeChart(clothingBreakpoints));
    mockUpsertSizeChart.mockResolvedValueOnce({});
    mockMarkProcessed.mockResolvedValueOnce({ count: 10 });

    const result = await adjustSizeChartFromReturns(SHOP, "clothing", "clothing", 10);

    expect(result.processedRecordIds).toHaveLength(10);
    expect(mockMarkProcessed).toHaveBeenCalledWith(records.map((r) => r.id));
  });
});

describe("adjustSizeChartFromReturns — no significant bias", () => {
  it("returns adjusted:false when too_large ratio is below 60% threshold", async () => {
    const records = [
      ...Array.from({ length: 5 }, (_, i) => makeReturnRecord("M", "too_large", `ret-tl-${i}`)),
      ...Array.from({ length: 5 }, (_, i) => makeReturnRecord("M", "wrong_item", `ret-wi-${i}`)),
    ]; // exactly 50% too_large — below 60%

    mockGetUnprocessedReturns.mockResolvedValueOnce(records);
    mockGetSizeChart.mockResolvedValueOnce(makeChart(clothingBreakpoints));
    mockMarkProcessed.mockResolvedValueOnce({ count: 10 });

    const result = await adjustSizeChartFromReturns(SHOP, "clothing", "clothing", 10);

    expect(result.adjusted).toBe(false);
    expect(result.reason).toMatch(/No significant bias/);
    expect(mockUpsertSizeChart).not.toHaveBeenCalled();
  });
});
