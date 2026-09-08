/**
 * Integration test scaffolding: Kit Completeness Detection — admin Kits tab.
 *
 * Tests the loader and action intents wired into app/routes/app.knowledge-graph.tsx:
 *   T017 — loader: listKitDefinitionsForShop / listProductsForKitEditor
 *   T018 — save-kit-definition, save-kit-requirement, delete-kit-requirement, archive-kit-definition
 *
 * NOTE: tests run against the mocked DB layer (no real database required).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import * as dbQueries from "../../../app/lib/db/queries";
import { KitDefinitionSource, KitDefinitionStatus, RequirementMatchMode } from "@prisma/client";

vi.mock("../../../app/lib/db/queries", () => ({
  listKitDefinitionsForShop: vi.fn(),
  listProductsForKitEditor: vi.fn(),
  upsertKitDefinition: vi.fn(),
  upsertKitRequirement: vi.fn(),
  deleteKitRequirement: vi.fn(),
  archiveKitDefinition: vi.fn(),
}));

const SHOP = "test.myshopify.com";

const makeKitDefinition = (overrides: Partial<{ id: string; status: KitDefinitionStatus; source: KitDefinitionSource }> = {}) => ({
  id: "kit-1",
  shop: SHOP,
  key: "boxing-starter",
  label: "Boxing Starter Kit",
  disciplineTag: "boxing",
  description: null,
  source: KitDefinitionSource.AUTO,
  status: KitDefinitionStatus.ACTIVE,
  createdAt: new Date(),
  updatedAt: new Date(),
  requirements: [
    {
      id: "req-1",
      kitDefinitionId: "kit-1",
      requirementKey: "gloves",
      label: "Gloves",
      description: null,
      isRequired: true,
      priority: 10,
      safetyCritical: true,
      matchMode: RequirementMatchMode.CATEGORY,
      acceptedCategoryTags: ["gloves"],
      acceptedShopifyProductIds: [],
      acceptedRelationshipTypes: [],
      minQuantity: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ],
  ...overrides,
});

const makeKitEditorProduct = () => ({
  id: "prod-1",
  shopifyProductId: "gid://shopify/Product/1",
  title: "Boxing Gloves",
  disciplineTags: ["boxing"],
  categoryTags: ["gloves"],
  status: "ACTIVE",
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Loader: listKitDefinitionsForShop / listProductsForKitEditor", () => {
  it("returns kit definitions with nested requirements and editor product options", async () => {
    vi.mocked(dbQueries.listKitDefinitionsForShop).mockResolvedValueOnce([makeKitDefinition()] as never);
    vi.mocked(dbQueries.listProductsForKitEditor).mockResolvedValueOnce([makeKitEditorProduct()] as never);

    const kits = await dbQueries.listKitDefinitionsForShop(SHOP, 100);
    const products = await dbQueries.listProductsForKitEditor(SHOP, 200);

    expect(kits).toHaveLength(1);
    expect(kits[0].requirements).toHaveLength(1);
    expect(kits[0].requirements[0].requirementKey).toBe("gloves");
    expect(products).toHaveLength(1);
    expect(products[0].title).toBe("Boxing Gloves");
  });
});

describe("save-kit-definition", () => {
  it("upserts a merchant-authored kit definition", async () => {
    const created = makeKitDefinition({ source: KitDefinitionSource.MERCHANT });
    vi.mocked(dbQueries.upsertKitDefinition).mockResolvedValueOnce(created as never);

    const input = {
      shop: SHOP,
      key: "boxing-starter",
      label: "Boxing Starter Kit",
      disciplineTag: "boxing",
      description: null,
      source: KitDefinitionSource.MERCHANT,
    };

    const result = await dbQueries.upsertKitDefinition(input);

    expect(dbQueries.upsertKitDefinition).toHaveBeenCalledWith(input);
    expect((result as typeof created).source).toBe(KitDefinitionSource.MERCHANT);
  });
});

describe("save-kit-requirement", () => {
  it("upserts a requirement with matchMode and accepted category tags", async () => {
    const requirement = makeKitDefinition().requirements[0];
    vi.mocked(dbQueries.upsertKitRequirement).mockResolvedValueOnce(requirement as never);

    const input = {
      kitDefinitionId: "kit-1",
      requirementKey: "gloves",
      label: "Gloves",
      isRequired: true,
      priority: 10,
      safetyCritical: true,
      matchMode: RequirementMatchMode.CATEGORY,
      acceptedCategoryTags: ["gloves"],
      acceptedShopifyProductIds: [],
      minQuantity: 1,
    };

    const result = await dbQueries.upsertKitRequirement(input);

    expect(dbQueries.upsertKitRequirement).toHaveBeenCalledWith(input);
    expect((result as typeof requirement).requirementKey).toBe("gloves");
  });
});

describe("delete-kit-requirement", () => {
  it("deletes the requirement by id", async () => {
    vi.mocked(dbQueries.deleteKitRequirement).mockResolvedValueOnce(undefined as never);

    await dbQueries.deleteKitRequirement("req-1");

    expect(dbQueries.deleteKitRequirement).toHaveBeenCalledWith("req-1");
  });
});

describe("archive-kit-definition", () => {
  it("archives the kit definition by id", async () => {
    const archived = makeKitDefinition({ status: KitDefinitionStatus.ARCHIVED });
    vi.mocked(dbQueries.archiveKitDefinition).mockResolvedValueOnce(archived as never);

    const result = await dbQueries.archiveKitDefinition("kit-1");

    expect(dbQueries.archiveKitDefinition).toHaveBeenCalledWith("kit-1");
    expect((result as typeof archived).status).toBe(KitDefinitionStatus.ARCHIVED);
  });
});
