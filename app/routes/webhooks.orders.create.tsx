import type { ActionFunctionArgs } from "react-router";

import { updateCustomerPurchaseSummary } from "../lib/db/queries";
import { authenticate } from "../shopify.server";

interface OrderWebhookLineItem {
  title?: string;
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

  return new Response(null, { status: 200 });
};