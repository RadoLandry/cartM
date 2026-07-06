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
  };
});

// ── Imports after mocks ────────────────────────────────────────────────────

import { resolveCompatibleAddActionProposal } from "../../../app/lib/ai/storefront-chat";
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
  tags: ["boxing", "gloves", "gants", "box", "combat"],
  disciplineTags: ["boxing"],
  categoryTags: ["gloves"],
  variants: [
    {
      id: "internal-variant-gloves",
      shopifyVariantId: "gid://shopify/ProductVariant/991",
      title: "12 oz / Black",
      inventoryQuantity: 5,
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
    expect(proposal?.confirmationToken).toBeTruthy();
    expect(proposal?.expiresAt).toBeTruthy();
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

  it("returns null for messages without an add intent", async () => {
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
