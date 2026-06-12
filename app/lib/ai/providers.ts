import { createOpenAI } from "@ai-sdk/openai";

export function isAIAvailable(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

export function getPrimaryModel() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }
  const openai = createOpenAI({ apiKey });
  return openai("gpt-4o");
}
