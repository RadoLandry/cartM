import { beforeEach, describe, expect, it, vi } from "vitest";

import { makeStorefrontChatRequest } from "../../helpers/storefront-chat-fixtures";

// ── Module mocks ───────────────────────────────────────────────────────────

vi.mock("../../../app/db.server", () => ({
  default: {
    product: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock("../../../app/lib/db/queries", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../app/lib/db/queries")>();
  return {
    ...actual,
    getActiveRelationshipsForProduct: vi.fn(),
    getSessionCustomerProfile: vi.fn().mockResolvedValue(null),
    listActiveKitDefinitions: vi.fn().mockResolvedValue([]),
    listActiveReplenishmentLifecycleRules: vi.fn().mockResolvedValue([]),
    listCustomerPurchaseSnapshots: vi.fn().mockResolvedValue([]),
  };
});

// ── Imports after mocks ────────────────────────────────────────────────────

import { buildStorefrontChatReply, rememberCatalogActionCandidates, resolveCompatibleAddActionProposal, resolveCompatibleAddActionProposals } from "../../../app/lib/ai/storefront-chat";
import db from "../../../app/db.server";
import { getActiveRelationshipsForProduct } from "../../../app/lib/db/queries";

// ── Helpers ────────────────────────────────────────────────────────────────

function makeShortInCart() {
  return {
    lineId: "line-short",
    productId: "gid://shopify/Product/20",
    productTitle: "Fightshort Venum Gladiator 3.0 - Noir/Blanc",
    variantId: "gid://shopify/ProductVariant/201",
    variantTitle: "M / Black",
    quantity: 1,
  };
}

const BOXING_GLOVES_PRODUCT = {
  id: "internal-gloves-id",
  shopifyProductId: "gid://shopify/Product/99",
  title: "Gants de boxe Venum Elite",
  handle: "gants-de-boxe-venum-elite",
  tags: ["boxing", "gloves", "gants", "box", "combat"],
  disciplineTags: ["boxing"],
  categoryTags: ["gloves"],
  variants: [
    {
      id: "internal-variant-gloves",
      shopifyVariantId: "gid://shopify/ProductVariant/991",
      title: "12 oz / Black",
      inventoryQuantity: 5,
      imageUrl: "https://cdn.example.com/gloves-black.jpg",
    },
  ],
};

const HAND_WRAPS_PRODUCT = {
  id: "internal-wraps-id",
  shopifyProductId: "gid://shopify/Product/88",
  title: "Bandages de boxe Venum Kontact",
  handle: "bandages-de-boxe-venum-kontact",
  tags: ["boxing", "wraps", "bandages", "protection", "gants"],
  disciplineTags: ["boxing"],
  categoryTags: ["wraps", "protection"],
  variants: [
    {
      id: "internal-variant-wraps",
      shopifyVariantId: "gid://shopify/ProductVariant/881",
      title: "4 m / Black",
      inventoryQuantity: 8,
      price: 12.99 as unknown as import("@prisma/client").Prisma.Decimal,
      imageUrl: "https://cdn.example.com/wraps-black.jpg",
    },
  ],
};

const KHAKI_HAND_WRAPS_PRODUCT = {
  id: "internal-khaki-wraps-id",
  shopifyProductId: "gid://shopify/Product/188",
  title: "Bandes de Boxe Venum Kontact Evo Classic - Khaki",
  handle: "bandes-de-boxe-venum-kontact-evo-classic-khaki",
  tags: ["boxe", "bandes", "protection", "gants"],
  disciplineTags: ["boxing"],
  categoryTags: ["bandes", "protection"],
  variants: [
    {
      id: "internal-variant-khaki-wraps",
      shopifyVariantId: "gid://shopify/ProductVariant/1881",
      title: "4 m / Khaki",
      inventoryQuantity: 8,
      price: 12.99 as unknown as import("@prisma/client").Prisma.Decimal,
      imageUrl: "https://cdn.example.com/wraps-khaki.jpg",
    },
  ],
};

const OUT_OF_STOCK_HAND_WRAPS_PRODUCT = {
  ...HAND_WRAPS_PRODUCT,
  variants: HAND_WRAPS_PRODUCT.variants.map((variant) => ({
    ...variant,
    inventoryQuantity: 0,
  })),
};

const DUPLICATE_GLOVES_PRODUCT = {
  ...BOXING_GLOVES_PRODUCT,
  id: "internal-duplicate-gloves-id",
  shopifyProductId: "gid://shopify/Product/199",
  title: "Gants de Boxe Venum Impact Evo Scales - Vert Armee",
  handle: "gants-de-boxe-venum-impact-evo-scales-vert-armee-duplicate",
  variants: [
    {
      id: "internal-variant-duplicate-gloves",
      shopifyVariantId: "gid://shopify/ProductVariant/1991",
      title: "8 oz / Vert Armee",
      inventoryQuantity: 5,
      imageUrl: "https://cdn.example.com/duplicate-gloves.jpg",
    },
  ],
};

const DRY_TECH_TSHIRT_PRODUCT = {
  id: "internal-shirt-id",
  shopifyProductId: "gid://shopify/Product/77",
  title: "T-shirt Dry-Tech pour Hommes Venum Tempest - Noir/Gris",
  handle: "t-shirt-dry-tech-venum-tempest-noir-gris",
  tags: ["t-shirt", "dry-tech", "apparel", "mma"],
  disciplineTags: ["mma"],
  categoryTags: ["tops", "t-shirt", "apparel"],
  variants: [
    {
      id: "internal-variant-shirt",
      shopifyVariantId: "gid://shopify/ProductVariant/771",
      title: "M / Noir-Gris",
      inventoryQuantity: 6,
      imageUrl: "https://cdn.example.com/shirt.jpg",
    },
  ],
};

const FIGHT_SHORTS_PRODUCT = {
  id: "internal-fight-shorts-id",
  shopifyProductId: "gid://shopify/Product/66",
  title: "Short de Combat Venum Tempest - Noir/Gris",
  handle: "short-de-combat-venum-tempest-noir-gris",
  tags: ["shorts", "fight-shorts", "apparel", "mma"],
  disciplineTags: ["mma"],
  categoryTags: ["shorts", "fight-shorts", "bottoms"],
  variants: [
    {
      id: "internal-variant-fight-shorts",
      shopifyVariantId: "gid://shopify/ProductVariant/661",
      title: "M / Noir-Gris",
      inventoryQuantity: 9,
      imageUrl: "https://cdn.example.com/fight-shorts.jpg",
    },
  ],
};

const MMA_RASHGUARD_PRODUCT = {
  id: "internal-rashguard-id",
  shopifyProductId: "gid://shopify/Product/55",
  title: "Rashguard Venum Tempest - Noir/Gris",
  handle: "rashguard-venum-tempest-noir-gris",
  tags: ["rashguard", "compression", "apparel", "mma"],
  disciplineTags: ["mma"],
  categoryTags: ["tops", "rashguard", "apparel"],
  variants: [
    {
      id: "internal-variant-rashguard",
      shopifyVariantId: "gid://shopify/ProductVariant/551",
      title: "M / Noir-Gris",
      inventoryQuantity: 9,
      imageUrl: "https://cdn.example.com/rashguard.jpg",
    },
  ],
};

const SHORT_COMPLEMENTS_GLOVES_RELATIONSHIP = {
  id: "rel-1",
  sourceProductId: "internal-short-id",
  targetProductId: "internal-gloves-id",
  relationshipType: "COMPLEMENTS" as const,
  directionality: "BIDIRECTIONAL" as const,
  strength: 0.9,
  origin: "MANUAL" as const,
  status: "ACTIVE" as const,
};

const GLOVES_COMPLEMENTS_WRAPS_RELATIONSHIP = {
  id: "rel-2",
  sourceProductId: "internal-gloves-id",
  targetProductId: "internal-wraps-id",
  relationshipType: "COMPLEMENTS" as const,
  directionality: "BIDIRECTIONAL" as const,
  strength: 0.95,
  origin: "MANUAL" as const,
  status: "ACTIVE" as const,
};

const SHORT_COMPLEMENTS_WRAPS_RELATIONSHIP = {
  id: "rel-3",
  sourceProductId: "internal-short-id",
  targetProductId: "internal-wraps-id",
  relationshipType: "COMPLEMENTS" as const,
  directionality: "BIDIRECTIONAL" as const,
  strength: 0.75,
  origin: "MANUAL" as const,
  status: "ACTIVE" as const,
};

// ── Tests ──────────────────────────────────────────────────────────────────

describe("resolveCompatibleAddActionProposal", () => {
  beforeEach(() => {
    process.env.STOREFRONT_CHAT_SIGNING_SECRET = "test-signing-secret";
    vi.clearAllMocks();

    // db.product.findMany for resolveCartLines (the short product lookup)
    vi.mocked(db.product.findMany)
      .mockResolvedValueOnce([
        {
          id: "internal-short-id",
          shopifyProductId: "gid://shopify/Product/20",
          title: "Fightshort Venum Gladiator 3.0 - Noir/Blanc",
          status: "ACTIVE",
          tags: ["mma", "short", "fightshort"],
          disciplineTags: ["mma"],
          categoryTags: ["shorts"],
          variants: [
            {
              id: "internal-short-variant",
              shopifyVariantId: "gid://shopify/ProductVariant/201",
              title: "M / Black",
              sizeValue: "M",
              sizeCategory: "clothing",
              inventoryQuantity: 3,
              price: 49.99 as unknown as import("@prisma/client").Prisma.Decimal,
            },
          ],
        },
      ] as never)
      // Second call: fetch compatible products
      .mockResolvedValueOnce([BOXING_GLOVES_PRODUCT] as never);
  });

  it("proposes addToCart for a compatible product found in the knowledge graph", async () => {
    vi.mocked(getActiveRelationshipsForProduct).mockResolvedValue(
      [SHORT_COMPLEMENTS_GLOVES_RELATIONSHIP] as never,
    );

    const request = makeStorefrontChatRequest({
      cart: {
        cartId: "gid://shopify/Cart/123",
        currencyCode: "EUR",
        items: [makeShortInCart()],
      },
      messages: [{ role: "user", content: "ajoute un gants de box compatible à ce short" }],
    });

    const proposal = await resolveCompatibleAddActionProposal(request);

    expect(proposal).not.toBeNull();
    expect(proposal?.toolName).toBe("addToCart");
    expect(proposal?.payload.actionType).toBe("add");
    if (proposal?.payload.actionType === "add") {
      expect(proposal.payload.merchandiseId).toBe("gid://shopify/ProductVariant/991");
      expect(proposal.payload.quantity).toBe(1);
    }
    expect(proposal?.preview?.after).toContain("Gants de boxe Venum Elite");
    expect(proposal?.preview?.imageUrl).toBe("https://cdn.example.com/gloves-black.jpg");
    expect(proposal?.preview?.productHandle).toBe("gants-de-boxe-venum-elite");
    expect(proposal?.confirmationToken).toBeTruthy();
    expect(proposal?.expiresAt).toBeTruthy();
  });

  it("proposes multiple addToCart actions when several compatible products exist", async () => {
    vi.mocked(getActiveRelationshipsForProduct).mockResolvedValue(
      [SHORT_COMPLEMENTS_GLOVES_RELATIONSHIP, SHORT_COMPLEMENTS_WRAPS_RELATIONSHIP] as never,
    );
    vi.mocked(db.product.findMany)
      .mockReset()
      .mockResolvedValueOnce([
        {
          id: "internal-short-id",
          shopifyProductId: "gid://shopify/Product/20",
          title: "Fightshort Venum Gladiator 3.0 - Noir/Blanc",
          status: "ACTIVE",
          tags: ["mma", "short", "fightshort"],
          disciplineTags: ["mma"],
          categoryTags: ["shorts"],
          variants: [{
            id: "internal-short-variant",
            shopifyVariantId: "gid://shopify/ProductVariant/201",
            title: "M / Black",
            sizeValue: "M",
            sizeCategory: "clothing",
            inventoryQuantity: 3,
            price: 49.99 as never,
          }],
        },
      ] as never)
      .mockResolvedValueOnce([BOXING_GLOVES_PRODUCT, HAND_WRAPS_PRODUCT] as never);

    const request = makeStorefrontChatRequest({
      cart: {
        cartId: "gid://shopify/Cart/123",
        currencyCode: "EUR",
        items: [makeShortInCart()],
      },
      messages: [{ role: "user", content: "help me to find article compatible with this short" }],
    });

    const proposals = await resolveCompatibleAddActionProposals(request);

    expect(proposals).toHaveLength(2);
    expect(proposals.map((proposal) => proposal.toolName)).toEqual(["addToCart", "addToCart"]);
    expect(proposals.map((proposal) => proposal.preview?.after)).toEqual([
      expect.stringContaining("Gants de boxe Venum Elite"),
      expect.stringContaining("Bandages de boxe Venum Kontact"),
    ]);
    expect(proposals.map((proposal) => proposal.preview?.imageUrl)).toEqual([
      "https://cdn.example.com/gloves-black.jpg",
      "https://cdn.example.com/wraps-black.jpg",
    ]);
  });

  it("does not propose compatible products when all matching variants are out of stock", async () => {
    vi.mocked(getActiveRelationshipsForProduct).mockResolvedValue(
      [SHORT_COMPLEMENTS_GLOVES_RELATIONSHIP, SHORT_COMPLEMENTS_WRAPS_RELATIONSHIP] as never,
    );
    vi.mocked(db.product.findMany)
      .mockReset()
      .mockResolvedValueOnce([
        {
          id: "internal-short-id",
          shopifyProductId: "gid://shopify/Product/20",
          title: "Fightshort Venum Gladiator 3.0 - Noir/Blanc",
          status: "ACTIVE",
          tags: ["mma", "short", "fightshort"],
          disciplineTags: ["mma"],
          categoryTags: ["shorts"],
          variants: [{
            id: "internal-short-variant",
            shopifyVariantId: "gid://shopify/ProductVariant/201",
            title: "M / Black",
            sizeValue: "M",
            sizeCategory: "clothing",
            inventoryQuantity: 3,
            price: 49.99 as never,
          }],
        },
      ] as never)
      .mockResolvedValueOnce([BOXING_GLOVES_PRODUCT, OUT_OF_STOCK_HAND_WRAPS_PRODUCT] as never);

    const request = makeStorefrontChatRequest({
      cart: {
        cartId: "gid://shopify/Cart/123",
        currencyCode: "EUR",
        items: [makeShortInCart()],
      },
      messages: [{ role: "user", content: "help me to find article compatible with this short" }],
    });

    const proposals = await resolveCompatibleAddActionProposals(request);

    expect(proposals).toHaveLength(1);
    expect(proposals[0]?.preview?.after).toContain("Gants de boxe Venum Elite");
    expect(proposals[0]?.preview?.after).not.toContain("Bandages de boxe Venum Kontact");
  });

  it("proposes the strongest complement for generic compatible article discovery", async () => {
    vi.mocked(getActiveRelationshipsForProduct).mockResolvedValue(
      [GLOVES_COMPLEMENTS_WRAPS_RELATIONSHIP] as never,
    );
    vi.mocked(db.product.findMany)
      .mockReset()
      .mockResolvedValueOnce([BOXING_GLOVES_PRODUCT] as never)
      .mockResolvedValueOnce([HAND_WRAPS_PRODUCT] as never);

    const request = makeStorefrontChatRequest({
      cart: {
        cartId: "gid://shopify/Cart/123",
        currencyCode: "EUR",
        items: [
          {
            lineId: "line-gloves",
            productId: "gid://shopify/Product/99",
            productTitle: "Gants de Boxe Venum Impact Evo Scales - Vert Armee",
            variantId: "gid://shopify/ProductVariant/991",
            variantTitle: "12 oz / Vert Armee",
            quantity: 1,
          },
        ],
      },
      messages: [{ role: "user", content: "help me to find article compatible with this gants" }],
    });

    const proposal = await resolveCompatibleAddActionProposal(request);

    expect(proposal).not.toBeNull();
    expect(proposal?.toolName).toBe("addToCart");
    if (proposal?.payload.actionType === "add") {
      expect(proposal.payload.merchandiseId).toBe("gid://shopify/ProductVariant/881");
    }
    expect(proposal?.preview?.after).toContain("Bandages de boxe Venum Kontact");
    expect(proposal?.preview?.imageUrl).toBe("https://cdn.example.com/wraps-black.jpg");
    expect(proposal?.preview?.productHandle).toBe("bandages-de-boxe-venum-kontact");
  });

  it("proposes addToCart from catalog search for generic compatible discovery without graph relationships", async () => {
    vi.mocked(getActiveRelationshipsForProduct).mockResolvedValue([]);
    vi.mocked(db.product.findMany)
      .mockReset()
      .mockResolvedValueOnce([BOXING_GLOVES_PRODUCT] as never)
      .mockResolvedValueOnce([HAND_WRAPS_PRODUCT] as never);

    const request = makeStorefrontChatRequest({
      cart: {
        cartId: "gid://shopify/Cart/123",
        currencyCode: "EUR",
        items: [
          {
            lineId: "line-gloves",
            productId: "gid://shopify/Product/99",
            productTitle: "Gants de Boxe Venum Impact Evo Scales - Vert Armee",
            variantId: "gid://shopify/ProductVariant/991",
            variantTitle: "12 oz / Vert Armee",
            quantity: 1,
          },
        ],
      },
      messages: [{ role: "user", content: "help me to find article compatible with this gants" }],
    });

    const proposal = await resolveCompatibleAddActionProposal(request);

    expect(proposal).not.toBeNull();
    expect(proposal?.toolName).toBe("addToCart");
    if (proposal?.payload.actionType === "add") {
      expect(proposal.payload.merchandiseId).toBe("gid://shopify/ProductVariant/881");
    }
    expect(proposal?.preview?.after).toContain("Bandages de boxe Venum Kontact");
    expect(proposal?.preview?.imageUrl).toBe("https://cdn.example.com/wraps-black.jpg");
    expect(proposal?.preview?.productHandle).toBe("bandages-de-boxe-venum-kontact");
  });

  it("proposes a product card for French works-well cart questions", async () => {
    vi.mocked(getActiveRelationshipsForProduct).mockResolvedValue([]);
    vi.mocked(db.product.findMany)
      .mockReset()
      .mockResolvedValueOnce([
        {
          ...BOXING_GLOVES_PRODUCT,
          status: "ACTIVE",
          variants: BOXING_GLOVES_PRODUCT.variants.map((variant) => ({
            ...variant,
            sizeValue: "8 oz",
            sizeCategory: "gloves",
            price: null,
          })),
        },
      ] as never)
      .mockResolvedValueOnce([KHAKI_HAND_WRAPS_PRODUCT] as never);

    const request = makeStorefrontChatRequest({
      cart: {
        cartId: "gid://shopify/Cart/123",
        currencyCode: "EUR",
        items: [
          {
            lineId: "line-gloves",
            productId: "gid://shopify/Product/99",
            productTitle: "Gants de Boxe Venum Impact Evo Scales - Vert Armee",
            variantId: "gid://shopify/ProductVariant/991",
            variantTitle: "8 oz / Vert Armee",
            quantity: 1,
          },
        ],
      },
      messages: [{ role: "user", content: "Qu'est-ce qui s'accorde bien avec les articles déjà présents dans votre panier ?" }],
    });

    const proposal = await resolveCompatibleAddActionProposal(request);

    expect(proposal).not.toBeNull();
    expect(proposal?.toolName).toBe("addToCart");
    if (proposal?.payload.actionType === "add") {
      expect(proposal.payload.merchandiseId).toBe("gid://shopify/ProductVariant/1881");
    }
    expect(proposal?.preview?.after).toContain("Bandes de Boxe Venum Kontact Evo Classic - Khaki");
    expect(proposal?.preview?.imageUrl).toBe("https://cdn.example.com/wraps-khaki.jpg");
    expect(proposal?.preview?.productHandle).toBe("bandes-de-boxe-venum-kontact-evo-classic-khaki");
  });

  it("does not recommend the same cart product when catalog search returns a duplicate title", async () => {
    vi.mocked(getActiveRelationshipsForProduct).mockResolvedValue([]);
    vi.mocked(db.product.findMany)
      .mockReset()
      .mockResolvedValueOnce([
        {
          ...BOXING_GLOVES_PRODUCT,
          status: "ACTIVE",
          variants: BOXING_GLOVES_PRODUCT.variants.map((variant) => ({
            ...variant,
            sizeValue: "8 oz",
            sizeCategory: "gloves",
            price: null,
          })),
        },
      ] as never)
      .mockResolvedValueOnce([DUPLICATE_GLOVES_PRODUCT, KHAKI_HAND_WRAPS_PRODUCT] as never);

    const request = makeStorefrontChatRequest({
      cart: {
        cartId: "gid://shopify/Cart/123",
        currencyCode: "EUR",
        items: [
          {
            lineId: "line-gloves",
            productId: "gid://shopify/Product/99",
            productTitle: "Gants de Boxe Venum Impact Evo Scales - Vert Armee",
            variantId: "gid://shopify/ProductVariant/991",
            variantTitle: "8 oz / Vert Armee",
            quantity: 1,
          },
        ],
      },
      messages: [{ role: "user", content: "Qu'est-ce qui s'accorde bien avec les articles déjà présents dans le panier ?" }],
    });

    const proposals = await resolveCompatibleAddActionProposals(request);

    expect(proposals).toHaveLength(1);
    expect(proposals[0]?.preview?.after).toContain("Bandes de Boxe Venum Kontact Evo Classic - Khaki");
    expect(proposals[0]?.preview?.after).not.toContain("Gants de Boxe Venum Impact Evo Scales");
  });

  it("uses all cart products for generic compatible discovery when the text reference does not match", async () => {
    vi.mocked(getActiveRelationshipsForProduct).mockResolvedValue([]);
    vi.mocked(db.product.findMany)
      .mockReset()
      .mockResolvedValueOnce([DRY_TECH_TSHIRT_PRODUCT] as never)
      .mockResolvedValueOnce([FIGHT_SHORTS_PRODUCT] as never);

    const request = makeStorefrontChatRequest({
      cart: {
        cartId: "gid://shopify/Cart/123",
        currencyCode: "EUR",
        items: [
          {
            lineId: "line-shirt",
            productId: "gid://shopify/Product/77",
            productTitle: "T-shirt Dry-Tech pour Hommes Venum Tempest - Noir/Gris",
            variantId: "gid://shopify/ProductVariant/771",
            variantTitle: "M / Noir-Gris",
            quantity: 1,
          },
        ],
      },
      messages: [{ role: "user", content: "help me to find article compatible with this gants" }],
    });

    const proposal = await resolveCompatibleAddActionProposal(request);

    expect(proposal).not.toBeNull();
    expect(proposal?.toolName).toBe("addToCart");
    if (proposal?.payload.actionType === "add") {
      expect(proposal.payload.merchandiseId).toBe("gid://shopify/ProductVariant/661");
    }
    expect(proposal?.preview?.after).toContain("Short de Combat Venum Tempest");
    expect(proposal?.preview?.imageUrl).toBe("https://cdn.example.com/fight-shorts.jpg");
  });

  it("shows the product recommended in the previous assistant turn", async () => {
    vi.mocked(getActiveRelationshipsForProduct).mockResolvedValue([]);
    vi.mocked(db.product.findMany)
      .mockReset()
      .mockResolvedValueOnce([FIGHT_SHORTS_PRODUCT] as never);

    const request = makeStorefrontChatRequest({
      cart: {
        cartId: "gid://shopify/Cart/123",
        currencyCode: "EUR",
        items: [
          {
            lineId: "line-gloves",
            productId: "gid://shopify/Product/99",
            productTitle: "Gants de Boxe Venum Impact Evo Scales - Vert Armee",
            variantId: "gid://shopify/ProductVariant/991",
            variantTitle: "12 oz / Vert Armee",
            quantity: 1,
          },
        ],
      },
      messages: [
        { role: "user", content: "donne moi des shorts qui correspond à ce gants" },
        { role: "assistant", content: "Pour accompagner vos gants, je vous recommande les Short de Combat Venum Tempest - Noir/Gris." },
        { role: "user", content: "affiche le moi" },
      ],
    });

    const proposal = await resolveCompatibleAddActionProposal(request);

    expect(proposal).not.toBeNull();
    expect(proposal?.toolName).toBe("addToCart");
    if (proposal?.payload.actionType === "add") {
      expect(proposal.payload.merchandiseId).toBe("gid://shopify/ProductVariant/661");
    }
    expect(proposal?.preview?.after).toContain("Short de Combat Venum Tempest");
    expect(proposal?.preview?.imageUrl).toBe("https://cdn.example.com/fight-shorts.jpg");
    expect(proposal?.preview?.productHandle).toBe("short-de-combat-venum-tempest-noir-gris");
  });

  it("resolves previous LLM recommendations through remembered catalog product refs before title fallback", async () => {
    vi.mocked(getActiveRelationshipsForProduct).mockResolvedValue([]);
    vi.mocked(db.product.findMany).mockReset();

    const request = makeStorefrontChatRequest({
      cart: {
        cartId: "gid://shopify/Cart/123",
        currencyCode: "EUR",
        items: [
          {
            lineId: "line-gloves",
            productId: "gid://shopify/Product/99",
            productTitle: "Gants de Boxe Venum Impact Evo Scales - Vert Armee",
            variantId: "gid://shopify/ProductVariant/991",
            variantTitle: "12 oz / Vert Armee",
            quantity: 1,
          },
        ],
      },
      messages: [
        { role: "user", content: "donne moi des shorts qui correspond à ce gants" },
        { role: "assistant", content: "Pour accompagner vos gants, je vous recommande les Shorts de Boxe Venum Impact - Vert Armée." },
        { role: "user", content: "affiche le moi" },
      ],
    });

    rememberCatalogActionCandidates({
      shop: request.shop,
      sessionKey: request.sessionKey,
      candidates: [{
        shopifyProductId: "gid://shopify/Product/166",
        title: "Short de Boxe Venum Impact - Vert Armee",
        variantId: "gid://shopify/ProductVariant/1661",
        variantTitle: "M / Vert Armee",
        imageUrl: "https://cdn.example.com/impact-shorts-green.jpg",
        productHandle: "short-de-boxe-venum-impact-vert-armee",
      }],
    });

    const proposal = await resolveCompatibleAddActionProposal(request);

    expect(proposal).not.toBeNull();
    if (proposal?.payload.actionType === "add") {
      expect(proposal.payload.merchandiseId).toBe("gid://shopify/ProductVariant/1661");
    }
    expect(proposal?.preview?.after).toContain("Short de Boxe Venum Impact - Vert Armee");
    expect(proposal?.preview?.imageUrl).toBe("https://cdn.example.com/impact-shorts-green.jpg");
    expect(vi.mocked(db.product.findMany)).not.toHaveBeenCalled();
  });

  it("builds catalog recommendations for non-protection cart products", async () => {
    vi.mocked(getActiveRelationshipsForProduct).mockResolvedValue([]);
    vi.mocked(db.product.findMany)
      .mockReset()
      .mockResolvedValueOnce([DRY_TECH_TSHIRT_PRODUCT] as never)
      .mockResolvedValueOnce([FIGHT_SHORTS_PRODUCT] as never);

    const request = makeStorefrontChatRequest({
      cart: {
        cartId: "gid://shopify/Cart/123",
        currencyCode: "EUR",
        items: [
          {
            lineId: "line-shirt",
            productId: "gid://shopify/Product/77",
            productTitle: "T-shirt Dry-Tech pour Hommes Venum Tempest - Noir/Gris",
            variantId: "gid://shopify/ProductVariant/771",
            variantTitle: "M / Noir-Gris",
            quantity: 1,
          },
        ],
      },
      messages: [{ role: "user", content: "what works well with this product?" }],
    });

    const reply = await buildStorefrontChatReply(request);
    const recommendationBlock = reply.guidanceBlocks.find((block) => block.type === "recommendation_list");

    expect(recommendationBlock?.type).toBe("recommendation_list");
    if (recommendationBlock?.type === "recommendation_list") {
      expect(recommendationBlock.items[0]).toMatchObject({
        action: "add",
        productId: "gid://shopify/Product/66",
        productTitle: "Short de Combat Venum Tempest - Noir/Gris",
      });
      expect(recommendationBlock.items.some((item) => item.productId === "gid://shopify/Product/77" && item.action === "keep")).toBe(false);
    }
  });

  it("lists cart items and quantities for French cart-content questions", async () => {
    const request = makeStorefrontChatRequest({
      cart: {
        cartId: "gid://shopify/Cart/123",
        currencyCode: "EUR",
        items: [
          {
            lineId: "line-gloves",
            productId: "gid://shopify/Product/99",
            productTitle: "Gants de boxe Venum Elite",
            variantId: "gid://shopify/ProductVariant/991",
            variantTitle: "12 oz / Noir",
            quantity: 2,
          },
          {
            lineId: "line-wraps",
            productId: "gid://shopify/Product/88",
            productTitle: "Bandages de boxe Venum Kontact",
            variantId: "gid://shopify/ProductVariant/881",
            variantTitle: "4 m / Noir",
            quantity: 1,
          },
        ],
      },
      messages: [{ role: "user", content: "quelles sont les articles de mon panier et en quelles quantités?" }],
    });

    const reply = await buildStorefrontChatReply(request);

    expect(reply.text).toContain("Gants de boxe Venum Elite (12 oz / Noir) : quantité 2");
    expect(reply.text).toContain("Bandages de boxe Venum Kontact (4 m / Noir) : quantité 1");
    expect(reply.text).not.toContain("recommandations personnalisées");
    expect(reply.text).not.toContain("lacune");
    expect(reply.guidanceBlocks).toHaveLength(0);
  });

  it("does not recommend another bottom as a generic compatible product for pants", async () => {
    vi.mocked(getActiveRelationshipsForProduct).mockResolvedValue([]);
    vi.mocked(db.product.findMany)
      .mockReset()
      .mockResolvedValueOnce([
        {
          id: "internal-pants-id",
          shopifyProductId: "gid://shopify/Product/44",
          title: "Pantalon de compression Venum Tempest - Noir/Gris",
          status: "ACTIVE",
          tags: ["pantalon", "compression", "apparel", "mma"],
          disciplineTags: ["mma"],
          categoryTags: ["bottoms", "pants", "apparel"],
          variants: [{
            id: "internal-pants-variant",
            shopifyVariantId: "gid://shopify/ProductVariant/441",
            title: "M / Noir-Gris",
            sizeValue: "M",
            sizeCategory: "clothing",
            inventoryQuantity: 4,
            price: 59.99 as never,
          }],
        },
      ] as never)
      .mockResolvedValueOnce([FIGHT_SHORTS_PRODUCT, MMA_RASHGUARD_PRODUCT] as never);

    const request = makeStorefrontChatRequest({
      cart: {
        cartId: "gid://shopify/Cart/123",
        currencyCode: "EUR",
        items: [
          {
            lineId: "line-pants",
            productId: "gid://shopify/Product/44",
            productTitle: "Pantalon de compression Venum Tempest - Noir/Gris",
            variantId: "gid://shopify/ProductVariant/441",
            variantTitle: "M / Noir-Gris",
            quantity: 1,
          },
        ],
      },
      messages: [{ role: "user", content: "help me to find article compatible with this pantalon" }],
    });

    const proposals = await resolveCompatibleAddActionProposals(request);

    expect(proposals).toHaveLength(1);
    expect(proposals[0]?.preview?.after).toContain("Rashguard Venum Tempest");
    expect(proposals[0]?.preview?.after).not.toContain("Short de Combat Venum Tempest");
  });

  it("builds recommendations from compatible catalog products outside the cart", async () => {
    vi.mocked(getActiveRelationshipsForProduct).mockResolvedValue(
      [GLOVES_COMPLEMENTS_WRAPS_RELATIONSHIP] as never,
    );
    vi.mocked(db.product.findMany)
      .mockReset()
      .mockResolvedValueOnce([
        {
          ...BOXING_GLOVES_PRODUCT,
          status: "ACTIVE",
          variants: BOXING_GLOVES_PRODUCT.variants.map((variant) => ({
            ...variant,
            sizeValue: "12 oz",
            sizeCategory: "gloves",
            price: null,
          })),
        },
      ] as never)
      .mockResolvedValueOnce([HAND_WRAPS_PRODUCT] as never);

    const request = makeStorefrontChatRequest({
      cart: {
        cartId: "gid://shopify/Cart/123",
        currencyCode: "EUR",
        items: [
          {
            lineId: "line-gloves",
            productId: "gid://shopify/Product/99",
            productTitle: "Gants de Boxe Venum Impact Evo Scales - Vert Armee",
            variantId: "gid://shopify/ProductVariant/991",
            variantTitle: "12 oz / Vert Armee",
            quantity: 1,
          },
        ],
      },
      messages: [{ role: "user", content: "what compatible product do you recommend with these gloves?" }],
    });

    const reply = await buildStorefrontChatReply(request);
    const recommendationBlock = reply.guidanceBlocks.find((block) => block.type === "recommendation_list");

    expect(recommendationBlock?.type).toBe("recommendation_list");
    if (recommendationBlock?.type === "recommendation_list") {
      expect(recommendationBlock.items[0]).toMatchObject({
        action: "add",
        productId: "gid://shopify/Product/88",
        productTitle: "Bandages de boxe Venum Kontact",
      });
      expect(recommendationBlock.items.some((item) => item.productId === "gid://shopify/Product/99" && item.action === "keep")).toBe(false);
    }
  });

  it("falls back to compatible catalog search when no graph relationships exist", async () => {
    vi.mocked(getActiveRelationshipsForProduct).mockResolvedValue([]);
    vi.mocked(db.product.findMany)
      .mockReset()
      .mockResolvedValueOnce([
        {
          ...BOXING_GLOVES_PRODUCT,
          status: "ACTIVE",
          variants: BOXING_GLOVES_PRODUCT.variants.map((variant) => ({
            ...variant,
            sizeValue: "12 oz",
            sizeCategory: "gloves",
            price: null,
          })),
        },
      ] as never)
      .mockResolvedValueOnce([HAND_WRAPS_PRODUCT] as never);

    const request = makeStorefrontChatRequest({
      cart: {
        cartId: "gid://shopify/Cart/123",
        currencyCode: "EUR",
        items: [
          {
            lineId: "line-gloves",
            productId: "gid://shopify/Product/99",
            productTitle: "Gants de Boxe Venum Impact Evo Scales - Vert Armee",
            variantId: "gid://shopify/ProductVariant/991",
            variantTitle: "12 oz / Vert Armee",
            quantity: 1,
          },
        ],
      },
      messages: [{ role: "user", content: "help me to find article compatible with this gants" }],
    });

    const reply = await buildStorefrontChatReply(request);
    const recommendationBlock = reply.guidanceBlocks.find((block) => block.type === "recommendation_list");

    expect(recommendationBlock?.type).toBe("recommendation_list");
    if (recommendationBlock?.type === "recommendation_list") {
      expect(recommendationBlock.items[0]).toMatchObject({
        action: "add",
        productId: "gid://shopify/Product/88",
        productTitle: "Bandages de boxe Venum Kontact",
      });
      expect(recommendationBlock.items.some((item) => item.title === "Accessoire de protection")).toBe(false);
    }
  });

  it("returns null when no COMPLEMENTS relationships exist for the referenced product", async () => {
    vi.mocked(getActiveRelationshipsForProduct).mockResolvedValue([]);

    const request = makeStorefrontChatRequest({
      cart: {
        cartId: "gid://shopify/Cart/123",
        currencyCode: "EUR",
        items: [makeShortInCart()],
      },
      messages: [{ role: "user", content: "ajoute un gants de box compatible avec ce short" }],
    });

    const proposal = await resolveCompatibleAddActionProposal(request);
    expect(proposal).toBeNull();
  });

  it("returns null when no compatible product title matches the add-target keywords", async () => {
    vi.mocked(getActiveRelationshipsForProduct).mockResolvedValue(
      [SHORT_COMPLEMENTS_GLOVES_RELATIONSHIP] as never,
    );

    // Compatible products don't match "protege dents" (mouth guard)
    vi.mocked(db.product.findMany)
      .mockReset()
      .mockResolvedValueOnce([
        {
          id: "internal-short-id",
          shopifyProductId: "gid://shopify/Product/20",
          title: "Fightshort Venum Gladiator 3.0 - Noir/Blanc",
          status: "ACTIVE",
          tags: [],
          disciplineTags: [],
          categoryTags: ["shorts"],
          variants: [{
            id: "v1", shopifyVariantId: "gid://shopify/ProductVariant/201",
            title: "M", sizeValue: "M", sizeCategory: "clothing", inventoryQuantity: 1,
            price: 49.99 as never,
          }],
        },
      ] as never)
      .mockResolvedValueOnce([
        {
          ...BOXING_GLOVES_PRODUCT,
          // gloves — but user asks for "protege dents", no token matches
          title: "Gants de boxe Venum Elite",
          tags: ["boxing", "gloves"],
          disciplineTags: ["boxing"],
          categoryTags: ["gloves"],
        },
      ] as never);

    const request = makeStorefrontChatRequest({
      cart: {
        cartId: "gid://shopify/Cart/123",
        currencyCode: "EUR",
        items: [makeShortInCart()],
      },
      messages: [{ role: "user", content: "ajoute un protege dents compatible avec ce short" }],
    });

    const proposal = await resolveCompatibleAddActionProposal(request);
    expect(proposal).toBeNull();
  });

  it("returns null for messages without a reference-relation phrase", async () => {
    const request = makeStorefrontChatRequest({
      cart: {
        cartId: "gid://shopify/Cart/123",
        currencyCode: "EUR",
        items: [makeShortInCart()],
      },
      messages: [{ role: "user", content: "ajoute des gants de boxe" }],
    });

    const proposal = await resolveCompatibleAddActionProposal(request);
    expect(proposal).toBeNull();
    // No DB calls should be made when intent doesn't match
    expect(vi.mocked(getActiveRelationshipsForProduct)).not.toHaveBeenCalled();
  });

  it("returns null for messages without an add or discovery intent", async () => {
    const request = makeStorefrontChatRequest({
      cart: {
        cartId: "gid://shopify/Cart/123",
        currencyCode: "EUR",
        items: [makeShortInCart()],
      },
      messages: [{ role: "user", content: "quels gants sont compatibles avec ce short?" }],
    });

    const proposal = await resolveCompatibleAddActionProposal(request);
    expect(proposal).toBeNull();
  });
});
