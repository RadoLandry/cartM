import {
  BundleComponentMatchMode,
  BundleDiscountType,
  BundleRuleSource,
  BundleRuleStatus,
} from "@prisma/client";
import {
  listActiveBundleRules,
  listBundleCompletionCandidateProducts,
} from "../db/queries";
import type { BundleDetectionRequest } from "../cart-intelligence/bundles";

export type BundleReasonType =
  | "qualified"
  | "near_complete"
  | "partial_match"
  | "missing_required"
  | "overlap";

export interface CartBundleItem {
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

export interface BundleRuleComponentDefinition {
  id: string;
  componentKey: string;
  label: string;
  description?: string | null;
  isRequired: boolean;
  sortOrder: number;
  minQuantity: number;
  matchMode: BundleComponentMatchMode;
  acceptedCategoryTags: string[];
  acceptedShopifyProductIds: string[];
  acceptedShopifyVariantIds: string[];
}

export interface BundleRuleRecord {
  id: string;
  key: string;
  label: string;
  description?: string | null;
  source: BundleRuleSource;
  status: BundleRuleStatus;
  priority: number;
  completionThreshold: number;
  discountType: BundleDiscountType;
  discountValue: string;
  components: BundleRuleComponentDefinition[];
}

export interface BundleMatchReason {
  reasonType: BundleReasonType;
  confidence: number;
  source: "AUTO" | "MERCHANT" | "HYBRID";
  message: string;
  metadata?: Record<string, unknown>;
}

export interface BundleCompletionCandidate {
  componentKey: string;
  productId: string;
  variantId?: string;
  title: string;
  availableForSale: boolean;
  confidence: number;
  reason: string;
}

export interface BundleCompletionCandidateProduct {
  productId: string;
  shopifyProductId: string;
  title: string;
  categoryTags: string[];
  variants: Array<{
    id: string;
    shopifyVariantId: string;
    title: string;
    inventoryQuantity: number | null;
  }>;
}

export interface BundleProjectionRecord {
  key: string;
  priority: number;
  completionThreshold: number;
  discountType: BundleDiscountType;
  discountValue: string;
  components: Array<{
    componentKey: string;
    isRequired: boolean;
    minQuantity: number;
    matchMode: BundleComponentMatchMode;
    acceptedCategoryTags: string[];
    acceptedShopifyProductIds: string[];
    acceptedShopifyVariantIds: string[];
  }>;
}

export interface SeedBundleTemplate {
  key: string;
  label: string;
  description: string;
  priority: number;
  completionThreshold: number;
  discountType: BundleDiscountType;
  discountValue: string;
  components: Array<{
    componentKey: string;
    label: string;
    description?: string;
    isRequired: boolean;
    sortOrder: number;
    minQuantity: number;
    matchMode: BundleComponentMatchMode;
    acceptedCategoryTags: string[];
    acceptedShopifyProductIds: string[];
    acceptedShopifyVariantIds: string[];
  }>;
}

export const DEFAULT_BUNDLE_TEMPLATES: SeedBundleTemplate[] = [
  {
    key: "boxing-starter-bundle",
    label: "Boxing Starter Bundle",
    description: "Starter boxing bundle with the core essentials and a completion incentive.",
    priority: 10,
    completionThreshold: 0.8,
    discountType: BundleDiscountType.PERCENTAGE,
    discountValue: "10.00",
    components: [
      {
        componentKey: "boxing-gloves",
        label: "Boxing Gloves",
        isRequired: true,
        sortOrder: 10,
        minQuantity: 1,
        matchMode: BundleComponentMatchMode.CATEGORY,
        acceptedCategoryTags: ["gloves", "boxing-gloves"],
        acceptedShopifyProductIds: [],
        acceptedShopifyVariantIds: [],
      },
      {
        componentKey: "hand-wraps",
        label: "Hand Wraps",
        isRequired: true,
        sortOrder: 20,
        minQuantity: 1,
        matchMode: BundleComponentMatchMode.CATEGORY_OR_PRODUCT,
        acceptedCategoryTags: ["hand-wraps", "wraps"],
        acceptedShopifyProductIds: [],
        acceptedShopifyVariantIds: [],
      },
      {
        componentKey: "mouthguard",
        label: "Mouthguard",
        isRequired: true,
        sortOrder: 30,
        minQuantity: 1,
        matchMode: BundleComponentMatchMode.CATEGORY,
        acceptedCategoryTags: ["mouthguard"],
        acceptedShopifyProductIds: [],
        acceptedShopifyVariantIds: [],
      },
      {
        componentKey: "gear-bag",
        label: "Gear Bag",
        isRequired: false,
        sortOrder: 40,
        minQuantity: 1,
        matchMode: BundleComponentMatchMode.CATEGORY,
        acceptedCategoryTags: ["bag", "gear-bag"],
        acceptedShopifyProductIds: [],
        acceptedShopifyVariantIds: [],
      },
    ],
  },
  {
    key: "muay-thai-starter-bundle",
    label: "Muay Thai Starter Bundle",
    description: "Core Muay Thai protection and apparel bundled for fast setup.",
    priority: 20,
    completionThreshold: 0.8,
    discountType: BundleDiscountType.PERCENTAGE,
    discountValue: "12.50",
    components: [
      {
        componentKey: "gloves",
        label: "Gloves",
        isRequired: true,
        sortOrder: 10,
        minQuantity: 1,
        matchMode: BundleComponentMatchMode.CATEGORY,
        acceptedCategoryTags: ["gloves", "muay-thai-gloves"],
        acceptedShopifyProductIds: [],
        acceptedShopifyVariantIds: [],
      },
      {
        componentKey: "shin-guards",
        label: "Shin Guards",
        isRequired: true,
        sortOrder: 20,
        minQuantity: 1,
        matchMode: BundleComponentMatchMode.CATEGORY,
        acceptedCategoryTags: ["shin-guards"],
        acceptedShopifyProductIds: [],
        acceptedShopifyVariantIds: [],
      },
      {
        componentKey: "shorts",
        label: "Shorts",
        isRequired: false,
        sortOrder: 30,
        minQuantity: 1,
        matchMode: BundleComponentMatchMode.CATEGORY,
        acceptedCategoryTags: ["shorts", "muay-thai-shorts"],
        acceptedShopifyProductIds: [],
        acceptedShopifyVariantIds: [],
      },
    ],
  },
];

export function createBundleReason(
  reasonType: BundleReasonType,
  confidence: number,
  source: BundleMatchReason["source"],
  message: string,
  metadata?: Record<string, unknown>,
): BundleMatchReason {
  return { reasonType, confidence, source, message, metadata };
}

export function sortBundleComponents<T extends { isRequired: boolean; sortOrder: number; label: string }>(
  components: T[],
): T[] {
  return [...components].sort((left, right) => {
    if (left.isRequired !== right.isRequired) {
      return left.isRequired ? -1 : 1;
    }

    if (left.sortOrder !== right.sortOrder) {
      return left.sortOrder - right.sortOrder;
    }

    return left.label.localeCompare(right.label);
  });
}

export function toBundleProjection(rule: BundleRuleRecord): BundleProjectionRecord {
  return {
    key: rule.key,
    priority: rule.priority,
    completionThreshold: rule.completionThreshold,
    discountType: rule.discountType,
    discountValue: rule.discountValue,
    components: rule.components.map((component) => ({
      componentKey: component.componentKey,
      isRequired: component.isRequired,
      minQuantity: component.minQuantity,
      matchMode: component.matchMode,
      acceptedCategoryTags: component.acceptedCategoryTags,
      acceptedShopifyProductIds: component.acceptedShopifyProductIds,
      acceptedShopifyVariantIds: component.acceptedShopifyVariantIds,
    })),
  };
}

function getBundleCandidateReason(
  component: BundleRuleComponentDefinition,
  candidate: BundleCompletionCandidateProduct,
  variant?: BundleCompletionCandidateProduct["variants"][number],
): { confidence: number; reason: string } {
  if (variant && component.acceptedShopifyVariantIds.includes(variant.shopifyVariantId)) {
    return {
      confidence: 0.97,
      reason: `${candidate.title} matches the configured bundle variant for ${component.label}.`,
    };
  }

  if (component.acceptedShopifyProductIds.includes(candidate.shopifyProductId)) {
    return {
      confidence: 0.92,
      reason: `${candidate.title} matches the configured bundle product for ${component.label}.`,
    };
  }

  return {
    confidence: 0.82,
    reason: `${candidate.title} matches the configured bundle category for ${component.label}.`,
  };
}

export function rankBundleCompletionCandidates(
  component: BundleRuleComponentDefinition,
  candidates: BundleCompletionCandidateProduct[],
): BundleCompletionCandidate[] {
  return candidates
    .map((candidate) => {
      const preferredVariant = candidate.variants.find((variant) =>
        component.acceptedShopifyVariantIds.includes(variant.shopifyVariantId),
      );
      const fallbackVariant = candidate.variants.find((variant) => (variant.inventoryQuantity ?? 0) > 0)
        ?? candidate.variants[0];
      const selectedVariant = preferredVariant ?? fallbackVariant;
      const availableForSale = selectedVariant ? (selectedVariant.inventoryQuantity ?? 1) > 0 : true;
      const { confidence, reason } = getBundleCandidateReason(component, candidate, selectedVariant);

      return {
        componentKey: component.componentKey,
        productId: candidate.productId,
        variantId: selectedVariant?.id,
        title: selectedVariant ? `${candidate.title} / ${selectedVariant.title}` : candidate.title,
        availableForSale,
        confidence: availableForSale ? confidence : Math.max(0.5, confidence - 0.12),
        reason,
      } satisfies BundleCompletionCandidate;
    })
    .sort((left, right) => {
      if (left.availableForSale !== right.availableForSale) {
        return left.availableForSale ? -1 : 1;
      }

      if (right.confidence !== left.confidence) {
        return right.confidence - left.confidence;
      }

      return left.title.localeCompare(right.title);
    });
}

export async function buildBundleCompletionCandidateMap(
  shop: string,
  components: BundleRuleComponentDefinition[],
): Promise<Record<string, BundleCompletionCandidate[]>> {
  const entries = await Promise.all(components.map(async (component) => {
    const products = await listBundleCompletionCandidateProducts(shop, component);
    return [component.componentKey, rankBundleCompletionCandidates(component, products)] as const;
  }));

  return Object.fromEntries(entries);
}

export async function buildBundleDetectionRequest(
  shop: string,
  cartItems: CartBundleItem[],
): Promise<BundleDetectionRequest> {
  const bundleRules = await listActiveBundleRules(shop);

  return {
    shop,
    cartItems,
    bundleRules,
  };
}