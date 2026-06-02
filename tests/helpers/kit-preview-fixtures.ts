export interface KitPreviewFixtureItem {
  lineId: string;
  productId: string;
  variantId: string;
  productTitle: string;
  variantTitle?: string;
  quantity: number;
  imageUrl?: string;
  discipline?: string;
}

export interface KitPreviewFixtureCart {
  cartId: string;
  currencyCode: string;
  items: KitPreviewFixtureItem[];
}

export function makeKitPreviewCartFixture(
  overrides: Partial<KitPreviewFixtureCart> = {},
): KitPreviewFixtureCart {
  return {
    cartId: "gid://shopify/Cart/kit-preview-1",
    currencyCode: "USD",
    items: [
      {
        lineId: "line_1",
        productId: "gid://shopify/Product/101",
        variantId: "gid://shopify/ProductVariant/1011",
        productTitle: "Boxing Gloves",
        variantTitle: "12 oz / Black",
        quantity: 1,
        imageUrl: "https://cdn.example.com/gloves.png",
        discipline: "boxing",
      },
      {
        lineId: "line_2",
        productId: "gid://shopify/Product/102",
        variantId: "gid://shopify/ProductVariant/1021",
        productTitle: "Hand Wraps",
        variantTitle: "180 in / Black",
        quantity: 1,
        imageUrl: "https://cdn.example.com/wraps.png",
        discipline: "boxing",
      },
      {
        lineId: "line_3",
        productId: "gid://shopify/Product/103",
        variantId: "gid://shopify/ProductVariant/1031",
        productTitle: "Headgear",
        variantTitle: "L / Black",
        quantity: 1,
        imageUrl: "https://cdn.example.com/headgear.png",
        discipline: "boxing",
      },
    ],
    ...overrides,
  };
}

export function makeMixedDisciplineKitPreviewFixture(): KitPreviewFixtureCart {
  return makeKitPreviewCartFixture({
    cartId: "gid://shopify/Cart/kit-preview-mixed",
    items: [
      {
        lineId: "line_1",
        productId: "gid://shopify/Product/101",
        variantId: "gid://shopify/ProductVariant/1011",
        productTitle: "Boxing Gloves",
        quantity: 1,
        imageUrl: "https://cdn.example.com/gloves.png",
        discipline: "boxing",
      },
      {
        lineId: "line_2",
        productId: "gid://shopify/Product/201",
        variantId: "gid://shopify/ProductVariant/2011",
        productTitle: "BJJ Rashguard",
        quantity: 1,
        imageUrl: "https://cdn.example.com/rashguard.png",
        discipline: "bjj",
      },
    ],
  });
}

export function makeKitPreviewFixtureWithMissingImage(): KitPreviewFixtureCart {
  return makeKitPreviewCartFixture({
    cartId: "gid://shopify/Cart/kit-preview-missing-image",
    items: [
      {
        lineId: "line_1",
        productId: "gid://shopify/Product/101",
        variantId: "gid://shopify/ProductVariant/1011",
        productTitle: "Boxing Gloves",
        quantity: 1,
        imageUrl: "https://cdn.example.com/gloves.png",
        discipline: "boxing",
      },
      {
        lineId: "line_2",
        productId: "gid://shopify/Product/999",
        variantId: "gid://shopify/ProductVariant/9991",
        productTitle: "Unknown Item",
        quantity: 1,
        discipline: "boxing",
      },
    ],
  });
}

export function makeEmptyKitPreviewFixture(): KitPreviewFixtureCart {
  return {
    cartId: "gid://shopify/Cart/kit-preview-empty",
    currencyCode: "USD",
    items: [],
  };
}
