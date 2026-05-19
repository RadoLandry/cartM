import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { handleProductWebhook } from "../lib/knowledge-graph/ingestion";
import { createWebhookEvent, markWebhookProcessed } from "../lib/db/queries";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { topic, shop, admin, payload, webhookId } = await authenticate.webhook(request);

  if (!admin) {
    return new Response(null, { status: 401 }); 
  }

  // Idempotent tracking
  const event = await createWebhookEvent(shop, webhookId, topic, payload as Record<string, unknown>);
  if (event.processingStatus === "DUPLICATE") {
    return new Response(null, { status: 200 }); 
  }

  try {
    handleProductWebhook(shop, payload as Parameters<typeof handleProductWebhook>[1], topic, admin)
       .then(() => markWebhookProcessed(webhookId))
       .catch((error) => console.error(`[Webhooks] Failed to process ${topic} for ${webhookId}:`, error));
       
    return new Response(null, { status: 200 });
  } catch (error) {
    console.error(`[Webhooks] Error initializing webhook update:`, error);
    return new Response(null, { status: 500 });
  }
};


