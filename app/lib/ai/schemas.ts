import { z } from "zod";

export const StorefrontChatSurfaceSchema = z.enum(["cart_drawer", "cart_page"]);

export const StorefrontIntegrationPlacementStatusSchema = z.enum(["enabled", "disabled", "unavailable"]);
export const StorefrontIntegrationPlacementStrategySchema = z.enum([
  "app_embed",
  "app_block",
  "checkout_extension",
  "function_projection",
]);

export const StorefrontIntegrationFeatureFlagsSchema = z.object({
  showRecommendations: z.boolean().default(true),
  showKitCompleteness: z.boolean().default(true),
  showSizeWarnings: z.boolean().default(true),
  showChatEntry: z.boolean().default(true),
  showReasonTags: z.boolean().default(true),
});

export const StorefrontIntegrationLabelsSchema = z.object({
  launcherLabel: z.string().min(1).optional(),
  panelTitle: z.string().min(1).optional(),
  assistantGreeting: z.string().min(1).optional(),
  fallbackMessage: z.string().min(1).optional(),
});

export const StorefrontCartLineSchema = z.object({
  lineId: z.string().min(1).optional(),
  productId: z.string().min(1),
  productTitle: z.string().min(1).optional(),
  variantId: z.string().min(1).optional(),
  variantTitle: z.string().min(1).optional(),
  quantity: z.coerce.number().int().min(1).default(1),
});

export const StorefrontCartSnapshotSchema = z.object({
  cartId: z.string().min(1).optional(),
  currencyCode: z.string().length(3).default("USD"),
  items: z.array(StorefrontCartLineSchema).default([]),
  subtotal: z.string().min(1).optional(),
});

export const StorefrontWidgetMountConfigSchema = z.object({
  shop: z.string().min(1),
  surface: StorefrontChatSurfaceSchema,
  placementId: z.string().min(1).default("cartmind-default"),
  appBaseUrl: z.string().url().optional(),
  bootstrapPath: z.string().min(1).default("/apps/cartmind-chat/chat-bootstrap"),
  bootstrapUrl: z.string().min(1).optional(),
  recommendationsPath: z.string().min(1).default("/api/ai/recommendations"),
  cart: StorefrontCartSnapshotSchema,
  labels: StorefrontIntegrationLabelsSchema.default({}),
  features: StorefrontIntegrationFeatureFlagsSchema.default({
    showRecommendations: true,
    showKitCompleteness: true,
    showSizeWarnings: true,
    showChatEntry: true,
    showReasonTags: true,
  }),
});

export const StorefrontIntegrationPlacementSchema = z.object({
  placementId: z.string().min(1),
  shop: z.string().min(1),
  surface: StorefrontChatSurfaceSchema.or(z.literal("checkout")),
  status: StorefrontIntegrationPlacementStatusSchema,
  strategy: StorefrontIntegrationPlacementStrategySchema,
  priority: z.number().int().nonnegative().default(0),
  settings: z.record(z.string(), z.unknown()).default({}),
  updatedAt: z.string().datetime(),
});

export const StorefrontGuidanceRecommendationSchema = z.object({
  guidanceId: z.string().min(1),
  title: z.string().min(1),
  message: z.string().min(1),
  priority: z.number().int().nonnegative().default(0),
  action: z.enum(["keep", "add", "remove", "swap", "size_adjust", "open_chat"]).default("open_chat"),
  productId: z.string().min(1).optional(),
  variantId: z.string().min(1).optional(),
  priceLabel: z.string().min(1).optional(),
});

export const StorefrontGuidanceKitCompletenessSchema = z.object({
  discipline: z.string().min(1).optional(),
  score: z.number().min(0).max(1),
  missingCount: z.number().int().nonnegative(),
  summary: z.string().min(1),
});

export const StorefrontGuidanceSizeWarningSchema = z.object({
  warningId: z.string().min(1),
  title: z.string().min(1),
  message: z.string().min(1),
  severity: z.enum(["info", "warning", "critical"]),
  relatedLineIds: z.array(z.string().min(1)).default([]),
});

export const StorefrontGuidancePayloadSchema = z.object({
  payloadId: z.string().min(1),
  generatedAt: z.string().datetime(),
  cartId: z.string().min(1).optional(),
  recommendations: z.array(StorefrontGuidanceRecommendationSchema).default([]),
  kitCompleteness: StorefrontGuidanceKitCompletenessSchema.optional(),
  sizeWarnings: z.array(StorefrontGuidanceSizeWarningSchema).default([]),
  chatEntry: z.object({
    available: z.boolean(),
    bootstrapPath: z.string().min(1).optional(),
    reasonUnavailable: z.string().min(1).optional(),
  }).optional(),
  fallbackNotice: z.object({
    title: z.string().min(1),
    message: z.string().min(1),
  }).optional(),
});

export const StorefrontCartSyncSourceSchema = z.enum([
  "initial_config",
  "cart_js",
  "fetch_intercept",
  "mutation_observer",
  "fallback_poll",
]);

export const StorefrontGuidanceRequestSchema = z.object({
  shop: z.string().min(1),
  surface: StorefrontChatSurfaceSchema,
  placementId: z.string().min(1),
  sessionId: z.string().min(1),
  cart: StorefrontCartSnapshotSchema,
  syncSource: StorefrontCartSyncSourceSchema,
  requestedAt: z.string().datetime(),
});

export const StorefrontGuidanceResponseSchema = z.discriminatedUnion("ok", [
  z.object({
    ok: z.literal(true),
    payload: StorefrontGuidancePayloadSchema,
  }),
  z.object({
    ok: z.literal(false),
    error: z.enum(["invalid_request", "guidance_unavailable", "cart_snapshot_stale", "rate_limited", "unknown"]),
    retryAfterMs: z.number().int().positive().optional(),
  }),
]);

export const CheckoutGuidanceItemSchema = z.object({
  guidanceId: z.string().min(1),
  type: z.enum(["size_warning", "bundle_offer", "kit_nudge"]),
  severity: z.enum(["info", "warning", "critical"]),
  priority: z.number().int(),
  title: z.string().min(1),
  message: z.string().min(1),
  relatedLineIds: z.array(z.string().min(1)).default([]),
  action: z.object({
    type: z.enum(["review_cart", "change_size", "add_item", "acknowledge"]),
    label: z.string().min(1),
    target: z.string().min(1).optional(),
  }).optional(),
  expiresAt: z.string().datetime().optional(),
});

export const CheckoutGuidancePlacementSchema = z.enum([
  "purchase_checkout_block",
  "information_step",
  "shipping_step",
  "payment_step",
  "unknown",
]);

export const CheckoutGuidanceFeedSchema = z.object({
  shop: z.string().min(1),
  guidanceId: z.string().min(1),
  checkoutId: z.string().min(1).optional(),
  cartToken: z.string().min(1).optional(),
  generatedAt: z.string().datetime(),
  placement: CheckoutGuidancePlacementSchema.default("purchase_checkout_block"),
  items: z.array(CheckoutGuidanceItemSchema).default([]),
  projectionVersion: z.number().int().nonnegative(),
});

export const BundleStorefrontOutcomeSchema = z.object({
  outcomeId: z.string().min(1),
  ruleId: z.string().min(1),
  ruleVersion: z.number().int().nonnegative(),
  status: z.enum(["qualified", "partial", "ineligible", "expired", "conflict"]),
  priority: z.number().int().nonnegative(),
  qualifiedLineIds: z.array(z.string().min(1)).default([]),
  missingRequirements: z.array(z.object({
    productId: z.string().min(1).optional(),
    variantId: z.string().min(1).optional(),
    quantityRequired: z.number().int().min(1),
    quantityPresent: z.number().int().min(0),
    label: z.string().min(1).optional(),
  })).default([]),
  discount: z.object({
    type: z.enum(["percentage", "fixed"]),
    value: z.number().positive(),
    currencyCode: z.string().length(3).optional(),
    displayLabel: z.string().min(1),
  }).optional(),
  presentation: z.object({
    bundleTitle: z.string().min(1),
    componentSummary: z.string().min(1),
    savingsSummary: z.string().min(1).optional(),
    lineMergeEligible: z.boolean(),
  }).optional(),
  expiresAt: z.string().datetime().optional(),
});

export const IntegrationHealthEventSchema = z.object({
  eventId: z.string().min(1),
  shop: z.string().min(1),
  sessionId: z.string().min(1).optional(),
  eventType: z.enum([
    "widget_rendered",
    "widget_failed",
    "cart_sync_started",
    "cart_sync_completed",
    "cart_sync_failed",
    "guidance_impressed",
    "checkout_guidance_rendered",
    "bundle_outcome_evaluated",
    "fallback_used",
  ]),
  surface: StorefrontChatSurfaceSchema.or(z.literal("checkout")).or(z.literal("function")),
  cartToken: z.string().min(1).optional(),
  details: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])).default({}),
  createdAt: z.string().datetime(),
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
    evidenceTags: z.array(z.enum([
      "profile",
      "history",
      "size",
      "kit",
      "threshold",
      "availability",
      "compatibility",
      "safety",
      "fallback",
    ])).default([]),
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
    changes: z.array(z.object({
      lineId: z.string().min(1),
      quantity: z.coerce.number().int().min(1),
    })).min(1).optional(),
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

export const CartMutationErrorCodeSchema = z.enum([
  "LINE_NOT_FOUND",
  "VARIANT_UNAVAILABLE",
  "QUANTITY_INVALID",
  "CART_CONFLICT",
  "MUTATION_ERROR",
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
  code: CartMutationErrorCodeSchema.optional(),
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

export const AIBehaviorToneSchema = z.enum([
  "PROFESSIONAL",
  "FRIENDLY",
  "CONCISE",
  "COACHING",
]);

export const AIBehaviorSafetyPrioritySchema = z.enum([
  "SAFETY_FIRST",
  "BALANCED",
]);

export const AIBehaviorVersionStatusSchema = z.enum(["ACTIVE", "ARCHIVED"]);

export const AIBehaviorConfigSchema = z.object({
  tone: AIBehaviorToneSchema,
  aggressiveness: z.number().min(0).max(1),
  safetyPriority: AIBehaviorSafetyPrioritySchema,
  customGuidance: z.string().max(2000).default(""),
  conversationStarters: z.array(z.string().trim().min(1).max(160)).max(8).default([]),
});

export const AIBehaviorVersionSummarySchema = z.object({
  id: z.string().min(1),
  versionNumber: z.number().int().nonnegative(),
  status: AIBehaviorVersionStatusSchema,
  publishedAt: z.string().datetime(),
  publishedBy: z.string().min(1),
});

export const AIBehaviorConfigResponseSchema = z.object({
  ok: z.literal(true),
  draft: AIBehaviorConfigSchema,
  active: AIBehaviorConfigSchema,
  versionToken: z.string().min(1),
  history: z.array(AIBehaviorVersionSummarySchema).default([]),
});

export const AIBehaviorDraftUpdateRequestSchema = z.object({
  versionToken: z.string().min(1),
  draft: AIBehaviorConfigSchema,
});

export const AIBehaviorDraftUpdateResponseSchema = z.object({
  ok: z.literal(true),
  draft: AIBehaviorConfigSchema,
  versionToken: z.string().min(1),
});

export const AIBehaviorPreviewScenarioSchema = z.object({
  scenarioId: z.string().min(1),
  shopperMessage: z.string().min(1),
});

export const AIBehaviorPreviewRequestSchema = z.object({
  draft: AIBehaviorConfigSchema,
  scenarios: z.array(AIBehaviorPreviewScenarioSchema).min(1).max(5),
});

export const AIBehaviorPreviewScenarioResultSchema = z.object({
  scenarioId: z.string().min(1),
  assistantResponse: z.string().min(1),
  policyChecks: z.object({
    safetyCompliant: z.boolean(),
    notes: z.array(z.string().min(1)).default([]),
  }),
});

export const AIBehaviorPreviewReadyResponseSchema = z.object({
  ok: z.literal(true),
  status: z.literal("READY"),
  previewRunId: z.string().min(1),
  results: z.array(AIBehaviorPreviewScenarioResultSchema),
});

export const AIBehaviorPreviewRunningResponseSchema = z.object({
  ok: z.literal(true),
  status: z.literal("RUNNING"),
  previewRunId: z.string().min(1),
});

export const AIBehaviorPublishRequestSchema = z.object({
  reason: z.string().max(500).optional(),
});

export const AIBehaviorRollbackRequestSchema = z.object({
  targetVersionId: z.string().min(1),
  reason: z.string().max(500).optional(),
});

export const AIBehaviorPublishRollbackResponseSchema = z.object({
  ok: z.literal(true),
  activeVersion: AIBehaviorVersionSummarySchema,
});

export const StorefrontChatRequestSchema = z.object({
  shop: z.string().min(1),
  sessionKey: z.string().min(1),
  streamToken: z.string().min(1),
  cart: z.object({
    cartId: z.string().min(1).optional(),
    currencyCode: z.string().length(3).default("USD"),
    items: z.array(StorefrontCartLineSchema).default([]),
    subtotal: z.string().min(1).optional(),
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
    code: CartToolActionStatusEventSchema.shape.code,
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
export type StorefrontCartSnapshot = z.infer<typeof StorefrontCartSnapshotSchema>;
export type StorefrontWidgetMountConfig = z.infer<typeof StorefrontWidgetMountConfigSchema>;
export type StorefrontIntegrationPlacement = z.infer<typeof StorefrontIntegrationPlacementSchema>;
export type StorefrontIntegrationFeatureFlags = z.infer<typeof StorefrontIntegrationFeatureFlagsSchema>;
export type StorefrontGuidancePayload = z.infer<typeof StorefrontGuidancePayloadSchema>;
export type StorefrontGuidanceRequest = z.infer<typeof StorefrontGuidanceRequestSchema>;
export type StorefrontGuidanceResponse = z.infer<typeof StorefrontGuidanceResponseSchema>;
export type StorefrontCartSyncSource = z.infer<typeof StorefrontCartSyncSourceSchema>;
export type CheckoutGuidanceItem = z.infer<typeof CheckoutGuidanceItemSchema>;
export type CheckoutGuidancePlacement = z.infer<typeof CheckoutGuidancePlacementSchema>;
export type CheckoutGuidanceFeed = z.infer<typeof CheckoutGuidanceFeedSchema>;
export type BundleStorefrontOutcome = z.infer<typeof BundleStorefrontOutcomeSchema>;
export type IntegrationHealthEvent = z.infer<typeof IntegrationHealthEventSchema>;
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
export type AIBehaviorTone = z.infer<typeof AIBehaviorToneSchema>;
export type AIBehaviorSafetyPriority = z.infer<typeof AIBehaviorSafetyPrioritySchema>;
export type AIBehaviorVersionStatus = z.infer<typeof AIBehaviorVersionStatusSchema>;
export type AIBehaviorConfig = z.infer<typeof AIBehaviorConfigSchema>;
export type AIBehaviorVersionSummary = z.infer<typeof AIBehaviorVersionSummarySchema>;
export type AIBehaviorConfigResponse = z.infer<typeof AIBehaviorConfigResponseSchema>;
export type AIBehaviorDraftUpdateRequest = z.infer<typeof AIBehaviorDraftUpdateRequestSchema>;
export type AIBehaviorDraftUpdateResponse = z.infer<typeof AIBehaviorDraftUpdateResponseSchema>;
export type AIBehaviorPreviewScenario = z.infer<typeof AIBehaviorPreviewScenarioSchema>;
export type AIBehaviorPreviewRequest = z.infer<typeof AIBehaviorPreviewRequestSchema>;
export type AIBehaviorPreviewScenarioResult = z.infer<typeof AIBehaviorPreviewScenarioResultSchema>;
export type AIBehaviorPreviewReadyResponse = z.infer<typeof AIBehaviorPreviewReadyResponseSchema>;
export type AIBehaviorPreviewRunningResponse = z.infer<typeof AIBehaviorPreviewRunningResponseSchema>;
export type AIBehaviorPublishRequest = z.infer<typeof AIBehaviorPublishRequestSchema>;
export type AIBehaviorRollbackRequest = z.infer<typeof AIBehaviorRollbackRequestSchema>;
export type AIBehaviorPublishRollbackResponse = z.infer<typeof AIBehaviorPublishRollbackResponseSchema>;
export type StorefrontChatRequest = z.infer<typeof StorefrontChatRequestSchema>;
export type StorefrontChatStreamPart = z.infer<typeof StorefrontChatStreamPartSchema>;