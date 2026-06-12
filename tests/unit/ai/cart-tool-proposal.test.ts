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
});
