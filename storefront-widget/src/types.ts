export type {
  CartToolAction,
  CartToolActionPayload,
  CartToolActionStatus,
  StorefrontCartLine,
  StorefrontChatSurface,
  StructuredGuidanceBlock,
} from "../../app/lib/ai/schemas";

export interface StorefrontCartSnapshotItem {
  lineId?: string;
  productId: string;
  productTitle?: string;
  variantId?: string;
  variantTitle?: string;
  imageUrl?: string;
  discipline?: string;
  finalLinePrice?: number;
  quantity: number;
}

export interface StorefrontCartSnapshot {
  cartId?: string;
  currencyCode: string;
  items: StorefrontCartSnapshotItem[];
  subtotal?: string;
}