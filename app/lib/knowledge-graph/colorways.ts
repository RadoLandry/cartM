export async function extractDominantColors(imageUrl: string | null): Promise<string[]> {
  if (!imageUrl) {
    console.log("[Colorways] Missing image URL. Falling back to default empty array.");
    return [];
  }

  try {
    // In production, use `sharp` to download and process the image byte buffer
    // e.g. sharp(imageBuffer).resize(50, 50).stats()...
    // This is a simulated fallback for now without native binary issues during development
    
    await new Promise((r) => setTimeout(r, 20));
    return ["#000000", "#FFFFFF"]; // Default mocked dominant colors
  } catch (err) {
    console.error(`[Colorways] Failed to extract colors for ${imageUrl}. Using fallback.`, err);
    return [];
  }
}