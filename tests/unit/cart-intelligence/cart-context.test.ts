import { describe, expect, it } from "vitest";

import { buildCartUnderstandingContext } from "../../../app/lib/cart-intelligence/cart-context";

describe("cart understanding context", () => {
  it("builds an AI-readable context from products, collections, and tags", () => {
    const context = buildCartUnderstandingContext([
      {
        productId: "gid://shopify/Product/1",
        title: "Gants de boxe debutant",
        quantity: 1,
        tags: ["entrainement", "debutant"],
        disciplineTags: ["Boxe"],
        categoryTags: ["gants"],
        collectionIds: ["boxing-starter-kit"],
      },
      {
        productId: "gid://shopify/Product/2",
        title: "Short de boxe",
        quantity: 1,
        tags: ["training"],
        disciplineTags: ["Boxe"],
        categoryTags: ["short"],
        collections: [{ label: "Kit boxe debutant" }],
      },
      {
        productId: "gid://shopify/Product/3",
        title: "Bandages boxe",
        quantity: 2,
        tags: ["protection"],
        disciplineTags: ["Boxe"],
        categoryTags: ["bandages"],
      },
    ]);

    expect(context.sport).toBe("Boxe");
    expect(context.level).toBe("Debutant");
    expect(context.objective).toBe("Entrainement");
    expect(context.products).toEqual([
      expect.objectContaining({ title: "Gants de boxe debutant", quantity: 1 }),
      expect.objectContaining({ title: "Short de boxe", quantity: 1 }),
      expect.objectContaining({ title: "Bandages boxe", quantity: 2 }),
    ]);
    expect(context.collections).toEqual(["boxing-starter-kit", "Kit boxe debutant"]);
    expect(context.tags).toEqual(["debutant", "entrainement", "protection", "training"]);
    expect(context.aiSummary).toContain("Sport : Boxe");
    expect(context.aiSummary).toContain("Niveau : Debutant");
    expect(context.aiSummary).toContain("Objectif : Entrainement");
  });

  it("returns explicit unknown values for an empty or unsupported cart", () => {
    const context = buildCartUnderstandingContext([]);

    expect(context.sport).toBe("A preciser");
    expect(context.level).toBe("A preciser");
    expect(context.objective).toBe("A preciser");
    expect(context.aiSummary).toContain("panier vide");
  });
});