import {
  KitDefinitionSource,
  KitDefinitionStatus,
  RelationshipType,
  RequirementMatchMode,
} from "@prisma/client";

export type KitReasonType =
  | "discipline_match"
  | "relationship_support"
  | "merchant_override"
  | "required_missing"
  | "optional_missing"
  | "substitute_match";

export interface CartKitItem {
  productId: string;
  shopifyProductId: string;
  title: string;
  quantity: number;
  availableForSale: boolean;
  disciplineTags: string[];
  categoryTags: string[];
}

export interface KitRequirementDefinition {
  id: string;
  requirementKey: string;
  label: string;
  isRequired: boolean;
  priority: number;
  safetyCritical: boolean;
  matchMode: RequirementMatchMode;
  acceptedCategoryTags: string[];
  acceptedShopifyProductIds: string[];
  acceptedRelationshipTypes: RelationshipType[];
  minQuantity: number;
}

export interface KitDefinitionRecord {
  id: string;
  key: string;
  label: string;
  disciplineTag: string;
  description?: string | null;
  source: KitDefinitionSource;
  status: KitDefinitionStatus;
  requirements: KitRequirementDefinition[];
}

export interface KitAssessmentReason {
  reasonType: KitReasonType;
  confidence: number;
  source: "AUTO" | "MERCHANT" | "HYBRID";
  message: string;
  metadata?: Record<string, unknown>;
}

export interface RequirementCoverage {
  requirementKey: string;
  label: string;
  isRequired: boolean;
  priority: number;
  safetyCritical: boolean;
  status: "matched" | "missing";
  matchedProductIds: string[];
  reasons: KitAssessmentReason[];
}

export interface KitAssessment {
  kitKey: string;
  label: string;
  disciplineTag: string;
  confidence: number;
  completenessScore: number;
  status: "none" | "partial" | "complete";
  matchedRequirements: RequirementCoverage[];
  missingRequirements: RequirementCoverage[];
  reasons: KitAssessmentReason[];
}

export interface RelationshipSupportEdge {
  sourceProductId: string;
  targetProductId: string;
  relationshipType: RelationshipType;
  strength: number;
}

export interface RequirementFulfillmentOptions {
  acceptedInternalProductIdsByShopifyId?: Record<string, string[]>;
}

export interface SeedKitTemplate {
  key: string;
  label: string;
  disciplineTag: string;
  description: string;
  requirements: Array<{
    requirementKey: string;
    label: string;
    isRequired: boolean;
    priority: number;
    safetyCritical: boolean;
    matchMode: RequirementMatchMode;
    acceptedCategoryTags: string[];
    acceptedShopifyProductIds: string[];
    acceptedRelationshipTypes: RelationshipType[];
    minQuantity: number;
  }>;
}

export const DEFAULT_KIT_TEMPLATES: SeedKitTemplate[] = [
  {
    key: "boxing-starter",
    label: "Boxing Starter Kit",
    disciplineTag: "boxing",
    description: "Starter boxing gear with safety-first essentials.",
    requirements: [
      {
        requirementKey: "boxing-gloves",
        label: "Boxing Gloves",
        isRequired: true,
        priority: 10,
        safetyCritical: true,
        matchMode: RequirementMatchMode.CATEGORY,
        acceptedCategoryTags: ["gloves", "boxing-gloves"],
        acceptedShopifyProductIds: [],
        acceptedRelationshipTypes: [],
        minQuantity: 1,
      },
      {
        requirementKey: "hand-wraps",
        label: "Hand Wraps",
        isRequired: true,
        priority: 20,
        safetyCritical: true,
        matchMode: RequirementMatchMode.CATEGORY_OR_PRODUCT,
        acceptedCategoryTags: ["hand-wraps", "wraps"],
        acceptedShopifyProductIds: [],
        acceptedRelationshipTypes: [RelationshipType.ALTERNATIVES],
        minQuantity: 1,
      },
      {
        requirementKey: "mouthguard",
        label: "Mouthguard",
        isRequired: true,
        priority: 30,
        safetyCritical: true,
        matchMode: RequirementMatchMode.CATEGORY,
        acceptedCategoryTags: ["mouthguard"],
        acceptedShopifyProductIds: [],
        acceptedRelationshipTypes: [],
        minQuantity: 1,
      },
      {
        requirementKey: "gear-bag",
        label: "Gear Bag",
        isRequired: false,
        priority: 80,
        safetyCritical: false,
        matchMode: RequirementMatchMode.CATEGORY,
        acceptedCategoryTags: ["bag", "gear-bag"],
        acceptedShopifyProductIds: [],
        acceptedRelationshipTypes: [],
        minQuantity: 1,
      },
    ],
  },
  {
    key: "muay-thai-starter",
    label: "Muay Thai Starter Kit",
    disciplineTag: "muay-thai",
    description: "Core Muay Thai striking gear and protection.",
    requirements: [
      {
        requirementKey: "gloves",
        label: "Gloves",
        isRequired: true,
        priority: 10,
        safetyCritical: true,
        matchMode: RequirementMatchMode.CATEGORY,
        acceptedCategoryTags: ["gloves", "muay-thai-gloves"],
        acceptedShopifyProductIds: [],
        acceptedRelationshipTypes: [],
        minQuantity: 1,
      },
      {
        requirementKey: "shin-guards",
        label: "Shin Guards",
        isRequired: true,
        priority: 20,
        safetyCritical: true,
        matchMode: RequirementMatchMode.CATEGORY,
        acceptedCategoryTags: ["shin-guards"],
        acceptedShopifyProductIds: [],
        acceptedRelationshipTypes: [],
        minQuantity: 1,
      },
      {
        requirementKey: "shorts",
        label: "Shorts",
        isRequired: false,
        priority: 70,
        safetyCritical: false,
        matchMode: RequirementMatchMode.CATEGORY,
        acceptedCategoryTags: ["shorts", "muay-thai-shorts"],
        acceptedShopifyProductIds: [],
        acceptedRelationshipTypes: [RelationshipType.ALTERNATIVES],
        minQuantity: 1,
      },
    ],
  },
  {
    key: "bjj-training",
    label: "BJJ Training Kit",
    disciplineTag: "bjj",
    description: "Core grappling apparel and training essentials.",
    requirements: [
      {
        requirementKey: "rashguard",
        label: "Rashguard",
        isRequired: true,
        priority: 10,
        safetyCritical: false,
        matchMode: RequirementMatchMode.CATEGORY,
        acceptedCategoryTags: ["rashguard"],
        acceptedShopifyProductIds: [],
        acceptedRelationshipTypes: [RelationshipType.ALTERNATIVES],
        minQuantity: 1,
      },
      {
        requirementKey: "fight-shorts",
        label: "Fight Shorts",
        isRequired: true,
        priority: 20,
        safetyCritical: false,
        matchMode: RequirementMatchMode.CATEGORY,
        acceptedCategoryTags: ["shorts", "fight-shorts"],
        acceptedShopifyProductIds: [],
        acceptedRelationshipTypes: [RelationshipType.ALTERNATIVES],
        minQuantity: 1,
      },
    ],
  },
];

export function createKitReason(
  reasonType: KitReasonType,
  confidence: number,
  source: KitAssessmentReason["source"],
  message: string,
  metadata?: Record<string, unknown>,
): KitAssessmentReason {
  return { reasonType, confidence, source, message, metadata };
}

export function sortRequirementCoverage(coverages: RequirementCoverage[]): RequirementCoverage[] {
  return [...coverages].sort((left, right) => {
    if (left.isRequired !== right.isRequired) {
      return left.isRequired ? -1 : 1;
    }

    if (left.safetyCritical !== right.safetyCritical) {
      return left.safetyCritical ? -1 : 1;
    }

    return left.priority - right.priority;
  });
}

export function buildDefaultKitTemplates(): SeedKitTemplate[] {
  return DEFAULT_KIT_TEMPLATES.map((template) => ({
    ...template,
    requirements: template.requirements.map((requirement) => ({
      ...requirement,
      acceptedCategoryTags: [...requirement.acceptedCategoryTags],
      acceptedShopifyProductIds: [...requirement.acceptedShopifyProductIds],
      acceptedRelationshipTypes: [...requirement.acceptedRelationshipTypes],
    })),
  }));
}

export function groupItemsByDiscipline(items: CartKitItem[]): Map<string, CartKitItem[]> {
  const groups = new Map<string, CartKitItem[]>();

  for (const item of items) {
    for (const disciplineTag of item.disciplineTags) {
      const group = groups.get(disciplineTag) ?? [];
      group.push(item);
      groups.set(disciplineTag, group);
    }
  }

  return groups;
}

function getAcceptedInternalProductIds(
  requirement: KitRequirementDefinition,
  acceptedInternalProductIdsByShopifyId: Record<string, string[]> | undefined,
): string[] {
  if (!acceptedInternalProductIdsByShopifyId) {
    return [];
  }

  const accepted = new Set<string>();
  for (const shopifyProductId of requirement.acceptedShopifyProductIds) {
    for (const internalId of acceptedInternalProductIdsByShopifyId[shopifyProductId] ?? []) {
      accepted.add(internalId);
    }
  }

  return Array.from(accepted);
}

export function fulfillKitRequirement(
  requirement: KitRequirementDefinition,
  items: CartKitItem[],
  relationships: RelationshipSupportEdge[],
  options: RequirementFulfillmentOptions = {},
): RequirementCoverage {
  const directProductMatches = items.filter((item) =>
    requirement.acceptedShopifyProductIds.includes(item.shopifyProductId),
  );

  const categoryMatches = items.filter((item) =>
    item.categoryTags.some((categoryTag) => requirement.acceptedCategoryTags.includes(categoryTag)),
  );

  const acceptedInternalProductIds = getAcceptedInternalProductIds(
    requirement,
    options.acceptedInternalProductIdsByShopifyId,
  );

  const alternativeMatches =
    requirement.matchMode === RequirementMatchMode.PRODUCT_OR_ALTERNATIVE && acceptedInternalProductIds.length > 0
      ? items.filter((item) =>
          relationships.some(
            (relationship) =>
              relationship.relationshipType === RelationshipType.ALTERNATIVES &&
              ((relationship.sourceProductId === item.productId &&
                acceptedInternalProductIds.includes(relationship.targetProductId)) ||
                (relationship.targetProductId === item.productId &&
                  acceptedInternalProductIds.includes(relationship.sourceProductId))),
          ),
        )
      : [];

  const matchedItems = new Map<string, CartKitItem>();
  const shouldAllowCategoryMatch =
    requirement.matchMode === RequirementMatchMode.CATEGORY ||
    requirement.matchMode === RequirementMatchMode.CATEGORY_OR_PRODUCT;
  const shouldAllowProductMatch =
    requirement.matchMode === RequirementMatchMode.PRODUCT ||
    requirement.matchMode === RequirementMatchMode.CATEGORY_OR_PRODUCT ||
    requirement.matchMode === RequirementMatchMode.PRODUCT_OR_ALTERNATIVE;

  if (shouldAllowProductMatch) {
    for (const item of directProductMatches) {
      matchedItems.set(item.productId, item);
    }
  }

  if (shouldAllowCategoryMatch) {
    for (const item of categoryMatches) {
      matchedItems.set(item.productId, item);
    }
  }

  if (requirement.matchMode === RequirementMatchMode.PRODUCT_OR_ALTERNATIVE) {
    for (const item of alternativeMatches) {
      matchedItems.set(item.productId, item);
    }
  }

  const matched = Array.from(matchedItems.values());
  const totalQuantity = matched.reduce((sum, item) => sum + Math.max(1, item.quantity), 0);
  const status = totalQuantity >= requirement.minQuantity ? "matched" : "missing";
  const reasons: KitAssessmentReason[] = [];

  if (status === "matched") {
    if (directProductMatches.length > 0 || categoryMatches.length > 0) {
      reasons.push(
        createKitReason(
          "discipline_match",
          requirement.isRequired ? 0.9 : 0.75,
          "AUTO",
          `${requirement.label} is already represented in the cart.`,
          {
            matchedProductIds: matched.map((item) => item.productId),
          },
        ),
      );
    }

    if (alternativeMatches.length > 0) {
      reasons.push(
        createKitReason(
          "substitute_match",
          0.82,
          "AUTO",
          `${requirement.label} is satisfied by a recognized alternative product.`,
          {
            matchedProductIds: alternativeMatches.map((item) => item.productId),
          },
        ),
      );
    }
  } else {
    reasons.push(
      createKitReason(
        requirement.isRequired ? "required_missing" : "optional_missing",
        requirement.isRequired ? 0.92 : 0.65,
        "AUTO",
        `${requirement.label} is still missing from this kit.`,
        {
          minQuantity: requirement.minQuantity,
        },
      ),
    );
  }

  return {
    requirementKey: requirement.requirementKey,
    label: requirement.label,
    isRequired: requirement.isRequired,
    priority: requirement.priority,
    safetyCritical: requirement.safetyCritical,
    status,
    matchedProductIds: matched.map((item) => item.productId),
    reasons,
  };
}