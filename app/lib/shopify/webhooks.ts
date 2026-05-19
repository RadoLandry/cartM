import { createWebhookEvent, markWebhookProcessed } from "../db/queries";
import { WebhookProcessingStatus } from "@prisma/client";

export type WebhookEventRecord = {
  eventId: string;
  topic: string;
};

export async function processWebhookAsync(
  shop: string,
  eventId: string,
  topic: string,
  payload: Record<string, unknown>,
  handler: (payload: Record<string, unknown>) => Promise<void>
) {
  // 1. Persister l'événement et vérifier les doublons
  const event = await createWebhookEvent(shop, eventId, topic, payload);

  if (event.processingStatus === WebhookProcessingStatus.DUPLICATE) {
    console.log(`[Webhook] Duplicate event detected: ${eventId}`);
    return;
  }

  try {
    // 2. Exécuter le handler métier (ex: synchronisation produit)
    await handler(payload);

    // 3. Marquer comme traité
    await markWebhookProcessed(eventId);
  } catch (error) {
    console.error(`[Webhook] Error processing event ${eventId} (${topic}):`, error);
    // On pourrait ajouter une logique de retry ici
    throw error;
  }
}
