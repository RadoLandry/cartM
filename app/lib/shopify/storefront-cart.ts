export type StorefrontCartMutationCode =
  | "LINE_NOT_FOUND"
  | "VARIANT_UNAVAILABLE"
  | "QUANTITY_INVALID"
  | "CART_CONFLICT"
  | "MUTATION_ERROR";

export interface StorefrontCartSnapshotItem {
  lineId: string;
  productId?: string;
  variantId?: string;
  quantity: number;
}

export interface StorefrontCartSnapshot {
  cartId?: string;
  currencyCode: string;
  items: StorefrontCartSnapshotItem[];
  subtotal?: string;
}

export interface CartMutationOutcome {
  ok: boolean;
  status: "executed" | "failed";
  code?: StorefrontCartMutationCode;
  message: string;
  cart: StorefrontCartSnapshot;
}

function normalizeCart(input: Partial<StorefrontCartSnapshot> & Pick<StorefrontCartSnapshot, "currencyCode">): StorefrontCartSnapshot {
  return {
    ...(input.cartId ? { cartId: input.cartId } : {}),
    currencyCode: input.currencyCode,
    items: input.items ?? [],
    ...(input.subtotal ? { subtotal: input.subtotal } : {}),
  };
}

function notImplementedOutcome(message: string, cart: StorefrontCartSnapshot): CartMutationOutcome {
  return {
    ok: false,
    status: "failed",
    code: "MUTATION_ERROR",
    message,
    cart,
  };
}

export const storefrontCartMutationAdapter = {
  async addLine(input: {
    cartId: string;
    merchandiseId: string;
    quantity: number;
    idempotencyKey: string;
    cart: StorefrontCartSnapshot;
  }): Promise<CartMutationOutcome> {
    const snapshot = normalizeCart(input.cart);

    if (!input.merchandiseId || input.quantity < 1) {
      return {
        ok: false,
        status: "failed",
        code: "QUANTITY_INVALID",
        message: "Requested quantity is invalid for add-to-cart.",
        cart: snapshot,
      };
    }

    const nextItems = [
      ...snapshot.items,
      {
        lineId: `line-${input.idempotencyKey}`,
        variantId: input.merchandiseId,
        quantity: input.quantity,
      },
    ];

    return {
      ok: true,
      status: "executed",
      message: "Item added to cart.",
      cart: {
        ...snapshot,
        items: nextItems,
      },
    };
  },

  async removeLine(input: {
    cartId: string;
    lineId: string;
    idempotencyKey: string;
    cart: StorefrontCartSnapshot;
  }): Promise<CartMutationOutcome> {
    const snapshot = normalizeCart(input.cart);

    if (!input.lineId) {
      return {
        ok: false,
        status: "failed",
        code: "LINE_NOT_FOUND",
        message: "Requested line could not be found.",
        cart: snapshot,
      };
    }

    const lineExists = snapshot.items.some((item) => item.lineId === input.lineId);
    if (!lineExists) {
      return {
        ok: false,
        status: "failed",
        code: "LINE_NOT_FOUND",
        message: "Requested line does not exist in the current cart.",
        cart: snapshot,
      };
    }

    return {
      ok: true,
      status: "executed",
      message: "Item removed from cart.",
      cart: {
        ...snapshot,
        items: snapshot.items.filter((item) => item.lineId !== input.lineId),
      },
    };
  },

  async updateLineQuantity(input: {
    cartId: string;
    lineId: string;
    quantity: number;
    idempotencyKey: string;
    cart: StorefrontCartSnapshot;
  }): Promise<CartMutationOutcome> {
    const snapshot = normalizeCart(input.cart);

    if (!input.lineId || input.quantity < 1) {
      return {
        ok: false,
        status: "failed",
        code: "QUANTITY_INVALID",
        message: "Requested quantity update is invalid.",
        cart: snapshot,
      };
    }

    const lineExists = snapshot.items.some((item) => item.lineId === input.lineId);
    if (!lineExists) {
      return {
        ok: false,
        status: "failed",
        code: "LINE_NOT_FOUND",
        message: "Requested line does not exist in the current cart.",
        cart: snapshot,
      };
    }

    return {
      ok: true,
      status: "executed",
      message: "Item quantity updated.",
      cart: {
        ...snapshot,
        items: snapshot.items.map((item) => (
          item.lineId === input.lineId
            ? {
                ...item,
                quantity: input.quantity,
              }
            : item
        )),
      },
    };
  },

  async swapLineVariant(input: {
    cartId: string;
    lineId: string;
    newMerchandiseId: string;
    quantity: number;
    idempotencyKey: string;
    cart: StorefrontCartSnapshot;
  }): Promise<CartMutationOutcome> {
    const snapshot = normalizeCart(input.cart);

    if (!input.lineId || !input.newMerchandiseId || input.quantity < 1) {
      return {
        ok: false,
        status: "failed",
        code: "VARIANT_UNAVAILABLE",
        message: "Requested swap is invalid or unavailable.",
        cart: snapshot,
      };
    }

    const removeOutcome = await storefrontCartMutationAdapter.removeLine({
      cartId: input.cartId,
      lineId: input.lineId,
      idempotencyKey: `${input.idempotencyKey}:remove`,
      cart: snapshot,
    });

    if (!removeOutcome.ok) {
      return {
        ...removeOutcome,
        message: "Unable to remove the current variant before swap.",
      };
    }

    const addOutcome = await storefrontCartMutationAdapter.addLine({
      cartId: input.cartId,
      merchandiseId: input.newMerchandiseId,
      quantity: input.quantity,
      idempotencyKey: `${input.idempotencyKey}:add`,
      cart: removeOutcome.cart,
    });

    if (!addOutcome.ok) {
      return {
        ...addOutcome,
        message: "Swap partially applied: original line removed but replacement variant failed to add. Refresh cart before retrying.",
      };
    }

    return {
      ok: true,
      status: "executed",
      message: "Variant swapped successfully.",
      cart: addOutcome.cart,
    };
  },
};
