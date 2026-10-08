import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../app/db.server", () => ({
  default: {
    product: {
      findFirst: vi.fn(),
    },
  },
}));

import { buildCartToolActionProposal, resolveCartToolActionProposal } from "../../../app/lib/ai/tools";
import { makeStorefrontChatRequest } from "../../helpers/storefront-chat-fixtures";
import db from "../../../app/db.server";

describe("cart tool proposal inference", () => {
  beforeEach(() => {
    process.env.STOREFRONT_CHAT_SIGNING_SECRET = "test-signing-secret";
    vi.mocked(db.product.findFirst).mockReset();
  });

  it("proposes add-to-cart action with requested quantity", async () => {
    const request = makeStorefrontChatRequest({
      messages: [{ role: "user", content: "add 2 of these gloves" }],
    });

    const proposal = await buildCartToolActionProposal(request);

    expect(proposal).not.toBeNull();
    expect(proposal?.toolName).toBe("addToCart");
    expect(proposal?.payload.actionType).toBe("add");
    if (proposal?.payload.actionType === "add") {
      expect(proposal.payload.quantity).toBe(2);
      expect(proposal.payload.merchandiseId).toBe("gid://shopify/ProductVariant/11");
    }
  });

  it("proposes remove action targeting a matched cart line", async () => {
    const request = makeStorefrontChatRequest({
      cart: {
        cartId: "gid://shopify/Cart/123",
        currencyCode: "USD",
        items: [
          {
            lineId: "line-gloves",
            productId: "gid://shopify/Product/1",
            productTitle: "Core Training Gloves",
            variantId: "gid://shopify/ProductVariant/11",
            variantTitle: "12 oz / Black",
            quantity: 1,
          },
          {
            lineId: "line-wraps",
            productId: "gid://shopify/Product/2",
            productTitle: "Hand Wraps",
            variantId: "gid://shopify/ProductVariant/21",
            variantTitle: "180 in / Red",
            quantity: 1,
          },
        ],
      },
      messages: [{ role: "user", content: "remove hand wraps" }],
    });

    const proposal = await buildCartToolActionProposal(request);

    expect(proposal).not.toBeNull();
    expect(proposal?.toolName).toBe("removeFromCart");
    expect(proposal?.payload.actionType).toBe("remove");
    if (proposal?.payload.actionType === "remove") {
      expect(proposal.payload.lineId).toBe("line-wraps");
    }
  });

  it("proposes quantity change with increase intent and explicit quantity", async () => {
    const request = makeStorefrontChatRequest({
      cart: {
        cartId: "gid://shopify/Cart/123",
        currencyCode: "USD",
        items: [
          {
            lineId: "line-gloves",
            productId: "gid://shopify/Product/1",
            productTitle: "Core Training Gloves",
            variantId: "gid://shopify/ProductVariant/11",
            variantTitle: "12 oz / Black",
            quantity: 1,
          },
        ],
      },
      messages: [{ role: "user", content: "increase quantity to 3" }],
    });

    const proposal = await buildCartToolActionProposal(request);

    expect(proposal).not.toBeNull();
    expect(proposal?.toolName).toBe("changeQuantity");
    expect(proposal?.payload.actionType).toBe("change_quantity");
    if (proposal?.payload.actionType === "change_quantity") {
      expect(proposal.payload.lineId).toBe("line-gloves");
      expect(proposal.payload.quantity).toBe(3);
    }
  });

  it("sets the requested quantity from a French 'mets ... à N exemplaires' command", async () => {
    const request = makeStorefrontChatRequest({
      cart: {
        cartId: "gid://shopify/Cart/123",
        currencyCode: "EUR",
        items: [{
          lineId: "line-pants",
          productId: "gid://shopify/Product/44",
          productTitle: "Pantalon Homme UFC Zenith by Venum Authentic Fight Week - Bordeaux",
          variantId: "gid://shopify/ProductVariant/441",
          variantTitle: "XS",
          quantity: 5,
        }],
      },
      messages: [{ role: "user", content: "Mets le pantalon à 2 exemplaires." }],
    });

    const proposal = await buildCartToolActionProposal(request);

    expect(proposal?.toolName).toBe("changeQuantity");
    expect(proposal?.payload.actionType).toBe("change_quantity");
    if (proposal?.payload.actionType === "change_quantity") {
      expect(proposal.payload.lineId).toBe("line-pants");
      expect(proposal.payload.quantity).toBe(2);
    }
  });

  it("does not mutate an unrelated cart line when the named product isn't in the cart", async () => {
    const request = makeStorefrontChatRequest({
      cart: {
        cartId: "gid://shopify/Cart/123",
        currencyCode: "EUR",
        items: [
          {
            lineId: "line-pants",
            productId: "gid://shopify/Product/44",
            productTitle: "Pantalon Homme UFC Zenith by Venum Authentic Fight Week - Bordeaux",
            variantId: "gid://shopify/ProductVariant/441",
            variantTitle: "XS",
            quantity: 5,
          },
          {
            lineId: "line-gloves",
            productId: "gid://shopify/Product/99",
            productTitle: "Gants de Boxe Venum Impact Evo Scales - Vert Armee",
            variantId: "gid://shopify/ProductVariant/991",
            variantTitle: "Vert Armee",
            quantity: 1,
          },
        ],
      },
      // The cart contains no "short" — must not fall back to gloves or pants.
      messages: [{ role: "user", content: "Mets le short à 2 exemplaires." }],
    });

    const proposal = await buildCartToolActionProposal(request);
    expect(proposal).toBeNull();
  });

  it.each([
    ["Change la taille du pantalon en XL.", "XL"],
    ["Mets le pantalon en S.", "S"],
    ["Change la taille du pantalon en M.", "M"],
    ["Change la taille du pantalon en L.", "L"],
    ["Passe le pantalon en L.", "L"],
    ["Change la taille du pantalon de XS a L.", "L"],
    ["Mets le pantalon en taille 42.", "42"],
    ["Remplace le pantalon  par le même modèle en taille S en gardant la quantité.", "S"],
    ["Change le pantalon en M sans changer la quantité.", "M"],
    ["Switch the pantalon to size L keeping the same quantity.", "L"],
  ])("selects the requested size: %s", async (content, size) => {
    vi.mocked(db.product.findFirst).mockResolvedValueOnce({
      variants: [
        { shopifyVariantId: "gid://shopify/ProductVariant/441", title: "XS / Bordeaux", inventoryQuantity: 5 },
        { shopifyVariantId: "gid://shopify/ProductVariant/444", title: `${size} / Black`, inventoryQuantity: 20 },
        { shopifyVariantId: "gid://shopify/ProductVariant/442", title: `${size} / Bordeaux`, inventoryQuantity: 8 },
        { shopifyVariantId: "gid://shopify/ProductVariant/443", title: "XXL / Bordeaux", inventoryQuantity: 8 },
      ],
    } as never);
    const request = makeStorefrontChatRequest({
      cart: {
        cartId: "gid://shopify/Cart/123",
        currencyCode: "EUR",
        items: [{
          lineId: "line-gloves",
          productId: "gid://shopify/Product/99",
          productTitle: "Gants de Boxe Venum Impact Evo Scales - Vert Armee",
          variantId: "gid://shopify/ProductVariant/991",
          variantTitle: "8 oz",
          quantity: 1,
        }, {
          lineId: "line-pants",
          productId: "gid://shopify/Product/44",
          productTitle: "Pantalon Homme UFC Zenith by Venum Authentic Fight Week - Bordeaux",
          variantId: "gid://shopify/ProductVariant/441",
          variantTitle: "XS / Bordeaux",
          quantity: 5,
        }],
      },
      messages: [{ role: "user", content }],
    });

    const proposal = await buildCartToolActionProposal(request);

    expect(proposal?.toolName).toBe("swapVariant");
    expect(proposal?.payload.actionType).toBe("swap_variant");
    if (proposal?.payload.actionType === "swap_variant") {
      expect(proposal.payload.lineId).toBe("line-pants");
      expect(proposal.payload.newMerchandiseId).toBe("gid://shopify/ProductVariant/442");
      expect(proposal.payload.quantity).toBe(5);
    }
    expect(proposal?.preview?.after).toContain(size);
  });

  it.each([
    "Mets le pantalon en taille inconnue.",
    "Mets le pantalon en M.",
    "Passe la taille du pantalon a 42.",
  ])("does not change quantity when the requested size is unavailable: %s", async (content) => {
    vi.mocked(db.product.findFirst).mockResolvedValueOnce({
      variants: [
        { shopifyVariantId: "gid://shopify/ProductVariant/441", title: "XS / Bordeaux", inventoryQuantity: 5 },
        { shopifyVariantId: "gid://shopify/ProductVariant/442", title: "M / Bordeaux", inventoryQuantity: 0 },
        { shopifyVariantId: "gid://shopify/ProductVariant/443", title: "M / Black", inventoryQuantity: 8 },
      ],
    } as never);
    const request = makeStorefrontChatRequest({
      cart: {
        currencyCode: "EUR",
        items: [{ lineId: "pants", productId: "44", productTitle: "Pantalon", variantId: "441", variantTitle: "XS / Bordeaux", quantity: 2 }],
      },
      messages: [{ role: "user", content }],
    });

    expect(await resolveCartToolActionProposal(request)).toMatchObject({
      status: "clarification",
      clarification: { code: content.includes("inconnue") ? "SIZE_REQUIRED" : "VARIANT_UNRESOLVED" },
    });
  });

  it.each(["Mets le pantalon en M.", "Mets la taille en M.", "Mets le short en M."])("does not guess a cart line for an ambiguous size request: %s", async (content) => {
    const request = makeStorefrontChatRequest({
      cart: {
        currencyCode: "EUR",
        items: [
          { lineId: "pants-xs", productId: "44", productTitle: "Pantalon", variantId: "441", variantTitle: "XS", quantity: 2 },
          { lineId: "pants-l", productId: "44", productTitle: "Pantalon", variantId: "442", variantTitle: "L", quantity: 1 },
        ],
      },
      messages: [{ role: "user", content }],
    });

    expect(await resolveCartToolActionProposal(request)).toMatchObject({
      status: "clarification",
      clarification: { code: "TARGET_REQUIRED" },
    });
    expect(db.product.findFirst).not.toHaveBeenCalled();
  });

  it("resumes an invalid size clarification with S and preserves all 11 units", async () => {
    const request = makeStorefrontChatRequest({
      sessionKey: "size-clarification-regression",
      cart: { currencyCode: "EUR", items: [{
        lineId: "pants", productId: "44", productTitle: "Pantalon",
        variantId: "441", variantTitle: "XS / Bordeaux", quantity: 11,
      }] },
      messages: [{ role: "user", content: "Remplace le pantalon en taille O en gardant la quantite." }],
    });
    expect(await resolveCartToolActionProposal(request)).toMatchObject({ status: "clarification" });
    vi.mocked(db.product.findFirst).mockResolvedValueOnce({ variants: [
      { shopifyVariantId: "441", title: "XS / Bordeaux", inventoryQuantity: 20 },
      { shopifyVariantId: "442", title: "S / Bordeaux", inventoryQuantity: 20 },
    ] } as never);
    const resolution = await resolveCartToolActionProposal({ ...request, messages: [{ role: "user", content: "S" }] });
    expect(resolution).toMatchObject({ status: "proposed", action: {
      toolName: "swapVariant", payload: { lineId: "pants", newMerchandiseId: "442", quantity: 11 },
    } });
    expect(await resolveCartToolActionProposal({ ...request, messages: [{ role: "user", content: "oui" }] }))
      .toEqual({ status: "no_action" });
  });

  it.each(["session", "quantity", "expired", "unrelated-turn"])("does not resume unsafe size context: %s", async (reason) => {
    const request = makeStorefrontChatRequest({
      sessionKey: `size-context-${reason}`,
      cart: { currencyCode: "EUR", items: [{
        lineId: "pants", productId: "44", productTitle: "Pantalon",
        variantId: "441", variantTitle: "XS / Bordeaux", quantity: 11,
      }] },
      messages: [{ role: "user", content: "Remplace le pantalon en taille O en gardant la quantite." }],
    });
    await resolveCartToolActionProposal(request);
    const followUp = { ...request, messages: [{ role: "user" as const, content: "S" }] };
    if (reason === "session") followUp.sessionKey += "-other";
    if (reason === "quantity") followUp.cart = { ...request.cart, items: [{ ...request.cart.items[0], quantity: 2 }] };
    if (reason === "unrelated-turn") {
      await resolveCartToolActionProposal({ ...request, messages: [{ role: "user", content: "Bonjour" }] });
    }
    const clock = reason === "expired" ? vi.spyOn(Date, "now").mockReturnValue(Date.now() + 6 * 60_000) : null;
    try {
      expect(await resolveCartToolActionProposal(followUp)).toMatchObject({
        status: "clarification", clarification: { code: "TARGET_REQUIRED" },
      });
      expect(db.product.findFirst).not.toHaveBeenCalled();
    } finally {
      clock?.mockRestore();
    }
  });

  it("keeps an explicit quantity request separate from a size change", async () => {
    const proposal = await buildCartToolActionProposal(makeStorefrontChatRequest({
      messages: [{ role: "user", content: "change quantity to 3" }],
    }));

    expect(proposal?.payload.actionType).toBe("change_quantity");
    expect(db.product.findFirst).not.toHaveBeenCalled();
  });

  it("proposes swap action using explicitly requested variant id", async () => {
    const request = makeStorefrontChatRequest({
      cart: {
        cartId: "gid://shopify/Cart/123",
        currencyCode: "USD",
        items: [
          {
            lineId: "line-gloves",
            productId: "gid://shopify/Product/1",
            productTitle: "Core Training Gloves",
            variantId: "gid://shopify/ProductVariant/11",
            variantTitle: "12 oz / Black",
            quantity: 1,
          },
        ],
      },
      messages: [{ role: "user", content: "replace with gid://shopify/ProductVariant/22" }],
    });

    const proposal = await buildCartToolActionProposal(request);

    expect(proposal).not.toBeNull();
    expect(proposal?.toolName).toBe("swapVariant");
    expect(proposal?.payload.actionType).toBe("swap_variant");
    if (proposal?.payload.actionType === "swap_variant") {
      expect(proposal.payload.lineId).toBe("line-gloves");
      expect(proposal.payload.newMerchandiseId).toBe("gid://shopify/ProductVariant/22");
    }
  });

  it("proposes quantity decrease but never below one", async () => {
    const request = makeStorefrontChatRequest({
      cart: {
        cartId: "gid://shopify/Cart/123",
        currencyCode: "USD",
        items: [
          {
            lineId: "line-gloves",
            productId: "gid://shopify/Product/1",
            productTitle: "Core Training Gloves",
            variantId: "gid://shopify/ProductVariant/11",
            variantTitle: "12 oz / Black",
            quantity: 1,
          },
        ],
      },
      messages: [{ role: "user", content: "decrease quantity" }],
    });

    const proposal = await buildCartToolActionProposal(request);

    expect(proposal).not.toBeNull();
    expect(proposal?.payload.actionType).toBe("change_quantity");
    if (proposal?.payload.actionType === "change_quantity") {
      expect(proposal.payload.quantity).toBe(1);
    }
  });

  it("maps explicit French quantity to the correct mentioned cart line", async () => {
    const cart = {
      cartId: "gid://shopify/Cart/123",
      currencyCode: "USD",
      items: [
        {
          lineId: "line-jacket",
          productId: "gid://shopify/Product/10",
          productTitle: "Veste Venum Elite",
          variantId: "gid://shopify/ProductVariant/101",
          variantTitle: "M / Black",
          quantity: 6,
        },
        {
          lineId: "line-shorts",
          productId: "gid://shopify/Product/20",
          productTitle: "Short Venum Gladiator",
          variantId: "gid://shopify/ProductVariant/201",
          variantTitle: "M / Black",
          quantity: 7,
        },
      ],
    };

    const request = makeStorefrontChatRequest({
      cart,
      messages: [{ role: "user", content: "diminue la quantite du short a 5, et la quantite de la veste a 3" }],
    });

    const proposal = await buildCartToolActionProposal(request);

    expect(proposal).not.toBeNull();
    expect(proposal?.toolName).toBe("changeQuantity");
    expect(proposal?.payload.actionType).toBe("change_quantity");
    if (proposal?.payload.actionType === "change_quantity") {
      expect(proposal.payload.lineId).toBe("line-shorts");
      expect(proposal.payload.quantity).toBe(5);
      expect(proposal.payload.changes).toEqual([
        { lineId: "line-shorts", quantity: 5 },
        { lineId: "line-jacket", quantity: 3 },
      ]);
    }
  });

  it("maps multi-item quantity update with accented French and 'du' preposition", async () => {
    // Exact prompt from real user: "diminue la quantité du short à 5, et la quantité du veste à 3"
    const cart = {
      cartId: "gid://shopify/Cart/123",
      currencyCode: "USD",
      items: [
        {
          lineId: "line-jacket",
          productId: "gid://shopify/Product/10",
          productTitle: "Veste Venum Elite",
          variantId: "gid://shopify/ProductVariant/101",
          variantTitle: "M / Black",
          quantity: 6,
        },
        {
          lineId: "line-shorts",
          productId: "gid://shopify/Product/20",
          productTitle: "Short Venum Gladiator",
          variantId: "gid://shopify/ProductVariant/201",
          variantTitle: "M / Black",
          quantity: 7,
        },
      ],
    };

    const request = makeStorefrontChatRequest({
      cart,
      messages: [{ role: "user", content: "diminue la quantité du short à 5, et la quantité du veste à 3" }],
    });

    const proposal = await buildCartToolActionProposal(request);

    expect(proposal?.payload.actionType).toBe("change_quantity");
    if (proposal?.payload.actionType === "change_quantity") {
      // Short must be 5, veste must be 3 — never the other way around
      expect(proposal.payload.lineId).toBe("line-shorts");
      expect(proposal.payload.quantity).toBe(5);
      expect(proposal.payload.changes).toEqual([
        { lineId: "line-shorts", quantity: 5 },
        { lineId: "line-jacket", quantity: 3 },
      ]);
    }
  });

  it("maps exact French gants and veste quantity update to both cart lines", async () => {
    const cart = {
      cartId: "gid://shopify/Cart/123",
      currencyCode: "USD",
      items: [
        {
          lineId: "line-gloves",
          productId: "gid://shopify/Product/10",
          productTitle: "Gants de boxe Venum Elite",
          variantId: "gid://shopify/ProductVariant/101",
          variantTitle: "12 oz / Black",
          quantity: 1,
        },
        {
          lineId: "line-jacket",
          productId: "gid://shopify/Product/20",
          productTitle: "Veste Venum Elite",
          variantId: "gid://shopify/ProductVariant/201",
          variantTitle: "M / Black",
          quantity: 1,
        },
      ],
    };

    const request = makeStorefrontChatRequest({
      cart,
      messages: [{ role: "user", content: "modifie la quantité du gants à 5 et la quantité du veste à 3" }],
    });

    const proposal = await buildCartToolActionProposal(request);

    expect(proposal?.toolName).toBe("changeQuantity");
    expect(proposal?.payload.actionType).toBe("change_quantity");
    if (proposal?.payload.actionType === "change_quantity") {
      expect(proposal.payload.lineId).toBe("line-gloves");
      expect(proposal.payload.quantity).toBe(5);
      expect(proposal.payload.changes).toEqual([
        { lineId: "line-gloves", quantity: 5 },
        { lineId: "line-jacket", quantity: 3 },
      ]);
    }
  });

  it("maps singular French short mention to plural shorts product in multi-item updates", async () => {
    const cart = {
      cartId: "gid://shopify/Cart/123",
      currencyCode: "USD",
      items: [
        {
          lineId: "line-jacket",
          productId: "gid://shopify/Product/10",
          productTitle: "Veste de survêtement Venum Attack 90 - Bleu Nuit",
          variantId: "gid://shopify/ProductVariant/101",
          variantTitle: "M / Bleu Nuit",
          quantity: 2,
        },
        {
          lineId: "line-shorts",
          productId: "gid://shopify/Product/20",
          productTitle: "Shorts Venum Attack 90 - Bleu Nuit",
          variantId: "gid://shopify/ProductVariant/201",
          variantTitle: "M / Bleu Nuit",
          quantity: 7,
        },
      ],
    };

    const request = makeStorefrontChatRequest({
      cart,
      messages: [{ role: "user", content: "diminue la quantité du short à 5, et la quantité du veste à 1" }],
    });

    const proposal = await buildCartToolActionProposal(request);

    expect(proposal?.toolName).toBe("changeQuantity");
    expect(proposal?.payload.actionType).toBe("change_quantity");
    if (proposal?.payload.actionType === "change_quantity") {
      expect(proposal.payload.lineId).toBe("line-shorts");
      expect(proposal.payload.quantity).toBe(5);
      expect(proposal.payload.changes).toEqual([
        { lineId: "line-shorts", quantity: 5 },
        { lineId: "line-jacket", quantity: 1 },
      ]);
    }
  });

  it("uses positional fallback when a cart line has no productTitle for multi-item quantity update", async () => {
    // Real-world scenario: the short product's productTitle was not populated in the
    // cart snapshot (e.g. initial config race or missing product_title from cart.js).
    // The veste line still matches by title.  The short line must be assigned via the
    // positional fallback — it is the only unmatched line remaining.
    const cart = {
      cartId: "gid://shopify/Cart/123",
      currencyCode: "USD",
      items: [
        {
          lineId: "line-jacket",
          productId: "gid://shopify/Product/10",
          productTitle: "Veste de survêtement Venum Attack 90 - Bleu Nuit",
          variantId: "gid://shopify/ProductVariant/101",
          variantTitle: "M / Bleu Nuit",
          quantity: 5,
        },
        {
          lineId: "line-shorts",
          productId: "gid://shopify/Product/20",
          // productTitle intentionally omitted — matches missing data scenario
          variantId: "gid://shopify/ProductVariant/201",
          variantTitle: "M / Bleu Nuit",
          quantity: 7,
        },
      ],
    };

    const request = makeStorefrontChatRequest({
      cart,
      messages: [{ role: "user", content: "diminue la quantité du short à 5, et la quantité du veste à 2" }],
    });

    const proposal = await buildCartToolActionProposal(request);

    expect(proposal?.toolName).toBe("changeQuantity");
    expect(proposal?.payload.actionType).toBe("change_quantity");
    if (proposal?.payload.actionType === "change_quantity") {
      // Short directive (qty 5) must be assigned to line-shorts via positional fallback.
      // Veste directive (qty 2) matches directly by title.
      expect(proposal.payload.changes).toEqual([
        { lineId: "line-shorts", quantity: 5 },
        { lineId: "line-jacket", quantity: 2 },
      ]);
    }
  });

  it("returns null for add intent when the only cart match is a context reference (e.g. 'compatible with this short')", async () => {
    const request = makeStorefrontChatRequest({
      cart: {
        cartId: "gid://shopify/Cart/123",
        currencyCode: "USD",
        items: [
          {
            lineId: "line-shorts",
            productId: "gid://shopify/Product/20",
            productTitle: "Fightshort Venum Gladiator 3.0 - Noir/Blanc",
            variantId: "gid://shopify/ProductVariant/201",
            variantTitle: "M / Black",
            quantity: 1,
          },
        ],
      },
      messages: [{ role: "user", content: "ajoute un gants de box compatible à ce short" }],
    });

    // Should NOT propose adding the Fightshort again — "à ce short" is a context
    // reference, not the item the shopper wants to add.
    const proposal = await buildCartToolActionProposal(request);
    expect(proposal).toBeNull();
  });
});
