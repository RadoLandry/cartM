import type { StorefrontChatRequest, StorefrontChatStreamPart, StructuredGuidanceBlock } from "./schemas";
import { buildStorefrontChatSystemPrompt } from "./prompts";

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
  const firstItem = input.cart.items[0];

  return {
    blockId: "recommendation-1",
    type: "recommendation_list",
    title: "Suggested next item",
    summary: "This is a complementary suggestion based on the current cart.",
    priority: 1,
    items: [
      {
        productId: firstItem?.productId,
        variantId: firstItem?.variantId,
        title: firstItem ? `Complement for ${firstItem.productId}` : "Starter accessory",
        reason: firstItem
          ? "Complements the first item currently in the cart."
          : "Useful once you add your first item to the cart.",
        availability: "unknown",
      },
    ],
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
      title: `Option ${index + 1}`,
    })),
    rows: [
      {
        label: "Product",
        values: items.map((item) => item.productId),
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
      text: `${systemPrompt} I can answer general questions, but item-specific guidance will be stronger once something is in the cart.`,
      guidanceBlocks: [buildFallbackBlock("Add an item to the cart for product-specific guidance.")],
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
    text: "Here is a relevant suggestion based on the current cart.",
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