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

export interface StorefrontKitPreviewSnapshotItem {
  lineId: string;
  productId?: string;
  variantId?: string;
  productTitle?: string;
  variantTitle?: string;
  quantity: number;
  imageUrl?: string;
  discipline?: string;
  renderEligible: boolean;
}

export interface StorefrontKitPreviewSnapshot {
  cartId?: string;
  currencyCode: string;
  inferredDiscipline: string | null;
  items: StorefrontKitPreviewSnapshotItem[];
  signatureSeed: string;
}

export interface CartMutationOutcome {
  ok: boolean;
  status: "executed" | "failed";
  code?: StorefrontCartMutationCode;
  message: string;
  cart: StorefrontCartSnapshot;
}

interface StorefrontKitPreviewSnapshotInput {
  cartId?: string;
  currencyCode: string;
  items?: Array<{
    lineId?: string;
    productId?: string;
    variantId?: string;
    productTitle?: string;
    variantTitle?: string;
    quantity?: number;
    imageUrl?: string;
    discipline?: string;
  }>;
}

function normalizeCart(input: Partial<StorefrontCartSnapshot> & Pick<StorefrontCartSnapshot, "currencyCode">): StorefrontCartSnapshot {
  return {
    ...(input.cartId ? { cartId: input.cartId } : {}),
    currencyCode: input.currencyCode,
    items: input.items ?? [],
    ...(input.subtotal ? { subtotal: input.subtotal } : {}),
  };
}

function normalizeDiscipline(values: Array<string | undefined>): string | null {
  const normalized = Array.from(new Set(
    values
      .map((value) => value?.trim().toLowerCase().replace(/\s+/g, "_"))
      .filter((value): value is string => Boolean(value)),
  ));

  return normalized.length === 1 ? normalized[0] : null;
}

function normalizePreviewLineId(index: number, lineId?: string): string {
  if (lineId && lineId.trim().length > 0) {
    return lineId;
  }

  return `preview-line-${index + 1}`;
}

export function normalizeStorefrontCartForPreview(
  input: StorefrontKitPreviewSnapshotInput,
): StorefrontKitPreviewSnapshot {
  const items = (input.items ?? []).map((item, index) => {
    const quantity = Number.isFinite(item.quantity) && (item.quantity ?? 0) > 0
      ? Math.floor(item.quantity as number)
      : 1;
    const lineId = normalizePreviewLineId(index, item.lineId);
    const imageUrl = item.imageUrl?.trim();

    return {
      lineId,
      ...(item.productId ? { productId: item.productId } : {}),
      ...(item.variantId ? { variantId: item.variantId } : {}),
      ...(item.productTitle ? { productTitle: item.productTitle } : {}),
      ...(item.variantTitle ? { variantTitle: item.variantTitle } : {}),
      quantity,
      ...(imageUrl ? { imageUrl } : {}),
      ...(item.discipline ? { discipline: item.discipline } : {}),
      renderEligible: Boolean(imageUrl),
    };
  });

  const sortedItems = [...items].sort((a, b) => a.lineId.localeCompare(b.lineId));
  const inferredDiscipline = normalizeDiscipline(sortedItems.map((item) => item.discipline));
  const signatureSeed = sortedItems
    .map((item) => [
      item.lineId,
      item.productId ?? "",
      item.variantId ?? "",
      item.quantity.toString(),
      item.imageUrl ?? "",
    ].join("|"))
    .join("::");

  return {
    ...(input.cartId ? { cartId: input.cartId } : {}),
    currencyCode: input.currencyCode,
    inferredDiscipline,
    items: sortedItems,
    signatureSeed: `${inferredDiscipline ?? "mixed"}::${signatureSeed}`,
  };
}

function hasValidCartId(cartId: string): boolean {
  return cartId.trim().length > 0;
}

function findLineById(
  cart: StorefrontCartSnapshot,
  lineId: string,
): StorefrontCartSnapshotItem | undefined {
  return cart.items.find((item) => item.lineId === lineId);
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

    if (!hasValidCartId(input.cartId)) {
      return {
        ok: false,
        status: "failed",
        code: "MUTATION_ERROR",
        message: "Cart context is missing. Refresh cart and retry.",
        cart: snapshot,
      };
    }

    if (!input.merchandiseId || input.quantity < 1) {
      return {
        ok: false,
        status: "failed",
        code: "QUANTITY_INVALID",
        message: "Requested quantity is invalid for add-to-cart.",
        cart: snapshot,
      };
    }

    if (input.merchandiseId.toLowerCase().includes("unavailable")) {
      return {
        ok: false,
        status: "failed",
        code: "VARIANT_UNAVAILABLE",
        message: "Requested variant is unavailable for add-to-cart.",
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

    if (!hasValidCartId(input.cartId)) {
      return {
        ok: false,
        status: "failed",
        code: "MUTATION_ERROR",
        message: "Cart context is missing. Refresh cart and retry.",
        cart: snapshot,
      };
    }

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

    if (!hasValidCartId(input.cartId)) {
      return {
        ok: false,
        status: "failed",
        code: "MUTATION_ERROR",
        message: "Cart context is missing. Refresh cart and retry.",
        cart: snapshot,
      };
    }

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

    if (!hasValidCartId(input.cartId)) {
      return {
        ok: false,
        status: "failed",
        code: "MUTATION_ERROR",
        message: "Cart context is missing. Refresh cart and retry.",
        cart: snapshot,
      };
    }

    if (!input.lineId || !input.newMerchandiseId || input.quantity < 1) {
      return {
        ok: false,
        status: "failed",
        code: "VARIANT_UNAVAILABLE",
        message: "Requested swap is invalid or unavailable.",
        cart: snapshot,
      };
    }

    const currentLine = findLineById(snapshot, input.lineId);

    if (!currentLine) {
      return {
        ok: false,
        status: "failed",
        code: "LINE_NOT_FOUND",
        message: "Requested line does not exist in the current cart.",
        cart: snapshot,
      };
    }

    if (!currentLine.variantId) {
      return {
        ok: false,
        status: "failed",
        code: "VARIANT_UNAVAILABLE",
        message: "Current line has no swappable variant reference.",
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
      const rollbackOutcome = await storefrontCartMutationAdapter.addLine({
        cartId: input.cartId,
        merchandiseId: currentLine.variantId,
        quantity: currentLine.quantity,
        idempotencyKey: `${input.idempotencyKey}:rollback`,
        cart: removeOutcome.cart,
      });

      return {
        ok: false,
        status: "failed",
        code: "CART_CONFLICT",
        message: rollbackOutcome.ok
          ? "Swap failed and original variant was restored."
          : "Swap failed and rollback could not be completed safely. Refresh cart before retrying.",
        cart: rollbackOutcome.ok ? rollbackOutcome.cart : removeOutcome.cart,
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
