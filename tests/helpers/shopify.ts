export function createShopifyWebhookHeaders(overrides: Record<string, string> = {}): Record<string, string> {
  return {
    "x-shopify-topic": "products/update",
    "x-shopify-shop-domain": "example.myshopify.com",
    ...overrides,
  };
}