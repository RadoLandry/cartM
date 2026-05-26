import { describe, expect, it } from "vitest";
import { KitDefinitionSource, KitDefinitionStatus, RelationshipType, RequirementMatchMode } from "@prisma/client";
import { detectKitCompleteness } from "../../../app/lib/cart-intelligence/kit-detection";
import type { CartKitItem, KitDefinitionRecord, RelationshipSupportEdge } from "../../../app/lib/knowledge-graph/kits";

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

function makeKit(overrides: Partial<KitDefinitionRecord> = {}): KitDefinitionRecord {
  return {
    id: "kit-1",
    key: "boxing-starter",
    label: "Boxing Starter Kit",
    disciplineTag: "boxing",
    description: "Starter boxing essentials",
    source: KitDefinitionSource.AUTO,
    status: KitDefinitionStatus.ACTIVE,
    requirements: [
      {
        id: "req-1",
        requirementKey: "boxing-gloves",
        label: "Boxing Gloves",
        isRequired: true,
        priority: 10,
        safetyCritical: true,
        matchMode: RequirementMatchMode.CATEGORY,
        acceptedCategoryTags: ["gloves"],
        acceptedShopifyProductIds: [],
        acceptedRelationshipTypes: [],
        minQuantity: 1,
      },
      {
        id: "req-2",
        requirementKey: "hand-wraps",
        label: "Hand Wraps",
        isRequired: true,
        priority: 20,
        safetyCritical: true,
        matchMode: RequirementMatchMode.CATEGORY_OR_PRODUCT,
        acceptedCategoryTags: ["hand-wraps"],
        acceptedShopifyProductIds: [],
        acceptedRelationshipTypes: [RelationshipType.ALTERNATIVES],
        minQuantity: 1,
      },
      {
        id: "req-3",
        requirementKey: "gear-bag",
        label: "Gear Bag",
        isRequired: false,
        priority: 80,
        safetyCritical: false,
        matchMode: RequirementMatchMode.CATEGORY,
        acceptedCategoryTags: ["gear-bag"],
        acceptedShopifyProductIds: [],
        acceptedRelationshipTypes: [],
        minQuantity: 1,
      },
    ],
    ...overrides,
  };
}

describe("detectKitCompleteness", () => {
  it("returns no assessments for an empty cart", async () => {
    const result = await detectKitCompleteness({
      shop: "test.myshopify.com",
      items: [],
      kitDefinitions: [makeKit()],
      relationships: [],
    });

    expect(result).toEqual([]);
  });

  it("infers a single discipline kit and reports missing requirements", async () => {
    const result = await detectKitCompleteness({
      shop: "test.myshopify.com",
      items: [makeCartItem()],
      kitDefinitions: [makeKit()],
      relationships: [],
    });

    expect(result).toHaveLength(1);
    expect(result[0].disciplineTag).toBe("boxing");
    expect(result[0].status).toBe("partial");
    expect(result[0].missingRequirements.map((requirement) => requirement.requirementKey)).toEqual([
      "hand-wraps",
      "gear-bag",
    ]);
  });

  it("evaluates mixed-discipline carts independently", async () => {
    const result = await detectKitCompleteness({
      shop: "test.myshopify.com",
      items: [
        makeCartItem({ productId: "prod-1", disciplineTags: ["boxing"], categoryTags: ["gloves"] }),
        makeCartItem({ productId: "prod-2", disciplineTags: ["bjj"], categoryTags: ["rashguard"] }),
      ],
      kitDefinitions: [
        makeKit(),
        makeKit({
          id: "kit-2",
          key: "bjj-training",
          label: "BJJ Training Kit",
          disciplineTag: "bjj",
          requirements: [
            {
              id: "req-bjj-1",
              requirementKey: "rashguard",
              label: "Rashguard",
              isRequired: true,
              priority: 10,
              safetyCritical: false,
              matchMode: RequirementMatchMode.CATEGORY,
              acceptedCategoryTags: ["rashguard"],
              acceptedShopifyProductIds: [],
              acceptedRelationshipTypes: [],
              minQuantity: 1,
            },
            {
              id: "req-bjj-2",
              requirementKey: "fight-shorts",
              label: "Fight Shorts",
              isRequired: true,
              priority: 20,
              safetyCritical: false,
              matchMode: RequirementMatchMode.CATEGORY,
              acceptedCategoryTags: ["fight-shorts"],
              acceptedShopifyProductIds: [],
              acceptedRelationshipTypes: [],
              minQuantity: 1,
            },
          ],
        }),
      ],
      relationships: [],
    });

    expect(result.map((assessment) => assessment.disciplineTag).sort()).toEqual(["bjj", "boxing"]);
  });

  it("returns no assessment when cart evidence is too weak for the available kit", async () => {
    const result = await detectKitCompleteness({
      shop: "test.myshopify.com",
      items: [makeCartItem({ disciplineTags: [], categoryTags: ["accessory"] })],
      kitDefinitions: [makeKit()],
      relationships: [],
    });

    expect(result).toEqual([]);
  });

  it("records substitute matches when an accepted alternative satisfies a requirement", async () => {
    const relationships: RelationshipSupportEdge[] = [
      {
        sourceProductId: "prod-wraps-alt",
        targetProductId: "internal-wraps-target",
        relationshipType: RelationshipType.ALTERNATIVES,
        strength: 0.86,
      },
    ];

    const result = await detectKitCompleteness({
      shop: "test.myshopify.com",
      items: [
        makeCartItem(),
        makeCartItem({
          productId: "prod-wraps-alt",
          shopifyProductId: "gid://shopify/Product/2",
          title: "Quick Wraps",
          categoryTags: ["quick-wraps"],
        }),
      ],
      kitDefinitions: [
        makeKit({
          requirements: [
            makeKit().requirements[0],
            {
              ...makeKit().requirements[1],
              matchMode: RequirementMatchMode.PRODUCT_OR_ALTERNATIVE,
              acceptedCategoryTags: [],
              acceptedShopifyProductIds: ["gid://shopify/Product/99"],
            },
            makeKit().requirements[2],
          ],
        }),
      ],
      relationships,
      acceptedInternalProductIdsByShopifyId: {
        "gid://shopify/Product/99": ["internal-wraps-target"],
      },
    });

    expect(result[0].matchedRequirements.find((requirement) => requirement.requirementKey === "hand-wraps")?.reasons.some((reason) => reason.reasonType === "substitute_match")).toBe(true);
  });

  it("suppresses complete kits so no missing-item prompt is produced", async () => {
    const result = await detectKitCompleteness({
      shop: "test.myshopify.com",
      items: [
        makeCartItem({ productId: "prod-1", categoryTags: ["gloves"] }),
        makeCartItem({
          productId: "prod-2",
          shopifyProductId: "gid://shopify/Product/2",
          title: "Hand Wraps",
          categoryTags: ["hand-wraps"],
        }),
        makeCartItem({
          productId: "prod-3",
          shopifyProductId: "gid://shopify/Product/3",
          title: "Gear Bag",
          categoryTags: ["gear-bag"],
        }),
      ],
      kitDefinitions: [makeKit({ requirements: makeKit().requirements.slice(0, 2) })],
      relationships: [],
    });

    expect(result).toEqual([]);
  });

  it("orders missing requirements with required items ahead of optional items, then by priority", async () => {
    const result = await detectKitCompleteness({
      shop: "test.myshopify.com",
      items: [makeCartItem()],
      kitDefinitions: [
        makeKit({
          requirements: [
            makeKit().requirements[0],
            makeKit().requirements[1],
            {
              id: "req-4",
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
              id: "req-5",
              requirementKey: "ankle-support",
              label: "Ankle Support",
              isRequired: false,
              priority: 15,
              safetyCritical: false,
              matchMode: RequirementMatchMode.CATEGORY,
              acceptedCategoryTags: ["ankle-support"],
              acceptedShopifyProductIds: [],
              acceptedRelationshipTypes: [],
              minQuantity: 1,
            },
            makeKit().requirements[2],
          ],
        }),
      ],
      relationships: [],
    });

    expect(result[0].missingRequirements.map((requirement) => requirement.requirementKey)).toEqual([
      "hand-wraps",
      "mouthguard",
      "ankle-support",
      "gear-bag",
    ]);
  });
});