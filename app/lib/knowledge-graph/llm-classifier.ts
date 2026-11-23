import { generateObject } from "ai";
import { z } from "zod";
import { getPrimaryModel, isAIAvailable } from "../ai/providers";
import {
  DISCIPLINES,
  CATEGORIES,
  normalizeDisciplines,
  normalizeCategories,
} from "./taxonomy";
import type { Discipline, Category } from "./taxonomy";
import { CONFIDENCE_THRESHOLD } from "./taxonomy.constants";

export { CONFIDENCE_THRESHOLD };

/** Fallback values when the LLM produces no valid output */
const FALLBACK_DISCIPLINES: Discipline[] = [];
const FALLBACK_CATEGORIES: Category[] = [];

const ClassificationSchema = z.object({
  disciplines: z
    .array(z.enum(DISCIPLINES))
    .describe(
      "List of sports disciplines this product belongs to (e.g. Boxing, Muay Thai)"
    ),
  categories: z
    .array(z.enum(CATEGORIES))
    .describe(
      "Functional product categories (e.g. Protection, Apparel, Accessories, Equipment)"
    ),
  confidence: z
    .number()
    .min(0)
    .max(1)
    .describe(
      "Classification confidence score between 0.0 (uncertain) and 1.0 (certain)"
    ),
  reasoning: z
    .string()
    .optional()
    .describe("Brief explanation of why these disciplines/categories were chosen"),
});

export type ClassificationResult = {
  disciplineTags: Discipline[];
  categoryTags: Category[];
  classificationConfidence: number;
};

/** Product data surface used for classification */
export interface ProductClassificationInput {
  title: string;
  description?: string | null;
  tags?: string[];
  productType?: string | null;
  vendor?: string | null;
  metafields?: Record<string, string>;
}

function buildClassificationPrompt(product: ProductClassificationInput): string {
  const parts: string[] = [`Title: ${product.title}`];
  if (product.description) parts.push(`Description: ${product.description.slice(0, 500)}`);
  if (product.productType) parts.push(`Product Type: ${product.productType}`);
  if (product.vendor) parts.push(`Vendor: ${product.vendor}`);
  if (product.tags && product.tags.length > 0) {
    parts.push(`Tags: ${product.tags.join(", ")}`);
  }
  if (product.metafields && Object.keys(product.metafields).length > 0) {
    const mfLines = Object.entries(product.metafields)
      .slice(0, 10)
      .map(([k, v]) => `${k}: ${v}`)
      .join(", ");
    parts.push(`Metafields: ${mfLines}`);
  }
  return parts.join("\n");
}

/**
 * Classify a product using the LLM.
 *
 * Uses Vercel AI SDK `generateObject` with a Zod schema to ensure typed,
 * structured output. Falls back to empty arrays + confidence 0 on failure.
 * Does NOT throw — callers should check confidence and handle uncategorized.
 */
export async function classifyProduct(
  product: ProductClassificationInput
): Promise<ClassificationResult> {
  if (!isAIAvailable()) {
    console.warn("[Classifier] OPENAI_API_KEY or OPENROUTER_API_KEY not set. Skipping classification.");
    return {
      disciplineTags: FALLBACK_DISCIPLINES,
      categoryTags: FALLBACK_CATEGORIES,
      classificationConfidence: 0,
    };
  }

  const productContext = buildClassificationPrompt(product);

  try {
    const { object } = await generateObject({
      model: getPrimaryModel(),
      schema: ClassificationSchema,
      system: `You are a product classification expert for a combat sports and fitness e-commerce store.
Your task is to classify products into disciplines and functional categories.

Valid disciplines: ${DISCIPLINES.join(", ")}
Valid categories: ${CATEGORIES.join(", ")}

Rules:
- A product can belong to multiple disciplines (e.g. MMA gloves → Boxing, MMA)
- Always include at least one category if the product is identifiable
- If the product is clearly not combat-sports related, return empty arrays with confidence 0.3
- Confidence should reflect how certain you are: 0.9+ for obvious matches, 0.5-0.8 for likely, <0.5 for unclear`,
      prompt: `Classify this product:\n\n${productContext}`,
    });

    // Normalize outputs against canonical taxonomy (guards against model drift)
    const disciplineTags = normalizeDisciplines(object.disciplines);
    const categoryTags = normalizeCategories(object.categories);

    return {
      disciplineTags,
      categoryTags,
      classificationConfidence: object.confidence,
    };
  } catch (error) {
    console.error("[Classifier] LLM classification failed:", (error as Error).message);
    return {
      disciplineTags: FALLBACK_DISCIPLINES,
      categoryTags: FALLBACK_CATEGORIES,
      classificationConfidence: 0,
    };
  }
}
