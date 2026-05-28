import type { StorefrontCartLine, StorefrontChatSurface } from "../../app/lib/ai/schemas";

export interface StorefrontCartSnapshot {
  cartId?: string;
  currencyCode: string;
  items: StorefrontCartLine[];
}

export interface StorefrontChatMountConfig {
  shop: string;
  surface: StorefrontChatSurface;
  bootstrapUrl: string;
  cart: StorefrontCartSnapshot;
  launcherLabel?: string;
  assistantGreeting?: string;
  panelTitle?: string;
}