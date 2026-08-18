import { afterEach, describe, it, expect } from "vitest";
import { generateProductEmbeddingWithRetry, generateEmbedding } from "../../../app/lib/knowledge-graph/embeddings";

const ORIGINAL_OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const ORIGINAL_OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const ORIGINAL_AI_EMBEDDING_FALLBACK = process.env.AI_EMBEDDING_FALLBACK;
const ORIGINAL_NODE_ENV = process.env.NODE_ENV;

describe("Embeddings Generator", () => {
  afterEach(() => {
    if (ORIGINAL_OPENAI_API_KEY === undefined) {
      delete process.env.OPENAI_API_KEY;
    } else {
      process.env.OPENAI_API_KEY = ORIGINAL_OPENAI_API_KEY;
    }

    if (ORIGINAL_OPENROUTER_API_KEY === undefined) {
      delete process.env.OPENROUTER_API_KEY;
    } else {
      process.env.OPENROUTER_API_KEY = ORIGINAL_OPENROUTER_API_KEY;
    }

    if (ORIGINAL_AI_EMBEDDING_FALLBACK === undefined) {
      delete process.env.AI_EMBEDDING_FALLBACK;
    } else {
      process.env.AI_EMBEDDING_FALLBACK = ORIGINAL_AI_EMBEDDING_FALLBACK;
    }

    if (ORIGINAL_NODE_ENV === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = ORIGINAL_NODE_ENV;
    }
  });

  it("returns a 1536-dimension local fallback embedding in development", async () => {
    delete process.env.OPENAI_API_KEY;
    delete process.env.OPENROUTER_API_KEY;
    process.env.NODE_ENV = "test";

    const result = await generateEmbedding("Boxing gloves");

    expect(result.length).toBe(1536);
    expect(result.some((value) => value !== 0)).toBe(true);
  });

  it("returns deterministic local embeddings for the same text", async () => {
    delete process.env.OPENAI_API_KEY;
    delete process.env.OPENROUTER_API_KEY;
    process.env.NODE_ENV = "test";

    const first = await generateProductEmbeddingWithRetry("Muay Thai Shorts", 3);
    const second = await generateProductEmbeddingWithRetry("Muay Thai Shorts", 3);

    expect(second).toEqual(first);
  });

  it("fails explicitly when no API key is configured and fallback is disabled", async () => {
    delete process.env.OPENAI_API_KEY;
    delete process.env.OPENROUTER_API_KEY;
    process.env.AI_EMBEDDING_FALLBACK = "off";
    process.env.NODE_ENV = "test";

    await expect(generateProductEmbeddingWithRetry("Bad", 2)).rejects.toThrow(
      "Failed to generate embedding after 2 attempts: OPENAI_API_KEY or OPENROUTER_API_KEY is not configured.",
    );
  });
});