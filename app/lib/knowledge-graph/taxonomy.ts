/**
 * Canonical taxonomy for CartMind discipline & category classification.
 *
 * This is the single source of truth for valid discipline and category values.
 * LLM outputs are validated and normalized against these arrays before persisting.
 */

export const DISCIPLINES = [
  "Boxing",
  "Muay Thai",
  "BJJ",
  "MMA",
  "Fitness",
] as const;

export const CATEGORIES = [
  "Protection",
  "Apparel",
  "Accessories",
  "Equipment",
] as const;

export type Discipline = (typeof DISCIPLINES)[number];
export type Category = (typeof CATEGORIES)[number];

/** Fuzzy alias map: normalized lower-case input → canonical discipline */
const DISCIPLINE_ALIASES: Record<string, Discipline> = {
  boxing: "Boxing",
  box: "Boxing",
  boxe: "Boxing",
  "muay thai": "Muay Thai",
  muaythai: "Muay Thai",
  kickboxing: "Muay Thai",
  "kick boxing": "Muay Thai",
  bjj: "BJJ",
  "brazilian jiu-jitsu": "BJJ",
  "jiu jitsu": "BJJ",
  jiujitsu: "BJJ",
  "jiu-jitsu": "BJJ",
  grappling: "BJJ",
  mma: "MMA",
  "mixed martial arts": "MMA",
  fitness: "Fitness",
  gym: "Fitness",
  crossfit: "Fitness",
  training: "Fitness",
  workout: "Fitness",
};

/** Fuzzy alias map: normalized lower-case input → canonical category */
const CATEGORY_ALIASES: Record<string, Category> = {
  protection: "Protection",
  protective: "Protection",
  guard: "Protection",
  safety: "Protection",
  headgear: "Protection",
  gloves: "Protection",
  gants: "Protection",
  apparel: "Apparel",
  clothing: "Apparel",
  shorts: "Apparel",
  rashguard: "Apparel",
  "rash guard": "Apparel",
  tshirt: "Apparel",
  "t-shirt": "Apparel",
  accessories: "Accessories",
  accessory: "Accessories",
  bag: "Accessories",
  wrap: "Accessories",
  wraps: "Accessories",
  mouthguard: "Accessories",
  "mouth guard": "Accessories",
  equipment: "Equipment",
  gear: "Equipment",
  pads: "Equipment",
  bag_punching: "Equipment",
};

/**
 * Normalize a raw discipline string to a canonical Discipline value.
 * Returns null if no match is found.
 */
export function normalizeDiscipline(raw: string): Discipline | null {
  const key = raw.trim().toLowerCase();
  if (DISCIPLINE_ALIASES[key]) return DISCIPLINE_ALIASES[key];
  // Direct match (case-insensitive)
  const direct = DISCIPLINES.find((d) => d.toLowerCase() === key);
  return direct ?? null;
}

/**
 * Normalize a raw category string to a canonical Category value.
 * Returns null if no match is found.
 */
export function normalizeCategory(raw: string): Category | null {
  const key = raw.trim().toLowerCase();
  if (CATEGORY_ALIASES[key]) return CATEGORY_ALIASES[key];
  const direct = CATEGORIES.find((c) => c.toLowerCase() === key);
  return direct ?? null;
}

/**
 * Filter and deduplicate an array of raw discipline strings to canonical values.
 * Falls back to empty array — caller must handle the uncategorized case.
 */
export function normalizeDisciplines(raws: string[]): Discipline[] {
  const results = raws
    .map(normalizeDiscipline)
    .filter((d): d is Discipline => d !== null);
  return Array.from(new Set(results));
}

/**
 * Filter and deduplicate an array of raw category strings to canonical values.
 * Falls back to empty array — caller must handle the uncategorized case.
 */
export function normalizeCategories(raws: string[]): Category[] {
  const results = raws
    .map(normalizeCategory)
    .filter((c): c is Category => c !== null);
  return Array.from(new Set(results));
}
