import { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { handleProductWebhook } from "../lib/knowledge-graph/ingestion";
import { createWebhookEvent, markWebhookProcessed } from "../lib/db/queries";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { topic, shop, admin, payload, webhookId } = await authenticate.webhook(request);

  if (!admin) {
    return new Response(null, { status: 401 }); // The webhook couldn't be verified
  }

  // Idempotent webhook event creation
  const event = await createWebhookEvent(shop, webhookId, topic, payload as Record<string, unknown>);
  if (event.processingStatus === "DUPLICATE") {
    console.log(`[Webhooks] Ignored duplicate event ${webhookId} for ${topic}@${shop}`);
    return new Response(null, { status: 200 }); // Prevent double execution
  }

  // Handle the webhook logic
  try {
    // Process asynchronously according to FR-004 logic
    // Using waitUntil allows edge functions or Node.js to keep execution open while HTTP response leaves
    handleProductWebhook(shop, payload as Parameters<typeof handleProductWebhook>[1], topic, admin)
       .then(() => markWebhookProcessed(webhookId))
       .catch((error) => console.error(`[Webhooks] Failed to process ${topic} for ${webhookId}:`, error));
       
    // Remix/React Router context on Cloudflare doesn't strictly have waitUntil natively without context.
    // In standard node environments it runs anyway.
    
    return new Response(null, { status: 200 });
  } catch (error) {
    console.error(`[Webhooks] Error initializing webhook update:`, error);
    return new Response(null, { status: 500 });
  }
};


