import { describe, expect, it } from "vitest";
import { RelationshipType, RequirementMatchMode } from "@prisma/client";
import {
  buildDefaultKitTemplates,
  fulfillKitRequirement,
  groupItemsByDiscipline,
  type CartKitItem,
  type KitRequirementDefinition,
  type RelationshipSupportEdge,
} from "../../../app/lib/knowledge-graph/kits";

function makeCartItem(overrides: Partial<CartKitItem> = {}): CartKitItem {
  return {
    productId: "prod-1",
    shopifyProductId: "gid://shopify/Product/1",
    title: "Boxing Gloves",
    quantity: 1,
    availableForSale: true,
    disciplineTags: ["boxing"],
    categoryTags: ["gloves"],
    ...overrides,
  };
}

function makeRequirement(overrides: Partial<KitRequirementDefinition> = {}): KitRequirementDefinition {
  return {
    id: "req-1",
    requirementKey: "hand-wraps",
    label: "Hand Wraps",
    isRequired: true,
    priority: 20,
    safetyCritical: true,
    matchMode: RequirementMatchMode.CATEGORY,
    acceptedCategoryTags: ["hand-wraps"],
    acceptedShopifyProductIds: [],
    acceptedRelationshipTypes: [],
    minQuantity: 1,
    ...overrides,
  };
}

describe("buildDefaultKitTemplates", () => {
  it("returns stable starter templates for core combat disciplines", () => {
    const templates = buildDefaultKitTemplates();

    expect(templates.map((template) => template.key)).toEqual([
      "boxing-starter",
      "muay-thai-starter",
      "bjj-training",
    ]);
    expect(templates[0].requirements.some((requirement) => requirement.requirementKey === "hand-wraps")).toBe(true);
  });
});

describe("groupItemsByDiscipline", () => {
  it("groups items under every discipline tag they carry", () => {
    const groups = groupItemsByDiscipline([
      makeCartItem({ productId: "prod-1", disciplineTags: ["boxing", "mma"] }),
      makeCartItem({ productId: "prod-2", disciplineTags: ["mma"], categoryTags: ["shin-guards"] }),
    ]);

    expect(groups.get("boxing")?.map((item) => item.productId)).toEqual(["prod-1"]);
    expect(groups.get("mma")?.map((item) => item.productId)).toEqual(["prod-1", "prod-2"]);
  });
});

describe("fulfillKitRequirement", () => {
  it("marks a requirement matched when a category-tag match is present", () => {
    const result = fulfillKitRequirement(
      makeRequirement(),
      [makeCartItem({ productId: "prod-wraps", categoryTags: ["hand-wraps"] })],
      [],
    );

    expect(result.status).toBe("matched");
    expect(result.matchedProductIds).toEqual(["prod-wraps"]);
  });

  it("uses accepted alternative relationships for PRODUCT_OR_ALTERNATIVE requirements", () => {
    const relationships: RelationshipSupportEdge[] = [
      {
        sourceProductId: "prod-alt",
        targetProductId: "internal-target",
        relationshipType: RelationshipType.ALTERNATIVES,
        strength: 0.88,
      },
    ];

    const result = fulfillKitRequirement(
      makeRequirement({
        matchMode: RequirementMatchMode.PRODUCT_OR_ALTERNATIVE,
        acceptedCategoryTags: [],
        acceptedShopifyProductIds: ["gid://shopify/Product/99"],
        acceptedRelationshipTypes: [RelationshipType.ALTERNATIVES],
      }),
      [makeCartItem({ productId: "prod-alt", shopifyProductId: "gid://shopify/Product/2", categoryTags: ["gloves"] })],
      relationships,
      {
        acceptedInternalProductIdsByShopifyId: {
          "gid://shopify/Product/99": ["internal-target"],
        },
      },
    );

    expect(result.status).toBe("matched");
    expect(result.reasons.some((reason) => reason.reasonType === "substitute_match")).toBe(true);
  });

  it("marks the requirement missing when no accepted match is found", () => {
    const result = fulfillKitRequirement(
      makeRequirement({ isRequired: false, safetyCritical: false }),
      [makeCartItem({ categoryTags: ["gloves"] })],
      [],
    );

    expect(result.status).toBe("missing");
    expect(result.reasons[0].reasonType).toBe("optional_missing");
  });
});