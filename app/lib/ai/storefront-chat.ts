import type { StorefrontChatRequest, StorefrontChatStreamPart, StructuredGuidanceBlock } from "./schemas";
import { buildStorefrontChatSystemPrompt } from "./prompts";

export const CART_TOOL_ACTION_STATUSES = [
  "proposed",
  "approved",
  "declined",
  "expired",
  "executing",
  "executed",
  "failed",
] as const;

export type CartToolActionLifecycleStatus = (typeof CART_TOOL_ACTION_STATUSES)[number];

export const CART_TOOL_ACTION_TRANSITIONS: Record<CartToolActionLifecycleStatus, CartToolActionLifecycleStatus[]> = {
  proposed: ["approved", "declined", "expired"],
  approved: ["executing"],
  declined: [],
  expired: [],
  executing: ["executed", "failed"],
  executed: [],
  failed: [],
};

export interface CartToolActionLifecycleRecord {
  actionId: string;
  shop: string;
  sessionKey: string;
  cartId?: string;
  status: CartToolActionLifecycleStatus;
  payload: unknown;
  summary?: string;
  createdAt: string;
  updatedAt: string;
}

const actionLifecycleStore = new Map<string, CartToolActionLifecycleRecord>();

export function createCartToolActionRecord(input: {
  actionId: string;
  shop: string;
  sessionKey: string;
  cartId?: string;
  payload: unknown;
}) {
  const now = new Date().toISOString();
  const record: CartToolActionLifecycleRecord = {
    actionId: input.actionId,
    shop: input.shop,
    sessionKey: input.sessionKey,
    ...(input.cartId ? { cartId: input.cartId } : {}),
    status: "proposed",
    payload: input.payload,
    createdAt: now,
    updatedAt: now,
  };

  actionLifecycleStore.set(input.actionId, record);
  return record;
}

export function getCartToolActionRecord(actionId: string) {
  return actionLifecycleStore.get(actionId);
}

export function transitionCartToolActionRecord(input: {
  actionId: string;
  nextStatus: CartToolActionLifecycleStatus;
  summary?: string;
}) {
  const current = actionLifecycleStore.get(input.actionId);

  if (!current) {
    return { ok: false as const, code: "ACTION_NOT_FOUND", message: "No matching cart action was found." };
  }

  const allowed = CART_TOOL_ACTION_TRANSITIONS[current.status];
  if (!allowed.includes(input.nextStatus)) {
    return {
      ok: false as const,
      code: "INVALID_STATUS_TRANSITION",
      message: `Cannot transition action ${input.actionId} from ${current.status} to ${input.nextStatus}.`,
      current,
    };
  }

  const updated: CartToolActionLifecycleRecord = {
    ...current,
    status: input.nextStatus,
    ...(input.summary ? { summary: input.summary } : {}),
    updatedAt: new Date().toISOString(),
  };

  actionLifecycleStore.set(input.actionId, updated);
  return { ok: true as const, record: updated };
}

export function isCartToolActionTerminalStatus(status: CartToolActionLifecycleStatus) {
  return CART_TOOL_ACTION_TRANSITIONS[status].length === 0;
}

export function getCartToolActionIdempotentReplay(actionId: string) {
  const record = actionLifecycleStore.get(actionId);

  if (!record || !isCartToolActionTerminalStatus(record.status)) {
    return null;
  }

  return {
    actionId: record.actionId,
    status: record.status,
    summary: record.summary || "Action already resolved earlier.",
    idempotentReplay: true,
  };
}

type RecommendationItem = Extract<StructuredGuidanceBlock, { type: "recommendation_list" }>["items"][number];

function toDisplayName(item: StorefrontChatRequest["cart"]["items"][number], fallback: string) {
  return item.productTitle || fallback;
}

function buildActionableRecommendations(input: StorefrontChatRequest): RecommendationItem[] {
  const firstItem = input.cart.items[0];
  const primaryName = firstItem ? toDisplayName(firstItem, "your first cart item") : "your cart";

  const recommendations: RecommendationItem[] = [
    {
      productId: firstItem?.productId,
      productTitle: firstItem?.productTitle,
      variantId: firstItem?.variantId,
      variantTitle: firstItem?.variantTitle,
      title: `${primaryName}: keep current choice`,
      action: "keep",
      priorityLabel: "high",
      reason: "This option appears compatible with the rest of your current cart.",
      shopperOutcome: "Keeps your current setup stable while you fill gaps.",
      safetyCritical: true,
      availability: "available",
    },
    {
      title: "Protective add-on",
      action: "add",
      priorityLabel: "high",
      reason: `Add a protective accessory that matches ${primaryName} for safer usage.`,
      shopperOutcome: "Improves safety and confidence for immediate use.",
      safetyCritical: true,
      availability: "available",
    },
    {
      productId: firstItem?.productId,
      productTitle: firstItem?.productTitle,
      variantId: firstItem?.variantId,
      variantTitle: firstItem?.variantTitle,
      title: `${primaryName}: fit check`,
      action: "size_adjust",
      priorityLabel: "medium",
      reason: "Adjust size if you want extra room for layering or wraps.",
      shopperOutcome: "Reduces fit mismatch risk at checkout.",
      safetyCritical: false,
      availability: "unknown",
    },
  ];

  return recommendations
    .filter((item) => item.availability !== "unavailable")
    .sort((a, b) => {
      const rank = { high: 0, medium: 1, low: 2 } as const;
      if ((a.safetyCritical ? 0 : 1) !== (b.safetyCritical ? 0 : 1)) {
        return (a.safetyCritical ? 0 : 1) - (b.safetyCritical ? 0 : 1);
      }
      return rank[a.priorityLabel] - rank[b.priorityLabel];
    });
}

function buildFallbackBlock(summary: string): StructuredGuidanceBlock {
  return {
    blockId: "fallback-1",
    type: "fallback_notice",
    title: "Chat guidance",
    summary,
    priority: 1,
  };
}

function buildRecommendationBlock(input: StorefrontChatRequest): StructuredGuidanceBlock {
  const recommendations = buildActionableRecommendations(input);

  if (recommendations.length === 0) {
    return buildFallbackBlock("No currently available recommendations were found for this cart.");
  }

  return {
    blockId: "recommendation-1",
    type: "recommendation_list",
    title: "Recommended cart actions",
    summary: "Safety and compatibility actions are listed first.",
    priority: 1,
    items: recommendations,
  };
}

function buildComparisonBlock(input: StorefrontChatRequest): StructuredGuidanceBlock {
  const items = input.cart.items.slice(0, 2);

  return {
    blockId: "comparison-1",
    type: "comparison_table",
    title: "Quick comparison",
    summary: "A simple comparison of the items currently being considered.",
    priority: 1,
    columns: items.map((item, index) => ({
      key: item.productId,
      title: item.productTitle || `Option ${index + 1}`,
    })),
    rows: [
      {
        label: "Product",
        values: items.map((item) => item.productTitle || item.productId),
      },
      {
        label: "Quantity",
        values: items.map((item) => String(item.quantity)),
      },
    ],
  };
}

function buildSizeBlock(): StructuredGuidanceBlock {
  return {
    blockId: "size-1",
    type: "size_summary",
    title: "Sizing summary",
    summary: "Double-check fit-related selections before checkout.",
    priority: 1,
    confidence: 0.42,
    highlights: [
      "Compare the selected variant against the shopper's expected fit.",
      "If the cart mixes apparel and gear sizes, confirm they align before checkout.",
    ],
  };
}

export function buildStorefrontChatReply(input: StorefrontChatRequest) {
  const latestMessage = input.messages[input.messages.length - 1]?.content.toLowerCase() ?? "";
  const systemPrompt = buildStorefrontChatSystemPrompt(input);

  if (input.cart.items.length === 0) {
    return {
      text: `${systemPrompt} Your cart is empty right now, so I can only give general guidance. Add at least one item and I can give specific keep/add/remove/swap/size advice.`,
      guidanceBlocks: [buildFallbackBlock("Add at least one cart item, then ask what to keep, add, remove, swap, or resize.")],
    };
  }

  if (latestMessage.includes("missing") || latestMessage.includes("budget") || latestMessage.includes("optimiz")) {
    return {
      text: "Here are prioritized cart actions, with safety and compatibility first.",
      guidanceBlocks: [buildRecommendationBlock(input)],
    };
  }

  if (latestMessage.includes("compare")) {
    return {
      text: "Here is a quick comparison based on the items currently in the cart.",
      guidanceBlocks: [buildComparisonBlock(input)],
    };
  }

  if (latestMessage.includes("size") || latestMessage.includes("fit")) {
    return {
      text: "Here is the fit guidance I can infer from the current cart.",
      guidanceBlocks: [buildSizeBlock()],
    };
  }

  return {
    text: "Here is a relevant, cart-specific recommendation based on your current items.",
    guidanceBlocks: [buildRecommendationBlock(input)],
  };
}

export function buildStorefrontChatStreamParts(input: StorefrontChatRequest): StorefrontChatStreamPart[] {
  const reply = buildStorefrontChatReply(input);
  const messageId = `${input.sessionKey}-assistant-${input.messages.length}`;

  return [
    {
      type: "text-delta",
      text: reply.text,
    },
    ...reply.guidanceBlocks.map((block) => ({
      type: "guidance-block" as const,
      block,
    })),
    {
      type: "message-complete",
      messageId,
    },
  ];
}