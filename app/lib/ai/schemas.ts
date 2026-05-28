import { z } from "zod";

export const StorefrontChatSurfaceSchema = z.enum(["cart_drawer", "cart_page"]);

export const StorefrontCartLineSchema = z.object({
  productId: z.string().min(1),
  variantId: z.string().min(1).optional(),
  quantity: z.coerce.number().int().min(1).default(1),
});

export const StorefrontChatBootstrapRequestSchema = z.object({
  shop: z.string().min(1),
  cartId: z.string().min(1).optional(),
  surface: StorefrontChatSurfaceSchema,
  sessionId: z.string().min(1),
  currencyCode: z.string().length(3).default("USD"),
});

export const StorefrontConversationLimitsSchema = z.object({
  maxMessages: z.number().int().positive(),
  maxInputCharacters: z.number().int().positive(),
});

export const StorefrontChatBootstrapSchema = z.object({
  shop: z.string().min(1),
  cartId: z.string().min(1).optional(),
  sessionKey: z.string().min(1),
  streamToken: z.string().min(1),
  expiresAt: z.string().datetime(),
  chatUrl: z.string().url(),
  conversationLimits: StorefrontConversationLimitsSchema,
});

export const StorefrontChatBootstrapResponseSchema = z.object({
  ok: z.literal(true),
  bootstrap: StorefrontChatBootstrapSchema,
});

export const RecommendationListBlockSchema = z.object({
  blockId: z.string().min(1),
  type: z.literal("recommendation_list"),
  title: z.string().min(1),
  summary: z.string().min(1),
  priority: z.number().int().nonnegative(),
  items: z.array(z.object({
    productId: z.string().min(1).optional(),
    variantId: z.string().min(1).optional(),
    title: z.string().min(1),
    reason: z.string().min(1),
    priceLabel: z.string().min(1).optional(),
    availability: z.enum(["available", "unavailable", "unknown"]).optional(),
  })),
});

export const ComparisonTableBlockSchema = z.object({
  blockId: z.string().min(1),
  type: z.literal("comparison_table"),
  title: z.string().min(1),
  summary: z.string().min(1),
  priority: z.number().int().nonnegative(),
  columns: z.array(z.object({
    key: z.string().min(1),
    title: z.string().min(1),
  })).min(1),
  rows: z.array(z.object({
    label: z.string().min(1),
    values: z.array(z.string()),
  })),
});

export const SizeSummaryBlockSchema = z.object({
  blockId: z.string().min(1),
  type: z.literal("size_summary"),
  title: z.string().min(1),
  summary: z.string().min(1),
  priority: z.number().int().nonnegative(),
  confidence: z.number().min(0).max(1),
  highlights: z.array(z.string().min(1)).min(1),
});

export const FallbackNoticeBlockSchema = z.object({
  blockId: z.string().min(1),
  type: z.literal("fallback_notice"),
  title: z.string().min(1),
  summary: z.string().min(1),
  priority: z.number().int().nonnegative(),
});

export const StructuredGuidanceBlockSchema = z.discriminatedUnion("type", [
  RecommendationListBlockSchema,
  ComparisonTableBlockSchema,
  SizeSummaryBlockSchema,
  FallbackNoticeBlockSchema,
]);

export const StorefrontChatMessageSchema = z.object({
  role: z.enum(["user", "assistant", "system"]),
  content: z.string().min(1),
});

export const StorefrontChatRequestSchema = z.object({
  shop: z.string().min(1),
  sessionKey: z.string().min(1),
  streamToken: z.string().min(1),
  cart: z.object({
    cartId: z.string().min(1).optional(),
    currencyCode: z.string().length(3).default("USD"),
    items: z.array(StorefrontCartLineSchema).default([]),
  }),
  messages: z.array(StorefrontChatMessageSchema).min(1),
});

export const StorefrontChatStreamPartSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("text-delta"),
    text: z.string(),
  }),
  z.object({
    type: z.literal("guidance-block"),
    block: StructuredGuidanceBlockSchema,
  }),
  z.object({
    type: z.literal("message-complete"),
    messageId: z.string().min(1),
  }),
  z.object({
    type: z.literal("error"),
    code: z.string().min(1),
    message: z.string().min(1),
  }),
]);

export type StorefrontChatBootstrapRequest = z.infer<typeof StorefrontChatBootstrapRequestSchema>;
export type StorefrontChatSurface = z.infer<typeof StorefrontChatSurfaceSchema>;
export type StorefrontCartLine = z.infer<typeof StorefrontCartLineSchema>;
export type StorefrontConversationLimits = z.infer<typeof StorefrontConversationLimitsSchema>;
export type StorefrontChatBootstrap = z.infer<typeof StorefrontChatBootstrapSchema>;
export type StorefrontChatBootstrapResponse = z.infer<typeof StorefrontChatBootstrapResponseSchema>;
export type StructuredGuidanceBlock = z.infer<typeof StructuredGuidanceBlockSchema>;
export type StorefrontChatRequest = z.infer<typeof StorefrontChatRequestSchema>;
export type StorefrontChatStreamPart = z.infer<typeof StorefrontChatStreamPartSchema>;