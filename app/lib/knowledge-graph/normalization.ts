import { ProductStatus } from "@prisma/client";

export interface NormalizedProduct {
  shopifyProductId: string;
  title: string;
  description: string | null;
  handle: string;
  vendor: string | null;
  productType: string | null;
  status: ProductStatus;
  tags: string[];
  disciplineTags: string[];
  categoryTags: string[];
  dominantColors?: string[];
  collectionIds: string[];
  metafields: Record<string, string>;
  variants: NormalizedVariant[];
}

export interface NormalizedVariant {
  shopifyVariantId: string;
  title: string;
  sku: string | null;
  price: number | null;
  compareAtPrice: number | null;
  inventoryQuantity: number | null;
  imageUrl: string | null;
  sizeValue: string | null;
}

export interface ShopifyMetafieldNode {
  namespace: string;
  key: string;
  value: string;
}

export interface ShopifyVariantNode {
  id: string;
  title: string;
  sku?: string;
  price?: string;
  compareAtPrice?: string;
  inventoryQuantity?: number;
  image?: { url: string };
  selectedOptions?: { name: string; value: string }[];
}

export interface ShopifyProductNode {
  id: string;
  title: string;
  description?: string;
  handle: string;
  vendor?: string;
  productType?: string;
  status: string;
  tags?: string[];
  images?: {
    nodes: { url: string }[];
  };
  metafields?: {
    nodes: ShopifyMetafieldNode[];
  };
  collections?: {
    nodes: { id: string }[];
  };
  variants?: {
    nodes: ShopifyVariantNode[];
  };
}

export function normalizeProduct(shopifyProduct: ShopifyProductNode): NormalizedProduct | null {
  // Filtrage : uniquement les produits actifs et publiés (simplifié ici car on le filtrera dans la requête GraphQL idéalement)
  if (shopifyProduct.status !== "ACTIVE") {
    return null;
  }

  const metafields: Record<string, string> = {};
  const disciplineTags: string[] = [];
  const categoryTags: string[] = [];

  shopifyProduct.metafields?.nodes?.forEach((meta) => {
    if (meta.namespace === "custom" || meta.namespace === "cartmind") {
      metafields[`${meta.namespace}.${meta.key}`] = meta.value;

      if (meta.key === "discipline") disciplineTags.push(meta.value);
      if (meta.key === "category") categoryTags.push(meta.value);
    }
  });

  return {
    shopifyProductId: shopifyProduct.id,
    title: shopifyProduct.title,
    description: shopifyProduct.description || null,
    handle: shopifyProduct.handle,
    vendor: shopifyProduct.vendor || null,
    productType: shopifyProduct.productType || null,
    status: ProductStatus.ACTIVE,
    tags: shopifyProduct.tags || [],
    disciplineTags,
    categoryTags,
    collectionIds: shopifyProduct.collections?.nodes?.map((c) => c.id) || [],
    metafields,
    variants: shopifyProduct.variants?.nodes?.map(normalizeVariant) || [],
  };
}

function normalizeVariant(shopifyVariant: ShopifyVariantNode): NormalizedVariant {
  // Extraction simple de la taille si présente
  const sizeOption = shopifyVariant.selectedOptions?.find(
    (opt) => opt.name.toLowerCase() === "size" || opt.name.toLowerCase() === "taille"
  );

  return {
    shopifyVariantId: shopifyVariant.id,
    title: shopifyVariant.title,
    sku: shopifyVariant.sku || null,
    price: shopifyVariant.price ? parseFloat(shopifyVariant.price) : null,
    compareAtPrice: shopifyVariant.compareAtPrice ? parseFloat(shopifyVariant.compareAtPrice) : null,
    inventoryQuantity: shopifyVariant.inventoryQuantity || null,
    imageUrl: shopifyVariant.image?.url || null,
    sizeValue: sizeOption?.value || null,
  };
}
