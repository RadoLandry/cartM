import type {
  StorefrontCartLine,
  StorefrontChatSurface,
  StorefrontGuidancePayload,
  StorefrontIntegrationFeatureFlags,
} from "../../app/lib/ai/schemas";

export interface StorefrontCartSnapshot {
  cartId?: string;
  currencyCode: string;
  items: StorefrontCartLine[];
}

export interface StorefrontChatMountConfig {
  shop: string;
  surface: StorefrontChatSurface;
  placementId?: string;
  appBaseUrl?: string;
  bootstrapPath?: string;
  bootstrapUrl: string;
  recommendationsPath?: string;
  cart: StorefrontCartSnapshot;
  labels?: {
    launcherLabel?: string;
    panelTitle?: string;
    assistantGreeting?: string;
    fallbackMessage?: string;
  };
  features?: StorefrontIntegrationFeatureFlags;
  guidance?: StorefrontGuidancePayload;
  launcherLabel?: string;
  assistantGreeting?: string;
  panelTitle?: string;
}