type Lang = "fr" | "en";

export interface ShopperMeasurements {
  heightCm?: number;
  weightKg?: number;
}

type ApparelRole = "top" | "bottom" | "other";
type FitVerdict = "ok" | "slightly_small" | "slightly_large" | "too_small" | "too_large" | "unknown";

export interface ApparelLineAssessment {
  label: string;
  /** Short product noun (e.g. "short") that the cart-tool resolver can match on. */
  noun: string;
  size: string;
  role: ApparelRole;
  ordinal: number;
  fit: FitVerdict;
  recommendedSize?: string;
}

export interface SizeConsistencyAnalysis {
  measurements: ShopperMeasurements;
  hasMeasurements: boolean;
  lines: ApparelLineAssessment[];
  recommendedSize?: string;
  /** Ordinal distance between the smallest and largest apparel size in the cart. */
  spread: number;
  issueCount: number;
  confidence: number;
}

interface CartLineLike {
  productTitle?: string | undefined;
  variantTitle?: string | undefined;
}

const SIZE_LABELS = ["XXS", "XS", "S", "M", "L", "XL", "XXL", "3XL"] as const;

const SIZE_ALIASES: Record<string, number> = {
  XXS: 0,
  XS: 1,
  S: 2,
  M: 3,
  L: 4,
  XL: 5,
  XXL: 6,
  "2XL": 6,
  XXXL: 7,
  "3XL": 7,
};

const APPAREL_PATTERN = /t-?shirt|tee\b|short|fightshort|pantalon|jogger|legging|spats|rash\s*guard|rashguard|hoodie|sweat|veste|jacket|jersey|maillot|polo|d[ée]bardeur|tank|top\b|pants?\b|trunks?/i;
const BOTTOM_PATTERN = /short|fightshort|pantalon|jogger|legging|spats|pants?\b|trunks?/i;
const MIN_SPREAD_FOR_WARNING = 2;

function normalizeSizeToken(value: string) {
  return value.trim().toUpperCase().replace(/\s+/g, "");
}

function parseApparelSize(variantTitle: string | undefined): { label: string; ordinal: number } | null {
  if (!variantTitle) return null;

  for (const segment of variantTitle.split(/[\/,|-]/)) {
    const token = normalizeSizeToken(segment);
    const ordinal = SIZE_ALIASES[token];
    if (ordinal !== undefined) {
      return { label: SIZE_LABELS[ordinal] ?? token, ordinal };
    }
  }

  return null;
}

function toRole(title: string): ApparelRole {
  if (!APPAREL_PATTERN.test(title)) return "other";
  return BOTTOM_PATTERN.test(title) ? "bottom" : "top";
}

function parseHeightCm(text: string): number | undefined {
  const compact = text.match(/\b([12])\s*m\s*(\d{2})\b/i);
  if (compact) return Number(compact[1]) * 100 + Number(compact[2]);

  const meters = text.match(/\b([12])(?:[.,](\d{1,2}))?\s*m(?:[eè]tres?)?\b/i);
  if (meters) {
    const decimals = meters[2] ? Number(meters[2].length === 1 ? `${meters[2]}0` : meters[2]) : 0;
    return Number(meters[1]) * 100 + decimals;
  }

  const centimeters = text.match(/\b(1[3-9]\d|2[0-3]\d)\s*cm\b/i);
  if (centimeters) return Number(centimeters[1]);

  if (/\b(?:taille|height|mesure|je\s+mesure|i\s*'?m)\b/i.test(text)) {
    const bare = text.match(/\b(1[3-9]\d|2[0-3]\d)\b(?!\s*(?:kg|kilos?))/);
    if (bare) return Number(bare[1]);
  }

  return undefined;
}

function parseWeightKg(text: string): number | undefined {
  const match = text.match(/\b(\d{2,3})(?:[.,]\d+)?\s*(?:kg|kilos?|kgs)\b/i);
  return match ? Number(match[1]) : undefined;
}

export function extractMeasurementsFromText(text: string): ShopperMeasurements {
  const height = parseHeightCm(text);
  const weight = parseWeightKg(text);

  return {
    ...(height && height >= 130 && height <= 230 ? { heightCm: height } : {}),
    ...(weight && weight >= 30 && weight <= 250 ? { weightKg: weight } : {}),
  };
}

export function providesShopperMeasurements(text: string) {
  const measurements = extractMeasurementsFromText(text);
  return measurements.heightCm !== undefined || measurements.weightKg !== undefined;
}

/** Collects measurements across the conversation; the most recent mention wins. */
export function extractShopperMeasurements(messages: Array<{ role: string; content: string }>): ShopperMeasurements {
  const result: ShopperMeasurements = {};

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (!message || message.role !== "user") continue;

    const found = extractMeasurementsFromText(message.content);
    if (result.heightCm === undefined && found.heightCm !== undefined) result.heightCm = found.heightCm;
    if (result.weightKg === undefined && found.weightKg !== undefined) result.weightKg = found.weightKg;
    if (result.heightCm !== undefined && result.weightKg !== undefined) break;
  }

  return result;
}

function ordinalFromHeight(heightCm: number) {
  if (heightCm < 155) return 1;
  if (heightCm < 165) return 2;
  if (heightCm < 175) return 3;
  if (heightCm < 183) return 4;
  if (heightCm < 191) return 5;
  if (heightCm < 199) return 6;
  return 7;
}

function ordinalFromWeight(weightKg: number) {
  if (weightKg < 55) return 1;
  if (weightKg < 66) return 2;
  if (weightKg < 76) return 3;
  if (weightKg < 86) return 4;
  if (weightKg < 96) return 5;
  if (weightKg < 106) return 6;
  return 7;
}

function recommendOrdinal(measurements: ShopperMeasurements): number | undefined {
  const { heightCm, weightKg } = measurements;
  if (heightCm !== undefined && weightKg !== undefined) {
    return Math.round((ordinalFromHeight(heightCm) + ordinalFromWeight(weightKg)) / 2);
  }
  if (heightCm !== undefined) return ordinalFromHeight(heightCm);
  if (weightKg !== undefined) return ordinalFromWeight(weightKg);
  return undefined;
}

function judgeFit(selected: number, recommended: number): FitVerdict {
  const diff = selected - recommended;
  if (diff === 0) return "ok";
  if (diff === -1) return "slightly_small";
  if (diff === 1) return "slightly_large";
  return diff < 0 ? "too_small" : "too_large";
}

export function analyzeApparelSizes(
  items: CartLineLike[],
  measurements: ShopperMeasurements,
): SizeConsistencyAnalysis | null {
  const recommendedOrdinal = recommendOrdinal(measurements);
  const recommendedSize = recommendedOrdinal !== undefined ? SIZE_LABELS[recommendedOrdinal] : undefined;
  const lines: ApparelLineAssessment[] = [];

  for (const item of items) {
    const label = item.productTitle?.trim();
    const parsed = parseApparelSize(item.variantTitle);
    if (!label || !parsed) continue;

    const role = toRole(label);
    if (role === "other") continue;

    lines.push({
      label,
      noun: label.match(APPAREL_PATTERN)?.[0].toLowerCase().trim() ?? label,
      size: parsed.label,
      role,
      ordinal: parsed.ordinal,
      fit: recommendedOrdinal !== undefined ? judgeFit(parsed.ordinal, recommendedOrdinal) : "unknown",
      ...(recommendedSize ? { recommendedSize } : {}),
    });
  }

  if (lines.length === 0) return null;

  const ordinals = lines.map((line) => line.ordinal);
  const spread = Math.max(...ordinals) - Math.min(...ordinals);
  const hasMeasurements = recommendedOrdinal !== undefined;
  const misfits = lines.filter((line) => line.fit !== "ok" && line.fit !== "unknown").length;
  const hasSpreadIssue = lines.length >= 2 && spread >= MIN_SPREAD_FOR_WARNING;
  const hasBothMeasurements = measurements.heightCm !== undefined && measurements.weightKg !== undefined;

  return {
    measurements,
    hasMeasurements,
    lines,
    ...(recommendedSize ? { recommendedSize } : {}),
    spread,
    issueCount: hasMeasurements ? misfits : (hasSpreadIssue ? 1 : 0),
    confidence: hasBothMeasurements ? 0.75 : hasMeasurements ? 0.6 : 0.5,
  };
}

function describeMeasurements(measurements: ShopperMeasurements, lang: Lang) {
  const parts: string[] = [];
  if (measurements.heightCm !== undefined) parts.push(`${measurements.heightCm} cm`);
  if (measurements.weightKg !== undefined) parts.push(`${measurements.weightKg} kg`);
  return parts.join(lang === "fr" ? " et " : " and ");
}

function describeLine(line: ApparelLineAssessment, lang: Lang) {
  const head = `${line.label} (${line.size})`;
  const rec = line.recommendedSize ?? "";

  if (lang === "fr") {
    switch (line.fit) {
      case "ok": return `${head} : cohérent avec votre morphologie.`;
      case "slightly_small": return `${head} : un peu juste, ${rec} serait plus confortable.`;
      case "slightly_large": return `${head} : un peu ample, ${rec} serait plus ajusté (acceptable si vous aimez une coupe large).`;
      case "too_small": return `${head} : trop petit pour vous, taille conseillée ${rec}.`;
      case "too_large": return `${head} : trop grand pour vous, taille conseillée ${rec}.`;
      default: return head;
    }
  }

  switch (line.fit) {
    case "ok": return `${head}: consistent with your build.`;
    case "slightly_small": return `${head}: a bit snug, ${rec} would be more comfortable.`;
    case "slightly_large": return `${head}: a bit loose, ${rec} would fit closer (fine if you like a relaxed cut).`;
    case "too_small": return `${head}: too small for you, recommended size ${rec}.`;
    case "too_large": return `${head}: too large for you, recommended size ${rec}.`;
    default: return head;
  }
}

function describeSpread(analysis: SizeConsistencyAnalysis, lang: Lang) {
  const sorted = [...analysis.lines].sort((left, right) => left.ordinal - right.ordinal);
  const smallest = sorted[0];
  const largest = sorted[sorted.length - 1];
  if (!smallest || !largest) return "";

  return lang === "fr"
    ? `${largest.label} est en ${largest.size} alors que ${smallest.label} est en ${smallest.size} : ${analysis.spread} tailles d'écart, ce qui est inhabituel pour une même personne.`
    : `${largest.label} is a ${largest.size} while ${smallest.label} is a ${smallest.size}: ${analysis.spread} sizes apart, which is unusual for one person.`;
}

export function buildSizeConsistencyHighlights(analysis: SizeConsistencyAnalysis, lang: Lang): string[] {
  if (analysis.hasMeasurements) {
    return analysis.lines.map((line) => describeLine(line, lang));
  }

  if (analysis.issueCount > 0) {
    return [
      describeSpread(analysis, lang),
      lang === "fr"
        ? "Indiquez votre taille (cm) et votre poids (kg) pour obtenir la taille conseillée."
        : "Share your height (cm) and weight (kg) to get the recommended size.",
    ];
  }

  return [
    lang === "fr"
      ? "Les tailles du panier sont cohérentes entre elles, mais rien ne les confronte encore à votre morphologie."
      : "Cart sizes are consistent with each other, but they are not yet checked against your build.",
  ];
}

/** Phrasings the cart-tool resolver understands, so the shopper can act on the advice directly. */
function buildChangeCommands(analysis: SizeConsistencyAnalysis, lang: Lang) {
  return analysis.lines
    .filter((line) => line.recommendedSize && line.fit !== "ok" && line.fit !== "unknown")
    .slice(0, 2)
    .map((line) => (lang === "fr"
      ? `« passe le ${line.noun} en ${line.recommendedSize} »`
      : `"change the ${line.noun} to ${line.recommendedSize}"`));
}

/**
 * When the structured size block is displayed next to the text, the text only
 * summarizes; otherwise it carries the per-item detail itself.
 */
export function buildSizeConsistencyAnswer(
  analysis: SizeConsistencyAnalysis,
  lang: Lang,
  options: { detailsInBlock?: boolean } = {},
): string {
  const detailsInBlock = options.detailsInBlock ?? false;
  const details = buildSizeConsistencyHighlights(analysis, lang).map((line) => `- ${line}`).join("\n");
  const fr = lang === "fr";

  if (analysis.hasMeasurements) {
    const who = describeMeasurements(analysis.measurements, lang);
    const count = analysis.issueCount;
    const commands = buildChangeCommands(analysis, lang);
    const intro = count === 0
      ? (fr ? `Avec ${who}, les tailles de votre panier sont cohérentes.` : `With ${who}, the sizes in your cart look consistent.`)
      : detailsInBlock
        ? (fr
            ? `Avec ${who}, ${count} article${count > 1 ? "s" : ""} de votre panier ${count > 1 ? "ont" : "a"} une taille à revoir (détail ci-dessous).`
            : `With ${who}, ${count} item${count > 1 ? "s" : ""} in your cart ${count > 1 ? "have" : "has"} a size to review (details below).`)
        : (fr ? `Avec ${who}, certaines tailles de votre panier ne sont pas adaptées :` : `With ${who}, some sizes in your cart are not a good match:`);
    const body = count > 0 && !detailsInBlock ? `\n${details}\n` : "";
    const outro = [
      commands.length > 0
        ? (fr ? `Pour corriger, dites par exemple ${commands.join(" ou ")}.` : `To fix this, say for example ${commands.join(" or ")}.`)
        : "",
      analysis.measurements.weightKg === undefined
        ? (fr ? "Indiquez aussi votre poids (kg) pour affiner la recommandation." : "Share your weight (kg) too to refine the recommendation.")
        : "",
      fr ? "Estimation basée sur une grille générique : vérifiez le guide des tailles de la marque." : "This is an estimate from a generic chart: check the brand's size guide.",
    ].filter(Boolean).join(" ");
    return `${intro}${body}\n${outro}`.trim();
  }

  if (analysis.issueCount > 0) {
    const intro = fr
      ? "Les tailles de votre panier semblent incohérentes entre elles"
      : "The sizes in your cart look inconsistent with each other";
    return detailsInBlock
      ? `${intro} (${fr ? "détail ci-dessous" : "details below"}). ${fr ? "Indiquez votre taille (cm) et votre poids (kg) pour obtenir la taille conseillée." : "Share your height (cm) and weight (kg) to get the recommended size."}`
      : `${intro} :\n${details}`;
  }

  return fr
    ? `Les tailles de votre panier sont cohérentes entre elles. Pour confirmer qu'elles vous vont, indiquez votre taille (cm) et votre poids (kg).`
    : `The sizes in your cart are consistent with each other. To confirm they fit you, share your height (cm) and weight (kg).`;
}

export function buildSizeConsistencySummary(analysis: SizeConsistencyAnalysis, lang: Lang): { title: string; summary: string } {
  if (analysis.issueCount > 0) {
    return lang === "fr"
      ? { title: "Tailles à corriger", summary: `${analysis.issueCount} article${analysis.issueCount > 1 ? "s" : ""} avec une taille à revoir avant de finaliser la commande.` }
      : { title: "Sizes to review", summary: `${analysis.issueCount} item${analysis.issueCount > 1 ? "s" : ""} with a size to review before checkout.` };
  }

  return lang === "fr"
    ? { title: "Tailles cohérentes", summary: analysis.hasMeasurements ? "Les tailles du panier correspondent à votre morphologie." : "Aucune incohérence entre les tailles du panier." }
    : { title: "Consistent sizes", summary: analysis.hasMeasurements ? "Cart sizes match your build." : "No inconsistency between cart sizes." };
}
