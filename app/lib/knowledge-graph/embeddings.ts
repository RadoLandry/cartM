export async function generateEmbedding(text: string): Promise<number[]> {
  if (!text.trim()) {
    throw new Error("Cannot generate embedding for empty string");
  }

  // Simulated AI service fetch (would use openai.embeddings() in prod)
  await new Promise(r => setTimeout(r, 50));
  return Array.from({ length: 1536 }, () => Math.random() * 2 - 1);
}

export async function generateProductEmbeddingWithRetry(text: string, maxRetries: number = 3): Promise<number[]> {
  let attempt = 0;
  
  while (attempt < maxRetries) {
    try {
      return await generateEmbedding(text);
    } catch (error) {
      attempt++;
      if (attempt >= maxRetries) {
        throw new Error(`Failed to generate embedding after ${maxRetries} attempts`);
      }
      
      const backoff = Math.pow(2, attempt) * 50; // Lowered backoff for tests
      await new Promise(r => setTimeout(r, backoff));
    }
  }

  throw new Error("Unreachable");
}