import { describe, expect, it, vi } from "vitest";

vi.mock("../../../app/db.server", () => ({
  default: { product: { findFirst: vi.fn() } },
}));

import db from "../../../app/db.server";
import {
  analyzeApparelSizes,
  buildSizeConsistencyAnswer,
  extractMeasurementsFromText,
  extractShopperMeasurements,
  providesShopperMeasurements,
} from "../../../app/lib/ai/size-consistency";
import { resolveCartToolActionProposal } from "../../../app/lib/ai/tools";
import { makeStorefrontChatRequest } from "../../helpers/storefront-chat-fixtures";

const CART = [
  { productTitle: "T-shirt Dry-Tech pour Hommes Venum Tempest - Noir/Gris", variantTitle: "L" },
  { productTitle: "Short D'entraînement pour Hommes Venum Tempest - Beige/Sable", variantTitle: "XS" },
  { productTitle: "Gants de Boxe Venum", variantTitle: "12 oz / Noir" },
];

describe("shopper measurement parsing", () => {
  it.each([
    ["ma taille est 2m", { heightCm: 200 }],
    ["je mesure 1m80 et 75kg", { heightCm: 180, weightKg: 75 }],
    ["1,85 m", { heightCm: 185 }],
    ["I am 172 cm, 68 kg", { heightCm: 172, weightKg: 68 }],
    ["taille 178", { heightCm: 178 }],
  ])("extracts %s", (text, expected) => {
    expect(extractMeasurementsFromText(text)).toEqual(expected);
  });

  it("does not mistake unrelated text for measurements", () => {
    expect(providesShopperMeasurements("3 mois de garantie ?")).toBe(false);
    expect(providesShopperMeasurements("Vérifie la cohérence de mes tailles")).toBe(false);
  });

  it("keeps the latest mention across the conversation", () => {
    const measurements = extractShopperMeasurements([
      { role: "user", content: "je fais 1m70" },
      { role: "assistant", content: "ok" },
      { role: "user", content: "en fait 1m75, 70kg" },
    ]);
    expect(measurements).toEqual({ heightCm: 175, weightKg: 70 });
  });
});

describe("apparel size consistency", () => {
  it("flags a large top/bottom spread without needing measurements", () => {
    const analysis = analyzeApparelSizes(CART, {});

    expect(analysis?.lines).toHaveLength(2);
    expect(analysis?.spread).toBe(3);
    expect(analysis?.issueCount).toBe(1);
    expect(buildSizeConsistencyAnswer(analysis!, "fr")).toContain("3 tailles d'écart");
  });

  it("evaluates every apparel line against a 2 m shopper", () => {
    const analysis = analyzeApparelSizes(CART, { heightCm: 200 });

    expect(analysis?.recommendedSize).toBe("3XL");
    expect(analysis?.lines.map((line) => line.fit)).toEqual(["too_small", "too_small"]);
    const answer = buildSizeConsistencyAnswer(analysis!, "fr");
    expect(answer).toContain("L)");
    expect(answer).toContain("XS)");
    expect(answer).toContain("trop petit");
  });

  it("confirms consistent sizes that match the shopper", () => {
    const analysis = analyzeApparelSizes(
      [{ productTitle: "T-shirt Venum", variantTitle: "L" }, { productTitle: "Short Venum", variantTitle: "L" }],
      { heightCm: 178, weightKg: 80 },
    );

    expect(analysis?.issueCount).toBe(0);
    expect(buildSizeConsistencyAnswer(analysis!, "en")).toContain("look consistent");
  });

  it("ignores non-apparel lines such as gloves", () => {
    expect(analyzeApparelSizes([CART[2]!], {})).toBeNull();
  });

  it("keeps per-item detail out of the text when the size block is shown", () => {
    const analysis = analyzeApparelSizes(CART, { heightCm: 190 })!;

    const withBlock = buildSizeConsistencyAnswer(analysis, "fr", { detailsInBlock: true });
    expect(withBlock).toContain("2 articles");
    expect(withBlock).not.toContain("trop petit");
    expect(withBlock).not.toContain("un peu juste");

    const withoutBlock = buildSizeConsistencyAnswer(analysis, "fr", { detailsInBlock: false });
    expect(withoutBlock).toContain("trop petit");
    expect(withoutBlock).toContain("un peu juste");
  });

  it("suggests change commands the cart tool can turn into swap proposals", async () => {
    const answer = buildSizeConsistencyAnswer(analyzeApparelSizes(CART, { heightCm: 190 })!, "fr", { detailsInBlock: true });
    expect(answer).toContain("« passe le t-shirt en XL »");
    expect(answer).toContain("« passe le short en XL »");
    expect(answer).not.toContain("Je peux vous proposer");

    process.env.STOREFRONT_CHAT_SIGNING_SECRET = "test-signing-secret";
    vi.mocked(db.product.findFirst).mockResolvedValueOnce({
      variants: [
        { shopifyVariantId: "gid://shopify/ProductVariant/721", title: "XS", inventoryQuantity: 5 },
        { shopifyVariantId: "gid://shopify/ProductVariant/725", title: "XL", inventoryQuantity: 9 },
      ],
    } as never);
    const resolution = await resolveCartToolActionProposal(makeStorefrontChatRequest({
      cart: {
        cartId: "gid://shopify/Cart/123",
        currencyCode: "EUR",
        items: [
          { lineId: "line-shirt", productId: "gid://shopify/Product/71", productTitle: CART[0]!.productTitle, variantId: "gid://shopify/ProductVariant/711", variantTitle: "L", quantity: 3 },
          { lineId: "line-short", productId: "gid://shopify/Product/72", productTitle: CART[1]!.productTitle, variantId: "gid://shopify/ProductVariant/721", variantTitle: "XS", quantity: 5 },
        ],
      },
      messages: [{ role: "user", content: "passe le short en XL" }],
    }));

    expect(resolution).toMatchObject({
      status: "proposed",
      action: { toolName: "swapVariant", payload: { lineId: "line-short", newMerchandiseId: "gid://shopify/ProductVariant/725", quantity: 5 } },
    });
  });
});
