import { beforeEach, describe, expect, it } from "vitest";

import { buildCartToolActionProposal } from "../../../app/lib/ai/tools";
import { makeStorefrontChatRequest } from "../../helpers/storefront-chat-fixtures";

describe("cart tool proposal inference", () => {
  beforeEach(() => {
    process.env.STOREFRONT_CHAT_SIGNING_SECRET = "test-signing-secret";
  });

  it("proposes add-to-cart action with requested quantity", () => {
    const request = makeStorefrontChatRequest({
      messages: [{ role: "user", content: "add 2 of these gloves" }],
    });

    const proposal = buildCartToolActionProposal(request);

    expect(proposal).not.toBeNull();
    expect(proposal?.toolName).toBe("addToCart");
    expect(proposal?.payload.actionType).toBe("add");
    if (proposal?.payload.actionType === "add") {
      expect(proposal.payload.quantity).toBe(2);
      expect(proposal.payload.merchandiseId).toBe("gid://shopify/ProductVariant/11");
    }
  });

  it("proposes remove action targeting a matched cart line", () => {
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

    const proposal = buildCartToolActionProposal(request);

    expect(proposal).not.toBeNull();
    expect(proposal?.toolName).toBe("removeFromCart");
    expect(proposal?.payload.actionType).toBe("remove");
    if (proposal?.payload.actionType === "remove") {
      expect(proposal.payload.lineId).toBe("line-wraps");
    }
  });

  it("proposes quantity change with increase intent and explicit quantity", () => {
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

    const proposal = buildCartToolActionProposal(request);

    expect(proposal).not.toBeNull();
    expect(proposal?.toolName).toBe("changeQuantity");
    expect(proposal?.payload.actionType).toBe("change_quantity");
    if (proposal?.payload.actionType === "change_quantity") {
      expect(proposal.payload.lineId).toBe("line-gloves");
      expect(proposal.payload.quantity).toBe(3);
    }
  });

  it("proposes swap action using explicitly requested variant id", () => {
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

    const proposal = buildCartToolActionProposal(request);

    expect(proposal).not.toBeNull();
    expect(proposal?.toolName).toBe("swapVariant");
    expect(proposal?.payload.actionType).toBe("swap_variant");
    if (proposal?.payload.actionType === "swap_variant") {
      expect(proposal.payload.lineId).toBe("line-gloves");
      expect(proposal.payload.newMerchandiseId).toBe("gid://shopify/ProductVariant/22");
    }
  });

  it("proposes quantity decrease but never below one", () => {
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

    const proposal = buildCartToolActionProposal(request);

    expect(proposal).not.toBeNull();
    expect(proposal?.payload.actionType).toBe("change_quantity");
    if (proposal?.payload.actionType === "change_quantity") {
      expect(proposal.payload.quantity).toBe(1);
    }
  });

  it("maps explicit French quantity to the correct mentioned cart line", () => {
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

    const proposal = buildCartToolActionProposal(request);

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

  it("maps multi-item quantity update with accented French and 'du' preposition", () => {
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

    const proposal = buildCartToolActionProposal(request);

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

  it("maps singular French short mention to plural shorts product in multi-item updates", () => {
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

    const proposal = buildCartToolActionProposal(request);

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

  it("uses positional fallback when a cart line has no productTitle for multi-item quantity update", () => {
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

    const proposal = buildCartToolActionProposal(request);

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

  it("returns null for add intent when the only cart match is a context reference (e.g. 'compatible with this short')", () => {
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
    const proposal = buildCartToolActionProposal(request);
    expect(proposal).toBeNull();
  });
});
