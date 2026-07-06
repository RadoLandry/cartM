export interface CartContextLineInput {
  productId: string;
  variantId?: string | null;
  title: string;
  quantity?: number;
  tags?: string[];
  disciplineTags?: string[];
  categoryTags?: string[];
  collectionIds?: string[];
  collections?: CartContextCollectionInput[];
}

export interface CartContextCollectionInput {
  id?: string;
  key?: string;
  label?: string;
  title?: string;
}

export interface CartContextSignal {
  value: string;
  score: number;
}

export interface CartUnderstandingContext {
  sport: string;
  level: string;
  objective: string;
  products: Array<{
    productId: string;
    variantId?: string;
    title: string;
    quantity: number;
  }>;
  collections: string[];
  tags: string[];
  categories: string[];
  disciplines: string[];
  signals: {
    sports: CartContextSignal[];
    levels: CartContextSignal[];
    objectives: CartContextSignal[];
  };
  aiSummary: string;
}

const DEFAULT_CONTEXT_VALUE = "A preciser";

const SPORT_KEYWORDS: Record<string, string[]> = {
  Boxe: ["boxe", "boxing", "muay thai", "kickboxing", "gants", "bandages", "sparring"],
  MMA: ["mma", "grappling", "vale tudo"],
  Fitness: ["fitness", "training", "workout", "musculation"],
  Running: ["running", "course", "trail"],
};

const LEVEL_KEYWORDS: Record<string, string[]> = {
  Debutant: ["debutant", "beginner", "initiation", "starter", "entry"],
  Intermediaire: ["intermediaire", "intermediate", "regular"],
  Avance: ["avance", "advanced", "expert", "pro", "competition"],
};

const OBJECTIVE_KEYWORDS: Record<string, string[]> = {
  Entrainement: ["entrainement", "training", "workout", "fitness", "regular"],
  Sparring: ["sparring"],
  Competition: ["competition", "fight", "combat", "bout"],
  Protection: ["protection", "safety", "protège", "protege", "mouthguard", "headgear", "casque"],
};

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function addWeighted(scores: Map<string, number>, label: string, weight: number) {
  scores.set(label, (scores.get(label) ?? 0) + weight);
}

function scoreDictionary(values: string[], dictionary: Record<string, string[]>) {
  const scores = new Map<string, number>();
  const normalizedValues = values.map(normalizeText).filter(Boolean);

  for (const [label, keywords] of Object.entries(dictionary)) {
    for (const value of normalizedValues) {
      if (normalizeText(label) === value) {
        addWeighted(scores, label, 3);
      }

      if (keywords.some((keyword) => value.includes(normalizeText(keyword)))) {
        addWeighted(scores, label, 1);
      }
    }
  }

  return Array.from(scores.entries())
    .map(([value, score]) => ({ value, score }))
    .sort((a, b) => b.score - a.score || a.value.localeCompare(b.value));
}

function uniqueSorted(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b));
}

function getCollectionLabel(collection: CartContextCollectionInput) {
  return collection.label || collection.title || collection.key || collection.id || "";
}

function buildAiSummary(context: Omit<CartUnderstandingContext, "aiSummary">) {
  const productList = context.products
    .map((product) => `${product.title} x${product.quantity}`)
    .join(", ") || "panier vide";

  return [
    `Le client achete : ${productList}.`,
    `Contexte : Sport : ${context.sport}; Niveau : ${context.level}; Objectif : ${context.objective}.`,
    context.categories.length > 0 ? `Categories detectees : ${context.categories.join(", ")}.` : "",
    context.collections.length > 0 ? `Collections detectees : ${context.collections.join(", ")}.` : "",
  ].filter(Boolean).join(" ");
}

export function buildCartUnderstandingContext(lines: CartContextLineInput[]): CartUnderstandingContext {
  const products = lines.map((line) => ({
    productId: line.productId,
    ...(line.variantId ? { variantId: line.variantId } : {}),
    title: line.title,
    quantity: line.quantity ?? 1,
  }));
  const tags = uniqueSorted(lines.flatMap((line) => line.tags ?? []));
  const categories = uniqueSorted(lines.flatMap((line) => line.categoryTags ?? []));
  const disciplines = uniqueSorted(lines.flatMap((line) => line.disciplineTags ?? []));
  const collections = uniqueSorted(lines.flatMap((line) => [
    ...(line.collectionIds ?? []),
    ...((line.collections ?? []).map(getCollectionLabel)),
  ]));
  const productText = lines.flatMap((line) => [
    line.title,
    ...(line.tags ?? []),
    ...(line.categoryTags ?? []),
    ...(line.disciplineTags ?? []),
    ...(line.collectionIds ?? []),
    ...((line.collections ?? []).map(getCollectionLabel)),
  ]);
  const sportSignals = scoreDictionary([...disciplines, ...productText], SPORT_KEYWORDS);
  const levelSignals = scoreDictionary(productText, LEVEL_KEYWORDS);
  const objectiveSignals = scoreDictionary(productText, OBJECTIVE_KEYWORDS);
  const contextWithoutSummary = {
    sport: sportSignals[0]?.value ?? DEFAULT_CONTEXT_VALUE,
    level: levelSignals[0]?.value ?? DEFAULT_CONTEXT_VALUE,
    objective: objectiveSignals[0]?.value ?? DEFAULT_CONTEXT_VALUE,
    products,
    collections,
    tags,
    categories,
    disciplines,
    signals: {
      sports: sportSignals,
      levels: levelSignals,
      objectives: objectiveSignals,
    },
  };

  return {
    ...contextWithoutSummary,
    aiSummary: buildAiSummary(contextWithoutSummary),
  };
}