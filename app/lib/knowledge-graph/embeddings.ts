import { embed } from "ai";
import { getEmbeddingModel, isAIAvailable } from "../ai/providers";

const EMBEDDING_DIMENSIONS = 1536;

function isLocalEmbeddingFallbackEnabled() {
  return process.env.AI_EMBEDDING_FALLBACK !== "off" && process.env.NODE_ENV !== "production";
}

function hashToken(token: string) {
  let hash = 2166136261;
  for (let index = 0; index < token.length; index += 1) {
    hash ^= token.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function generateDeterministicEmbedding(text: string): number[] {
  const vector = Array(EMBEDDING_DIMENSIONS).fill(0) as number[];
  const tokens = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 2);

  for (const token of tokens) {
    const hash = hashToken(token);
    const index = hash % EMBEDDING_DIMENSIONS;
    vector[index] += (hash & 1) === 0 ? 1 : -1;
  }

  const norm = Math.hypot(...vector);
  return norm > 0 ? vector.map((value) => value / norm) : vector;
}

export async function generateEmbedding(text: string): Promise<number[]> {
  if (!text.trim()) {
    throw new Error("Cannot generate embedding for empty string");
  }
  if (!isAIAvailable()) {
    if (isLocalEmbeddingFallbackEnabled()) {
      return generateDeterministicEmbedding(text);
    }
    throw new Error("OPENAI_API_KEY or OPENROUTER_API_KEY is not configured.");
  }
  try {
    const { embedding } = await embed({
      model: getEmbeddingModel(),
      value: text,
    });
    return embedding;
  } catch (error) {
    if (isLocalEmbeddingFallbackEnabled()) {
      console.warn(`[Embeddings] OpenAI embedding failed; using deterministic local fallback: ${error instanceof Error ? error.message : String(error)}`);
      return generateDeterministicEmbedding(text);
    }
    throw error;
  }
}

export async function generateProductEmbeddingWithRetry(text: string, maxRetries: number = 3): Promise<number[]> {
  let attempt = 0;
  let lastError: unknown;
  
  while (attempt < maxRetries) {
    try {
      return await generateEmbedding(text);
    } catch (error) {
      lastError = error;
      attempt++;
      if (attempt >= maxRetries) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`Failed to generate embedding after ${maxRetries} attempts: ${message}`);
      }
      
      const backoff = Math.pow(2, attempt) * 50; // Lowered backoff for tests
      await new Promise(r => setTimeout(r, backoff));
    }
  }

  const message = lastError instanceof Error ? lastError.message : String(lastError);
  throw new Error(`Failed to generate embedding: ${message}`);
}