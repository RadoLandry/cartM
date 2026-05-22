import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the `ai` module before importing the classifier
vi.mock("ai", () => ({
  generateObject: vi.fn(),
}));

vi.mock("@ai-sdk/openai", () => ({
  createOpenAI: vi.fn(() => vi.fn()),
}));

import { generateObject } from "ai";
import {
  classifyProduct,
  CONFIDENCE_THRESHOLD,
  type ProductClassificationInput,
} from "../../../app/lib/knowledge-graph/llm-classifier";

const mockGenerateObject = vi.mocked(generateObject);

// Restore OPENAI_API_KEY before tests that need it
const ORIGINAL_API_KEY = process.env.OPENAI_API_KEY;

beforeEach(() => {
  vi.clearAllMocks();
  process.env.OPENAI_API_KEY = "test-key";
});

describe("classifyProduct", () => {
  it("classifies boxing gloves correctly with high confidence", async () => {
    mockGenerateObject.mockResolvedValueOnce({
      object: {
        disciplines: ["Boxing"],
        categories: ["Protection"],
        confidence: 0.97,
        reasoning: "Title and tags clearly indicate boxing gloves",
      },
    } as never);

    const product: ProductClassificationInput = {
      title: "Challenger Boxing Gloves 16oz",
      description: "Professional boxing training gloves for sparring and bag work.",
      tags: ["boxing", "gloves", "training"],
      productType: "Gloves",
    };

    const result = await classifyProduct(product);

    expect(result.disciplineTags).toEqual(["Boxing"]);
    expect(result.categoryTags).toEqual(["Protection"]);
    expect(result.classificationConfidence).toBe(0.97);
  });

  it("assigns multiple disciplines for MMA crossover products", async () => {
    mockGenerateObject.mockResolvedValueOnce({
      object: {
        disciplines: ["Boxing", "MMA"],
        categories: ["Protection"],
        confidence: 0.88,
      },
    } as never);

    const product: ProductClassificationInput = {
      title: "MMA Sparring Gloves",
      tags: ["mma", "boxing", "sparring"],
    };

    const result = await classifyProduct(product);

    expect(result.disciplineTags).toContain("Boxing");
    expect(result.disciplineTags).toContain("MMA");
    expect(result.classificationConfidence).toBeGreaterThanOrEqual(CONFIDENCE_THRESHOLD);
  });

  it("returns empty arrays and confidence 0 when API key is missing", async () => {
    delete process.env.OPENAI_API_KEY;

    const product: ProductClassificationInput = { title: "Boxing Gloves" };
    const result = await classifyProduct(product);

    expect(result.disciplineTags).toEqual([]);
    expect(result.categoryTags).toEqual([]);
    expect(result.classificationConfidence).toBe(0);
    expect(mockGenerateObject).not.toHaveBeenCalled();
  });

  it("returns fallback values when LLM throws an error", async () => {
    mockGenerateObject.mockRejectedValueOnce(new Error("Rate limit exceeded"));

    const product: ProductClassificationInput = { title: "Boxing Gloves" };
    const result = await classifyProduct(product);

    expect(result.disciplineTags).toEqual([]);
    expect(result.categoryTags).toEqual([]);
    expect(result.classificationConfidence).toBe(0);
  });

  it("normalizes LLM output against canonical taxonomy", async () => {
    // LLM returns canonical values — normalization should pass them through
    mockGenerateObject.mockResolvedValueOnce({
      object: {
        disciplines: ["BJJ"],
        categories: ["Apparel"],
        confidence: 0.82,
      },
    } as never);

    const product: ProductClassificationInput = {
      title: "BJJ Gi Top",
      tags: ["bjj", "gi", "apparel"],
    };

    const result = await classifyProduct(product);

    expect(result.disciplineTags).toEqual(["BJJ"]);
    expect(result.categoryTags).toEqual(["Apparel"]);
  });

  it("returns low confidence for unrelated products", async () => {
    mockGenerateObject.mockResolvedValueOnce({
      object: {
        disciplines: [],
        categories: [],
        confidence: 0.2,
      },
    } as never);

    const product: ProductClassificationInput = {
      title: "Coffee Mug",
      description: "A nice ceramic mug for morning coffee.",
    };

    const result = await classifyProduct(product);

    expect(result.disciplineTags).toEqual([]);
    expect(result.categoryTags).toEqual([]);
    expect(result.classificationConfidence).toBeLessThan(CONFIDENCE_THRESHOLD);
  });

  it("confidence threshold constant is 0.8", () => {
    expect(CONFIDENCE_THRESHOLD).toBe(0.8);
  });
});
