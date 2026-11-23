// Client-safe constants: must not import server-only modules (db, AI providers).

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

/** Minimum confidence to auto-accept a classification without merchant review */
export const CONFIDENCE_THRESHOLD = 0.8;
