import {
  ThresholdBenefitType,
  ThresholdDuplicatePurchasePolicy,
  ThresholdRuleSource,
  ThresholdRuleStatus,
} from "@prisma/client";
import { listThresholdCandidateProducts } from "../db/queries";

export interface CartThresholdItem {
  productId: string;
  shopifyProductId: string;
  variantId: string;
  shopifyVariantId: string;
  title: string;
  quantity: number;
  availableForSale: boolean;
  categoryTags: string[];
  disciplineTags: string[];
  unitPrice?: number | null;
}

export interface ThresholdRuleRecord {
  id: string;
  key: string;
  label: string;
  description?: string | null;
  source: ThresholdRuleSource;
  status: ThresholdRuleStatus;
  priority: number;
  benefitType: ThresholdBenefitType;
  benefitLabel: string;
  targetSubtotal: number;
  actionableWindow: number;
  allowOvershoot: boolean;
  maxSuggestions: number;
  supportedDisciplineTags: string[];
  supportedCategoryTags: string[];
  excludedShopifyProductIds: string[];
  duplicatePurchasePolicy: ThresholdDuplicatePurchasePolicy;
}

export interface ThresholdCandidateProduct {
  productId: string;
  shopifyProductId: string;
  title: string;
  categoryTags: string[];
  disciplineTags: string[];
  variants: Array<{
    id: string;
    shopifyVariantId: string;
    title: string;
    price: number | null;
    inventoryQuantity: number | null;
  }>;
}

export interface ThresholdSuggestionCandidate {
  productId: string;
  variantId?: string;
  title: string;
  unitPrice: number | null;
  relevanceScore: number;
  gapFitScore: number;
  compositeScore: number;
  wouldOvershoot: boolean;
  reasoning: string[];
}

export interface ThresholdScoringWeights {
  relevance: number;
  gapFit: number;
  availability: number;
}

export interface SeedThresholdTemplate {
  key: string;
  label: string;
  description: string;
  priority: number;
  benefitType: ThresholdBenefitType;
  benefitLabel: string;
  targetSubtotal: number;
  actionableWindow: number;
  allowOvershoot: boolean;
  maxSuggestions: number;
  supportedDisciplineTags: string[];
  supportedCategoryTags: string[];
  excludedShopifyProductIds: string[];
  duplicatePurchasePolicy: ThresholdDuplicatePurchasePolicy;
}

export const DEFAULT_THRESHOLD_SCORING_WEIGHTS: ThresholdScoringWeights = {
  relevance: 0.6,
  gapFit: 0.3,
  availability: 0.1,
};

export const DEFAULT_THRESHOLD_TEMPLATES: SeedThresholdTemplate[] = [
  {
    key: "free-shipping-default",
    label: "Free Shipping Threshold",
    description: "Encourage shoppers to reach the default free-shipping goal.",
    priority: 10,
    benefitType: ThresholdBenefitType.FREE_SHIPPING,
    benefitLabel: "Free shipping",
    targetSubtotal: 100,
    actionableWindow: 25,
    allowOvershoot: true,
    maxSuggestions: 3,
    supportedDisciplineTags: [],
    supportedCategoryTags: [],
    excludedShopifyProductIds: [],
    duplicatePurchasePolicy: ThresholdDuplicatePurchasePolicy.DISALLOW,
  },
  {
    key: "premium-discount-tier",
    label: "Premium Discount Tier",
    description: "Highlight a higher-spend cart tier with a merchant-defined discount benefit.",
    priority: 20,
    benefitType: ThresholdBenefitType.DISCOUNT_TIER,
    benefitLabel: "Unlock your premium cart discount",
    targetSubtotal: 150,
    actionableWindow: 35,
    allowOvershoot: true,
    maxSuggestions: 3,
    supportedDisciplineTags: [],
    supportedCategoryTags: [],
    excludedShopifyProductIds: [],
    duplicatePurchasePolicy: ThresholdDuplicatePurchasePolicy.DISALLOW,
  },
];

export function roundThresholdCurrency(value: number): number {
  return Number(value.toFixed(2));
}

export function sortThresholdRules<T extends { priority: number; targetSubtotal: number; key: string }>(
  rules: T[],
): T[] {
  return [...rules].sort((left, right) => {
    if (left.priority !== right.priority) {
      return left.priority - right.priority;
    }

    if (left.targetSubtotal !== right.targetSubtotal) {
      return left.targetSubtotal - right.targetSubtotal;
    }

    return left.key.localeCompare(right.key);
  });
}

export function sortThresholdCandidates<T extends { compositeScore: number; title: string }>(
  candidates: T[],
): T[] {
  return [...candidates].sort((left, right) => {
    if (left.compositeScore !== right.compositeScore) {
      return right.compositeScore - left.compositeScore;
    }

    return left.title.localeCompare(right.title);
  });
}

export function supportsDiscipline(rule: ThresholdRuleRecord, item: Pick<CartThresholdItem, "disciplineTags">): boolean {
  return rule.supportedDisciplineTags.length === 0
    || rule.supportedDisciplineTags.some((tag) => item.disciplineTags.includes(tag));
}

export function supportsCategory(rule: ThresholdRuleRecord, item: Pick<CartThresholdItem, "categoryTags">): boolean {
  return rule.supportedCategoryTags.length === 0
    || rule.supportedCategoryTags.some((tag) => item.categoryTags.includes(tag));
}

export function buildThresholdTemplateRecords(): SeedThresholdTemplate[] {
  return DEFAULT_THRESHOLD_TEMPLATES.map((template) => ({
    ...template,
    supportedDisciplineTags: [...template.supportedDisciplineTags],
    supportedCategoryTags: [...template.supportedCategoryTags],
    excludedShopifyProductIds: [...template.excludedShopifyProductIds],
  }));
}

function overlapScore(source: string[], target: string[]): number {
  if (source.length === 0 || target.length === 0) {
    return 0;
  }

  const targetSet = new Set(target);
  const overlapCount = source.filter((value) => targetSet.has(value)).length;
  return overlapCount / Math.max(source.length, target.length, 1);
}

function buildThresholdCandidateReason(input: {
  candidate: ThresholdCandidateProduct;
  selectedVariantTitle?: string;
  disciplineOverlap: number;
  categoryOverlap: number;
}): string {
  const title = input.selectedVariantTitle
    ? `${input.candidate.title} / ${input.selectedVariantTitle}`
    : input.candidate.title;

  if (input.disciplineOverlap > 0) {
    return `${title} matches the discipline already present in the cart.`;
  }

  if (input.categoryOverlap > 0) {
    return `${title} complements the product categories already present in the cart.`;
  }

  return `${title} is a reasonable add-on for the current cart.`;
}

export function rankThresholdCandidateProducts(input: {
  rule: ThresholdRuleRecord;
  cartItems: CartThresholdItem[];
  candidates: ThresholdCandidateProduct[];
  gapAmount: number;
}): ThresholdSuggestionCandidate[] {
  const cartCategoryTags = Array.from(new Set(input.cartItems.flatMap((item) => item.categoryTags)));
  const cartDisciplineTags = Array.from(new Set(input.cartItems.flatMap((item) => item.disciplineTags)));
  const cartProductIds = new Set(input.cartItems.map((item) => item.shopifyProductId));

  return sortThresholdCandidates(input.candidates.flatMap((candidate) => {
    if (
      input.rule.duplicatePurchasePolicy === ThresholdDuplicatePurchasePolicy.DISALLOW
      && cartProductIds.has(candidate.shopifyProductId)
    ) {
      return [];
    }

    const sortedVariants = [...candidate.variants].sort((left, right) => {
      const leftAvailable = (left.inventoryQuantity ?? 0) > 0;
      const rightAvailable = (right.inventoryQuantity ?? 0) > 0;

      if (leftAvailable !== rightAvailable) {
        return leftAvailable ? -1 : 1;
      }

      const leftGap = Math.abs((left.price ?? Number.MAX_SAFE_INTEGER) - input.gapAmount);
      const rightGap = Math.abs((right.price ?? Number.MAX_SAFE_INTEGER) - input.gapAmount);
      return leftGap - rightGap || left.title.localeCompare(right.title);
    });

    const selectedVariant = sortedVariants[0];
    const unitPrice = selectedVariant?.price ?? null;
    const disciplineOverlap = overlapScore(candidate.disciplineTags, cartDisciplineTags);
    const categoryOverlap = overlapScore(candidate.categoryTags, cartCategoryTags);
    const relevanceScore = roundThresholdCurrency(Math.min(1, disciplineOverlap * 0.7 + categoryOverlap * 0.3 + 0.2));
    const overshootPenalty = !input.rule.allowOvershoot && unitPrice !== null && unitPrice > input.gapAmount ? 0 : 1;
    const gapFitRaw = unitPrice === null
      ? 0
      : Math.max(0, 1 - (Math.abs(unitPrice - input.gapAmount) / Math.max(input.gapAmount, 1)));
    const gapFitScore = roundThresholdCurrency(gapFitRaw * overshootPenalty);
    const availabilityScore = (selectedVariant?.inventoryQuantity ?? 0) > 0 ? 1 : 0;
    const compositeScore = roundThresholdCurrency(
      relevanceScore * DEFAULT_THRESHOLD_SCORING_WEIGHTS.relevance
      + gapFitScore * DEFAULT_THRESHOLD_SCORING_WEIGHTS.gapFit
      + availabilityScore * DEFAULT_THRESHOLD_SCORING_WEIGHTS.availability,
    );

    return [{
      productId: candidate.productId,
      variantId: selectedVariant?.id,
      title: selectedVariant ? `${candidate.title} / ${selectedVariant.title}` : candidate.title,
      unitPrice,
      relevanceScore,
      gapFitScore,
      compositeScore,
      wouldOvershoot: unitPrice !== null && unitPrice > input.gapAmount,
      reasoning: [buildThresholdCandidateReason({
        candidate,
        selectedVariantTitle: selectedVariant?.title,
        disciplineOverlap,
        categoryOverlap,
      })],
    } satisfies ThresholdSuggestionCandidate];
  }));
}

export async function buildThresholdCandidatesForRule(input: {
  shop: string;
  rule: ThresholdRuleRecord;
  cartItems: CartThresholdItem[];
  gapAmount: number;
  take?: number;
}): Promise<ThresholdSuggestionCandidate[]> {
  const candidates = await listThresholdCandidateProducts(input.shop, input.rule, input.take ?? 50);
  return rankThresholdCandidateProducts({
    rule: input.rule,
    cartItems: input.cartItems,
    candidates,
    gapAmount: input.gapAmount,
  });
}