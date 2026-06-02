import { z } from "zod";

export const StorefrontChatSurfaceSchema = z.enum(["cart_drawer", "cart_page"]);

export const StorefrontCartLineSchema = z.object({
  lineId: z.string().min(1).optional(),
  productId: z.string().min(1),
  productTitle: z.string().min(1).optional(),
  variantId: z.string().min(1).optional(),
  variantTitle: z.string().min(1).optional(),
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
    productTitle: z.string().min(1).optional(),
    variantId: z.string().min(1).optional(),
    variantTitle: z.string().min(1).optional(),
    title: z.string().min(1),
    action: z.enum(["keep", "add", "remove", "swap", "size_adjust"]),
    priorityLabel: z.enum(["high", "medium", "low"]),
    reason: z.string().min(1),
    shopperOutcome: z.string().min(1).optional(),
    safetyCritical: z.boolean().default(false),
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

export const BudgetOptimizationBlockSchema = z.object({
  blockId: z.string().min(1),
  type: z.literal("budget_optimization"),
  title: z.string().min(1),
  summary: z.string().min(1),
  priority: z.number().int().nonnegative(),
  status: z.enum(["within_budget", "optimized", "constraint_blocked", "insufficient_candidates"]),
  currencyCode: z.string().length(3).default("USD"),
  baselineSubtotal: z.number().nonnegative(),
  targetBudgetAmount: z.number().positive(),
  projectedSubtotal: z.number().nonnegative(),
  projectedGapAmount: z.number().nonnegative(),
  constraints: z.array(z.string().min(1)).default([]),
  candidates: z.array(z.object({
    candidateId: z.string().min(1),
    changeType: z.enum(["swap", "remove", "downgrade", "defer"]),
    sourceProductId: z.string().min(1),
    targetProductId: z.string().min(1).optional(),
    estimatedSavings: z.number().nonnegative(),
    safetyCriticalImpact: z.enum(["none", "reduced_protection", "critical_removal"]),
    rationale: z.string().min(1),
  })).default([]),
});

export const StructuredGuidanceBlockSchema = z.discriminatedUnion("type", [
  RecommendationListBlockSchema,
  ComparisonTableBlockSchema,
  SizeSummaryBlockSchema,
  FallbackNoticeBlockSchema,
  BudgetOptimizationBlockSchema,
]);

export const StorefrontChatMessageSchema = z.object({
  role: z.enum(["user", "assistant", "system"]),
  content: z.string().min(1),
});

export const CartToolActionTypeSchema = z.enum([
  "add",
  "remove",
  "change_quantity",
  "swap_variant",
  "comparison_select",
  "budget_optimization_select",
]);

export const CartToolActionPayloadSchema = z.discriminatedUnion("actionType", [
  z.object({
    actionType: z.literal("add"),
    merchandiseId: z.string().min(1),
    quantity: z.coerce.number().int().min(1),
  }),
  z.object({
    actionType: z.literal("remove"),
    lineId: z.string().min(1),
  }),
  z.object({
    actionType: z.literal("change_quantity"),
    lineId: z.string().min(1),
    quantity: z.coerce.number().int().min(1),
  }),
  z.object({
    actionType: z.literal("swap_variant"),
    lineId: z.string().min(1),
    newMerchandiseId: z.string().min(1),
    quantity: z.coerce.number().int().min(1).optional(),
  }),
  z.object({
    actionType: z.literal("comparison_select"),
    comparisonContextId: z.string().min(1),
    recommended: z.object({
      productId: z.string().min(1),
      variantId: z.string().min(1).optional(),
      title: z.string().min(1),
    }),
    alternatives: z.array(z.object({
      productId: z.string().min(1),
      variantId: z.string().min(1).optional(),
      title: z.string().min(1),
    })).default([]),
  }),
  z.object({
    actionType: z.literal("budget_optimization_select"),
    optimizationContextId: z.string().min(1),
    candidateIds: z.array(z.string().min(1)).default([]),
    projectedSubtotal: z.number().nonnegative().optional(),
    projectedGapAmount: z.number().nonnegative().optional(),
  }),
]);

export const CartToolActionStatusSchema = z.enum([
  "proposed",
  "approved",
  "declined",
  "expired",
  "executing",
  "executed",
  "failed",
]);

export const CartToolActionSchema = z.object({
  actionId: z.string().min(1),
  toolName: z.enum(["addToCart", "removeFromCart", "changeQuantity", "swapVariant", "compareProducts", "optimizeBudget"]),
  shop: z.string().min(1),
  sessionKey: z.string().min(1),
  cartId: z.string().min(1).optional(),
  payload: CartToolActionPayloadSchema,
  preview: z.object({
    before: z.string().min(1).optional(),
    after: z.string().min(1).optional(),
    deltaPrice: z.string().min(1).optional(),
  }).optional(),
  confirmationToken: z.string().min(1),
  expiresAt: z.string().datetime(),
});

export const CartToolActionStatusEventSchema = z.object({
  actionId: z.string().min(1),
  status: CartToolActionStatusSchema,
  summary: z.string().min(1).optional(),
  cart: z.object({
    cartId: z.string().min(1).optional(),
    currencyCode: z.string().length(3).default("USD"),
    items: z.array(StorefrontCartLineSchema).default([]),
    subtotal: z.string().min(1).optional(),
  }).optional(),
});

export const ProductComparisonRequestSchema = z.object({
  requestId: z.string().min(1),
  shop: z.string().min(1),
  sessionKey: z.string().min(1),
  productRefs: z.array(z.string().min(1)).min(2).max(5),
  dimensions: z.array(z.string().min(1)).default([]),
  requestedAt: z.string().datetime(),
});

export const ProductComparisonSnapshotSchema = z.object({
  productId: z.string().min(1),
  variantId: z.string().min(1).optional(),
  title: z.string().min(1),
  imageUrl: z.string().url().optional(),
  price: z.string().min(1),
  currencyCode: z.string().length(3).default("USD"),
  availability: z.enum(["available", "unavailable", "limited", "unknown"]),
  attributes: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])).default({}),
});

export const ProductComparisonDimensionSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  values: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null(), z.literal("not_available")])),
});

export const ProductComparisonResultSchema = z.object({
  comparisonContextId: z.string().min(1),
  requestId: z.string().min(1),
  generatedAt: z.string().datetime(),
  freshness: z.object({
    priceCheckedAt: z.string().datetime(),
    availabilityCheckedAt: z.string().datetime(),
  }),
  products: z.array(ProductComparisonSnapshotSchema).min(2),
  dimensions: z.array(ProductComparisonDimensionSchema).min(1),
  recommendation: z.object({
    recommendedProductId: z.string().min(1),
    rationale: z.string().min(1),
    confidence: z.number().min(0).max(1),
  }).optional(),
});

export const ProductComparisonProposedSchema = z.object({
  comparisonContextId: z.string().min(1),
  request: ProductComparisonRequestSchema,
});

export const ProductComparisonErrorSchema = z.object({
  comparisonContextId: z.string().min(1),
  code: z.enum([
    "INSUFFICIENT_PRODUCTS",
    "DUPLICATE_PRODUCTS",
    "UNRESOLVED_PRODUCT_REF",
    "UNAVAILABLE_VARIANT",
    "PARTIAL_DATA",
    "UPSTREAM_RATE_LIMIT",
    "UNKNOWN",
  ]),
  message: z.string().min(1),
  retryable: z.boolean().default(true),
  suggestedNextStep: z.string().min(1).optional(),
});

export const BudgetOptimizationRequestSchema = z.object({
  requestId: z.string().min(1),
  shop: z.string().min(1),
  sessionKey: z.string().min(1),
  targetBudgetAmount: z.number().positive(),
  currencyCode: z.string().length(3).default("USD"),
  requestedAt: z.string().datetime(),
});

export const BudgetOptimizationCandidateSchema = z.object({
  candidateId: z.string().min(1),
  changeType: z.enum(["swap", "remove", "downgrade", "defer"]),
  sourceLineId: z.string().min(1),
  sourceProductId: z.string().min(1),
  sourceVariantId: z.string().min(1).optional(),
  targetProductId: z.string().min(1).optional(),
  targetVariantId: z.string().min(1).optional(),
  estimatedSavings: z.number().nonnegative(),
  safetyCriticalImpact: z.enum(["none", "reduced_protection", "critical_removal"]),
  rationale: z.string().min(1),
  disciplineFitScore: z.number().min(0).max(1),
  availability: z.enum(["available", "unavailable", "unknown"]),
});

export const BudgetOptimizationResultSchema = z.object({
  optimizationContextId: z.string().min(1),
  requestId: z.string().min(1),
  generatedAt: z.string().datetime(),
  baselineSubtotal: z.number().nonnegative(),
  targetBudgetAmount: z.number().positive(),
  projectedSubtotal: z.number().nonnegative(),
  projectedGapAmount: z.number().nonnegative(),
  status: z.enum(["within_budget", "optimized", "constraint_blocked", "insufficient_candidates"]),
  candidates: z.array(BudgetOptimizationCandidateSchema),
  constraints: z.array(z.string().min(1)).default([]),
  freshness: z.object({
    priceCheckedAt: z.string().datetime(),
    availabilityCheckedAt: z.string().datetime(),
  }),
});

export const BudgetOptimizationProposedSchema = z.object({
  optimizationContextId: z.string().min(1),
  request: BudgetOptimizationRequestSchema,
});

export const BudgetOptimizationErrorSchema = z.object({
  optimizationContextId: z.string().min(1),
  code: z.enum([
    "INVALID_TARGET_BUDGET",
    "EMPTY_CART",
    "NO_ELIGIBLE_CANDIDATES",
    "CONSTRAINT_BLOCKED",
    "UPSTREAM_RATE_LIMIT",
    "UNKNOWN",
  ]),
  message: z.string().min(1),
  retryable: z.boolean().default(true),
  suggestedNextStep: z.string().min(1).optional(),
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
    type: z.literal("tool-action-proposed"),
    action: CartToolActionSchema,
  }),
  z.object({
    type: z.literal("tool-action-status"),
    actionId: z.string().min(1),
    status: CartToolActionStatusSchema,
    summary: z.string().min(1).optional(),
    cart: CartToolActionStatusEventSchema.shape.cart.optional(),
  }),
  z.object({
    type: z.literal("comparison.proposed"),
    comparison: ProductComparisonProposedSchema,
  }),
  z.object({
    type: z.literal("comparison.result"),
    comparison: ProductComparisonResultSchema,
  }),
  z.object({
    type: z.literal("comparison.error"),
    error: ProductComparisonErrorSchema,
  }),
  z.object({
    type: z.literal("budget-optimization.proposed"),
    optimization: BudgetOptimizationProposedSchema,
  }),
  z.object({
    type: z.literal("budget-optimization.result"),
    optimization: BudgetOptimizationResultSchema,
  }),
  z.object({
    type: z.literal("budget-optimization.error"),
    error: BudgetOptimizationErrorSchema,
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
export type CartToolActionType = z.infer<typeof CartToolActionTypeSchema>;
export type CartToolActionPayload = z.infer<typeof CartToolActionPayloadSchema>;
export type CartToolActionStatus = z.infer<typeof CartToolActionStatusSchema>;
export type CartToolAction = z.infer<typeof CartToolActionSchema>;
export type CartToolActionStatusEvent = z.infer<typeof CartToolActionStatusEventSchema>;
export type ProductComparisonRequest = z.infer<typeof ProductComparisonRequestSchema>;
export type ProductComparisonSnapshot = z.infer<typeof ProductComparisonSnapshotSchema>;
export type ProductComparisonDimension = z.infer<typeof ProductComparisonDimensionSchema>;
export type ProductComparisonResult = z.infer<typeof ProductComparisonResultSchema>;
export type ProductComparisonProposed = z.infer<typeof ProductComparisonProposedSchema>;
export type ProductComparisonError = z.infer<typeof ProductComparisonErrorSchema>;
export type BudgetOptimizationRequest = z.infer<typeof BudgetOptimizationRequestSchema>;
export type BudgetOptimizationCandidate = z.infer<typeof BudgetOptimizationCandidateSchema>;
export type BudgetOptimizationResult = z.infer<typeof BudgetOptimizationResultSchema>;
export type BudgetOptimizationProposed = z.infer<typeof BudgetOptimizationProposedSchema>;
export type BudgetOptimizationError = z.infer<typeof BudgetOptimizationErrorSchema>;
export type StorefrontChatRequest = z.infer<typeof StorefrontChatRequestSchema>;
export type StorefrontChatStreamPart = z.infer<typeof StorefrontChatStreamPartSchema>;