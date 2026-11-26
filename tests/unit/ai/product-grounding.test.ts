import { describe, expect, it } from "vitest";

import { buildUngroundedProductFallback, findUngroundedProductMentions } from "../../../app/lib/ai/product-grounding";

const KNOWN_TITLES = [
  "Rashguard À Manches Longues pour Hommes Venum Tempest - Noir/Gris",
  "Gants de Boxe Venum Elite - Noir",
];

describe("findUngroundedProductMentions", () => {
  it("flags brand-style product names that are not in the catalog", () => {
    const text = [
      "Je vous recommande :",
      "1. **Short de MMA Venum Tempest - Noir/Gris** - Pour un ensemble coordonné.",
      "2. **Protège-tibias Venum Kontact - Noir/Gris** - Protection.",
    ].join("\n");

    expect(findUngroundedProductMentions(text, KNOWN_TITLES)).toHaveLength(2);
  });

  it("accepts catalog and cart titles, even when shortened or in plain list items", () => {
    const text = [
      "1. **Gants de Boxe Venum Elite** - Idéal pour débuter.",
      "- Gants de Boxe Venum Elite - Noir : 59,90 €",
    ].join("\n");

    expect(findUngroundedProductMentions(text, KNOWN_TITLES)).toEqual([]);
  });

  it("ignores generic advice and discipline headings", () => {
    const text = [
      "1. **Taille Recommandée** - Prenez votre taille habituelle.",
      "- **Muay Thai** - Discipline de combat.",
      "2. Choisissez la bonne taille pour votre morphologie.",
    ].join("\n");

    expect(findUngroundedProductMentions(text, KNOWN_TITLES)).toEqual([]);
  });
});

describe("buildUngroundedProductFallback", () => {
  it("lists only real catalog products with their price", () => {
    const text = buildUngroundedProductFallback({
      lang: "fr",
      currencyCode: "EUR",
      products: [{ title: "Gants de Boxe Venum Elite - Noir", price: 59.9 }],
    });

    expect(text).toContain("- Gants de Boxe Venum Elite - Noir (");
    expect(text).toContain("catalogue");
  });

  it("states honestly that nothing was found when the catalog has no match", () => {
    const text = buildUngroundedProductFallback({ lang: "en", currencyCode: "EUR", products: [] });

    expect(text).toContain("couldn't find a matching product");
  });
});
