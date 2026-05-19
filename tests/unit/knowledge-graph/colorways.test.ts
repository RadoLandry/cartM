import { describe, it, expect } from "vitest";
import { extractDominantColors } from "../../../app/lib/knowledge-graph/colorways";

describe("Colorways Extractor", () => {
  it("should return an empty array if imageUrl is null", async () => {
    const result = await extractDominantColors(null);
    expect(result).toEqual([]);
  });

  it("should fallback gracefully if an image URL is invalid or process fails (simulated here returning mock array)", async () => {
    // In our mock it always succeeds with a default array, testing the basic wrapper handling
    const result = await extractDominantColors("https://example.com/bad-image.jpg");
    expect(result).toEqual(["#000000", "#FFFFFF"]);
  });
});