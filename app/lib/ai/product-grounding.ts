// Guards LLM answers against product names that do not exist in the shop catalog.

const DISCIPLINE_WORDS = new Set([
  "mma", "bjj", "jjb", "muay", "thai", "boxe", "boxing", "kickboxing", "judo", "karate",
  "grappling", "wrestling", "lutte", "jiu", "jitsu", "nogi", "gi",
]);

const TITLE_SIMILARITY_THRESHOLD = 0.75;

function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function significantTokens(value: string) {
  return normalize(value).split(/[^a-z0-9]+/).filter((token) => token.length >= 3);
}

// Only list items are inspected: "1. **Title** - why" or "- Title: why".
const LIST_ITEM_RE = /^\s*(?:\d+[.)]|[-*•])\s+(?:\*\*(.+?)\*\*|([^\n:]+?)(?:\s+[-–—:]\s|$))/gm;

function looksLikeProductName(segment: string) {
  const words = segment.trim().split(/\s+/).filter(Boolean);
  if (words.length < 3) return false;

  const distinctive = words
    .map((word, index) => ({ word, index }))
    .filter(({ word }) => /^[\p{Lu}\d]/u.test(word) && !DISCIPLINE_WORDS.has(normalize(word).replace(/[^a-z]/g, "")));
  const beyondFirst = distinctive.filter(({ index }) => index > 0).length;

  return distinctive.length >= 3 || beyondFirst >= 2;
}

function matchesKnownTitle(segment: string, knownTitles: string[]) {
  const normalizedSegment = normalize(segment).trim();
  const segmentTokens = significantTokens(segment);
  if (segmentTokens.length === 0) return true;

  return knownTitles.some((title) => {
    const normalizedTitle = normalize(title).trim();
    if (normalizedTitle.includes(normalizedSegment) || normalizedSegment.includes(normalizedTitle)) return true;
    const titleTokens = new Set(significantTokens(title));
    const overlap = segmentTokens.filter((token) => titleTokens.has(token)).length;
    return overlap / segmentTokens.length >= TITLE_SIMILARITY_THRESHOLD;
  });
}

export function findUngroundedProductMentions(text: string, knownTitles: string[]) {
  const mentions: string[] = [];
  for (const match of text.matchAll(LIST_ITEM_RE)) {
    const segment = (match[1] ?? match[2] ?? "").trim();
    if (!segment || !looksLikeProductName(segment)) continue;
    if (!matchesKnownTitle(segment, knownTitles)) mentions.push(segment);
  }
  return mentions;
}

export interface GroundedFallbackProduct {
  title: string;
  price?: number | null;
}

export function buildUngroundedProductFallback(input: {
  lang: "fr" | "en";
  products: GroundedFallbackProduct[];
  currencyCode: string;
}) {
  const { lang, products, currencyCode } = input;
  const formatter = new Intl.NumberFormat(lang === "fr" ? "fr-FR" : "en-US", { style: "currency", currency: currencyCode });

  if (products.length === 0) {
    return lang === "fr"
      ? "Je n'ai pas trouvé de produit correspondant dans le catalogue pour le moment. Dites-moi votre discipline (boxe, MMA, JJB…), votre niveau ou une autre catégorie d'article, et je chercherai dans la boutique."
      : "I couldn't find a matching product in the catalog right now. Tell me your discipline (boxing, MMA, BJJ…), your level or another product category, and I'll look through the shop.";
  }

  const lines = products.map((product) => (
    product.price && product.price > 0 ? `- ${product.title} (${formatter.format(product.price)})` : `- ${product.title}`
  ));
  return lang === "fr"
    ? `Voici ce que j'ai trouvé dans le catalogue :\n${lines.join("\n")}\nSouhaitez-vous que j'en ajoute un à votre panier ? Dites-moi aussi votre discipline pour affiner.`
    : `Here is what I found in the catalog:\n${lines.join("\n")}\nWould you like me to add one to your cart? Tell me your discipline too so I can refine.`;
}
