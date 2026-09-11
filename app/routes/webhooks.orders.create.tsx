import type { ActionFunctionArgs } from "react-router";

import { getReplenishmentActionTargets, updateCustomerPurchaseSummary, upsertCustomerPurchaseSnapshot } from "../lib/db/queries";
import { authenticate } from "../shopify.server";

interface OrderWebhookLineItem {
  title?: string;
  variant_title?: string;
  quantity?: number;
  price?: string;
  product_id?: number | string;
  admin_graphql_api_id?: string;
  variant_id?: number | string;
  variant_admin_graphql_api_id?: string;
}

interface OrderWebhookPayload {
  id?: number | string;
  processed_at?: string;
  current_total_price?: string;
  currency?: string;
  line_items?: OrderWebhookLineItem[];
  customer?: {
    admin_graphql_api_id?: string;
    id?: number | string;
  };
}

function toShopifyCustomerId(payload: OrderWebhookPayload): string | null {
  const graphqlId = payload.customer?.admin_graphql_api_id;
  if (typeof graphqlId === "string" && graphqlId.length > 0) {
    return graphqlId;
  }

  const numericId = payload.customer?.id;
  if (typeof numericId === "number" || typeof numericId === "string") {
    return `gid://shopify/Customer/${numericId}`;
  }

  return null;
}

function toShopifyProductId(lineItem: OrderWebhookLineItem): string | null {
  if (typeof lineItem.admin_graphql_api_id === "string" && lineItem.admin_graphql_api_id.length > 0) {
    return lineItem.admin_graphql_api_id;
  }

  if (lineItem.product_id !== undefined) {
    return `gid://shopify/Product/${lineItem.product_id}`;
  }

  return null;
}

function toShopifyVariantId(lineItem: OrderWebhookLineItem): string | undefined {
  if (typeof lineItem.variant_admin_graphql_api_id === "string" && lineItem.variant_admin_graphql_api_id.length > 0) {
    return lineItem.variant_admin_graphql_api_id;
  }

  if (lineItem.variant_id !== undefined) {
    return `gid://shopify/ProductVariant/${lineItem.variant_id}`;
  }

  return undefined;
}

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, shop, payload } = await authenticate.webhook(request);

  if (!admin) {
    return new Response(null, { status: 401 });
  }

  const orderPayload = payload as OrderWebhookPayload;
  const shopifyCustomerId = toShopifyCustomerId(orderPayload);

  if (!shopifyCustomerId) {
    return new Response(null, { status: 200 });
  }

  await updateCustomerPurchaseSummary(shop, shopifyCustomerId, {
    ...(orderPayload.id !== undefined ? { orderId: String(orderPayload.id) } : {}),
    ...(orderPayload.processed_at ? { processedAt: new Date(orderPayload.processed_at) } : {}),
    ...(orderPayload.current_total_price
      ? { totalSpent: Number(orderPayload.current_total_price) }
      : {}),
    ...(orderPayload.currency ? { currencyCode: orderPayload.currency } : {}),
    productTitles: (orderPayload.line_items ?? [])
      .map((lineItem) => lineItem.title)
      .filter((title): title is string => typeof title === "string" && title.length > 0),
  });

  const lineItems = orderPayload.line_items ?? [];
  const productIds = lineItems
    .map(toShopifyProductId)
    .filter((productId): productId is string => productId !== null);

  if (productIds.length > 0) {
    const categoryTagsByProductId = await getReplenishmentActionTargets(shop, productIds);
    const purchasedAt = orderPayload.processed_at ? new Date(orderPayload.processed_at) : new Date();

    await Promise.all(
      lineItems.map((lineItem) => {
        const productId = toShopifyProductId(lineItem);
        const categoryTag = productId ? categoryTagsByProductId.get(productId)?.categoryTag : undefined;

        if (!productId || !categoryTag) {
          return Promise.resolve();
        }

        return upsertCustomerPurchaseSnapshot({
          shop,
          shopifyCustomerId,
          productId,
          variantId: toShopifyVariantId(lineItem),
          categoryTag,
          purchasedAt,
          ...(orderPayload.id !== undefined ? { orderId: String(orderPayload.id) } : {}),
          quantity: lineItem.quantity ?? 1,
          title: lineItem.title ?? "Item",
          ...(lineItem.variant_title ? { variantTitle: lineItem.variant_title } : {}),
          ...(orderPayload.currency ? { currencyCode: orderPayload.currency } : {}),
          ...(lineItem.price ? { unitPrice: Number(lineItem.price) } : {}),
        });
      }),
    );
  }

  return new Response(null, { status: 200 });
};