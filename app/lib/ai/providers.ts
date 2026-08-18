import { createOpenAI } from "@ai-sdk/openai";

const OPENAI_DEFAULT_MODEL = "gpt-4o";
const OPENAI_DEFAULT_EMBEDDING_MODEL = "text-embedding-3-small";
const OPENROUTER_DEFAULT_BASE_URL = "https://openrouter.ai/api/v1";
const OPENROUTER_DEFAULT_MODEL = "openai/gpt-4o-mini";
const OPENROUTER_DEFAULT_EMBEDDING_MODEL = "openai/text-embedding-3-small";

export function getConfiguredApiKey() {
  return process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY;
}

export function shouldUseOpenRouter(apiKey: string) {
  return Boolean(
    Boolean(process.env.OPENROUTER_API_KEY)
    || process.env.AI_PROVIDER === "openrouter"
    || apiKey.startsWith("sk-or-v1")
    || process.env.OPENAI_BASE_URL?.includes("openrouter"),
  );
}

export function isAIAvailable(): boolean {
  return Boolean(getConfiguredApiKey());
}

export function getPrimaryModel() {
  const apiKey = getConfiguredApiKey();
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY or OPENROUTER_API_KEY is not configured.");
  }

  if (shouldUseOpenRouter(apiKey)) {
    const openrouter = createOpenAI({
      apiKey,
      baseURL: process.env.OPENROUTER_BASE_URL || OPENROUTER_DEFAULT_BASE_URL,
      name: "openrouter",
      headers: {
        "HTTP-Referer": process.env.SHOPIFY_APP_URL || "http://localhost",
        "X-Title": "CartMind",
      },
    });
    return openrouter.chat(process.env.OPENROUTER_MODEL || OPENROUTER_DEFAULT_MODEL);
  }

  const openai = createOpenAI({
    apiKey,
    ...(process.env.OPENAI_BASE_URL ? { baseURL: process.env.OPENAI_BASE_URL } : {}),
  });
  return openai(process.env.OPENAI_MODEL || OPENAI_DEFAULT_MODEL);
}

export function getEmbeddingModel() {
  const apiKey = getConfiguredApiKey();
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY or OPENROUTER_API_KEY is not configured.");
  }

  if (shouldUseOpenRouter(apiKey)) {
    const openrouter = createOpenAI({
      apiKey,
      baseURL: process.env.OPENROUTER_BASE_URL || OPENROUTER_DEFAULT_BASE_URL,
      name: "openrouter",
      headers: {
        "HTTP-Referer": process.env.SHOPIFY_APP_URL || "http://localhost",
        "X-Title": "CartMind",
      },
    });
    return openrouter.embedding(process.env.OPENROUTER_EMBEDDING_MODEL || OPENROUTER_DEFAULT_EMBEDDING_MODEL);
  }

  const openai = createOpenAI({
    apiKey,
    ...(process.env.OPENAI_BASE_URL ? { baseURL: process.env.OPENAI_BASE_URL } : {}),
  });
  return openai.embedding(process.env.OPENAI_EMBEDDING_MODEL || OPENAI_DEFAULT_EMBEDDING_MODEL);
}
