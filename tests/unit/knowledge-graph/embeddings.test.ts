import { describe, it, expect, vi } from "vitest";
import { generateProductEmbeddingWithRetry, generateEmbedding } from "../../../app/lib/knowledge-graph/embeddings";

vi.mock("../../../app/lib/knowledge-graph/embeddings", async (importOriginal) => {
  const actual = (await importOriginal()) as any;
  return {
    ...actual,
    generateEmbedding: vi.fn(),
  };
});

describe("Embeddings Generator", () => {
  it("should return successfully on first try", async () => {
    vi.mocked(generateEmbedding).mockResolvedValueOnce(Array(1536).fill(0));
    
    const result = await generateProductEmbeddingWithRetry("Boxing gloves");
    expect(result.length).toBe(1536);
    expect(generateEmbedding).toHaveBeenCalledTimes(1);
  });

  it("should retry transient failures and succeed", async () => {
    vi.mocked(generateEmbedding)
      .mockRejectedValueOnce(new Error("Timeout"))
      .mockRejectedValueOnce(new Error("Timeout"))
      .mockResolvedValueOnce(Array(1536).fill(0));

    const result = await generateProductEmbeddingWithRetry("Muay Thai Shorts", 3);
    
    expect(generateEmbedding).toHaveBeenCalledTimes(3);
    expect(result.length).toBe(1536);
  });

  it("should fail permanently after max retries", async () => {
    vi.mocked(generateEmbedding).mockRejectedValue(new Error("Timeout"));

    await expect(generateProductEmbeddingWithRetry("Bad", 3)).rejects.toThrow("Failed to generate embedding after 3 attempts");
    expect(generateEmbedding).toHaveBeenCalledTimes(3);
  });
});