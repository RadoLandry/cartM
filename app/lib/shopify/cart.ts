import type { ProductComparisonSnapshot, StorefrontChatRequest } from "../ai/schemas";
import { storefrontCartMutationAdapter, type CartMutationOutcome, type StorefrontCartSnapshot } from "./storefront-cart";

export interface FetchComparisonProductsInput {
  shop: string;
  productRefs: string[];
  preferredVariantIds?: string[];
  cart: StorefrontChatRequest["cart"];
}

export interface FetchComparisonProductsResult {
  items: ProductComparisonSnapshot[];
  fetchedAt: string;
}

export interface ApplyComparisonSelectionInput {
  actionId: string;
  cartId?: string;
  selectedProductId: string;
  selectedVariantId?: string;
  fallbackVariantId?: string;
  cart: StorefrontCartSnapshot;
}

function findCartItemByRef(input: FetchComparisonProductsInput, ref: string) {
  return input.cart.items.find((item) => (
    item.productId === ref
    || item.variantId === ref
    || item.lineId === ref
  ));
}

function buildSnapshotFromCartItem(ref: string, item?: StorefrontChatRequest["cart"]["items"][number]): ProductComparisonSnapshot {
  const id = item?.productId || item?.variantId || item?.lineId || ref;

  return {
    productId: id,
    ...(item?.variantId ? { variantId: item.variantId } : {}),
    title: item?.productTitle || item?.variantTitle || `Product ${ref.slice(0, 8)}`,
    ...(item?.variantTitle ? { imageUrl: `https://cdn.shopify.com/fallback/${encodeURIComponent(item.variantTitle)}` } : {}),
    price: "0.00",
    currencyCode: "USD",
    availability: "unknown",
    attributes: {
      quantityInCart: item?.quantity ?? 0,
    },
  };
}

export async function fetchComparisonProducts(
  input: FetchComparisonProductsInput,
): Promise<FetchComparisonProductsResult> {
  const uniqueRefs = Array.from(new Set(input.productRefs)).slice(0, 5);

  const items = uniqueRefs.map((ref) => {
    const snapshot = buildSnapshotFromCartItem(ref, findCartItemByRef(input, ref));

    return {
      ...snapshot,
      currencyCode: input.cart.currencyCode,
    };
  });

  return {
    items,
    fetchedAt: new Date().toISOString(),
  };
}

export async function applyComparisonSelectionToCart(
  input: ApplyComparisonSelectionInput,
): Promise<CartMutationOutcome> {
  const merchandiseId = input.selectedVariantId || input.fallbackVariantId || input.selectedProductId;

  return await storefrontCartMutationAdapter.addLine({
    cartId: input.cartId || input.cart.cartId || "",
    merchandiseId,
    quantity: 1,
    idempotencyKey: `${input.actionId}:${input.selectedProductId}`,
    cart: input.cart,
  });
}
