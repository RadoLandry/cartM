export type WebhookEventRecord = {
  eventId: string;
  topic: string;
};

export function createWebhookEventRecord(eventId: string, topic: string): WebhookEventRecord {
  return { eventId, topic };
}