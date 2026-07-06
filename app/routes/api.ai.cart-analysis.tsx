import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { z } from "zod";

import db from "../db.server";
import {
  buildCartUnderstandingContext,
  type CartContextCollectionInput,
  type CartContextLineInput,
} from "../lib/cart-intelligence/cart-context";

const CartLineSchema = z.object({
  productId: z.string().min(1),
  variantId: z.string().min(1).optional(),
  title: z.string().min(1).optional(),
  quantity: z.coerce.number().int().min(1).default(1),
});

const CartAnalysisRequestSchema = z.object({
  shop: z.string().min(1),
  cartId: z.string().optional(),
  cart: z.array(CartLineSchema).default([]),
});

type CartAnalysisRequest = z.infer<typeof CartAnalysisRequestSchema>;

function toProductGid(rawValue: string) {
  if (rawValue.startsWith("gid://shopify/Product/")) {
    return rawValue;
  }

  const numeric = rawValue.match(/\d+/)?.[0] ?? rawValue;
  return `gid://shopify/Product/${numeric}`;
}

function toVariantGid(rawValue: string) {
  if (rawValue.startsWith("gid://shopify/ProductVariant/")) {
    return rawValue;
  }

  const numeric = rawValue.match(/\d+/)?.[0] ?? rawValue;
  return `gid://shopify/ProductVariant/${numeric}`;
}

function parseUrlRequest(request: Request) {
  const url = new URL(request.url);
  const productIds = url.searchParams.getAll("productId").filter(Boolean);
  const variantIds = url.searchParams.getAll("variantId");
  const titles = url.searchParams.getAll("title");
  const quantities = url.searchParams.getAll("quantity");
  const cart = productIds.map((productId, index) => ({
    productId,
    variantId: variantIds[index] || undefined,
    title: titles[index] || undefined,
    quantity: quantities[index] ? Number(quantities[index]) : 1,
  }));

  return CartAnalysisRequestSchema.safeParse({
    shop: url.searchParams.get("shop") ?? "",
    cartId: url.searchParams.get("cartId") ?? undefined,
    cart,
  });
}

async function parseBodyRequest(request: Request) {
  const body = await request.json().catch(() => null);

  return CartAnalysisRequestSchema.safeParse({
    shop: body?.shop ?? "",
    cartId: body?.cartId ?? undefined,
    cart: Array.isArray(body?.cart) ? body.cart : [],
  });
}

function isCollectionInput(value: unknown): value is CartContextCollectionInput {
  return Boolean(value) && typeof value === "object";
}

function parseCollections(value: unknown): CartContextCollectionInput[] {
  return Array.isArray(value) ? value.filter(isCollectionInput) : [];
}

async function resolveCartContextLines(input: CartAnalysisRequest): Promise<CartContextLineInput[]> {
  const normalized = input.cart.map((line) => ({
    inputLine: line,
    productGid: toProductGid(line.productId),
    variantGid: line.variantId ? toVariantGid(line.variantId) : undefined,
  }));
  const productGids = Array.from(new Set(normalized.map((line) => line.productGid)));
  const variantGids = Array.from(new Set(normalized.map((line) => line.variantGid).filter((value): value is string => Boolean(value))));

  if (productGids.length === 0 && variantGids.length === 0) {
    return [];
  }

  const products = await db.product.findMany({
    where: {
      shop: input.shop,
      OR: [
        ...(productGids.length > 0 ? [{ shopifyProductId: { in: productGids } }] : []),
        ...(variantGids.length > 0 ? [{ variants: { some: { shopifyVariantId: { in: variantGids } } } }] : []),
      ],
    },
    select: {
      id: true,
      shopifyProductId: true,
      title: true,
      tags: true,
      disciplineTags: true,
      categoryTags: true,
      collectionIds: true,
      variants: {
        select: {
          shopifyVariantId: true,
        },
      },
      visualProfile: {
        select: {
          detectedCollections: true,
          overrideCollections: true,
        },
      },
    },
  });

  const productByGid = new Map(products.map((product) => [product.shopifyProductId, product]));
  const productByVariantGid = new Map<string, (typeof products)[number]>();
  for (const product of products) {
    for (const variant of product.variants) {
      productByVariantGid.set(variant.shopifyVariantId, product);
    }
  }

  return normalized.map((line) => {
    const product = productByGid.get(line.productGid) || (line.variantGid ? productByVariantGid.get(line.variantGid) : undefined);
    const detectedCollections = parseCollections(product?.visualProfile?.detectedCollections);
    const overrideCollections = parseCollections(product?.visualProfile?.overrideCollections);

    return {
      productId: line.productGid,
      ...(line.variantGid ? { variantId: line.variantGid } : {}),
      title: product?.title ?? line.inputLine.title ?? line.inputLine.productId,
      quantity: line.inputLine.quantity,
      tags: product?.tags ?? [],
      disciplineTags: product?.disciplineTags ?? [],
      categoryTags: product?.categoryTags ?? [],
      collectionIds: product?.collectionIds ?? [],
      collections: overrideCollections.length > 0 ? overrideCollections : detectedCollections,
    };
  });
}

async function buildCartAnalysisResponse(input: CartAnalysisRequest) {
  const lines = await resolveCartContextLines(input);

  return {
    ok: true,
    request: input,
    context: buildCartUnderstandingContext(lines),
  };
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const parsed = parseUrlRequest(request);

  if (!parsed.success) {
    return Response.json(
      {
        ok: false,
        error: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  return Response.json(await buildCartAnalysisResponse(parsed.data));
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const parsed = await parseBodyRequest(request);

  if (!parsed.success) {
    return Response.json(
      {
        ok: false,
        error: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  return Response.json(await buildCartAnalysisResponse(parsed.data));
};