import { describe, expect, it } from "vitest";

import { buildStorefrontChatSystemPrompt } from "../../../app/lib/ai/prompts";
import { getGuidanceRenderModel } from "../../../storefront-widget/src/components/guidance/getGuidanceRenderModel";
import {
  makeComparisonTableBlock,
  makeFallbackNoticeBlock,
  makeRecommendationListBlock,
  makeSizeSummaryBlock,
} from "../../helpers/storefront-chat-fixtures";

describe("storefront chat guidance render models", () => {
  it("builds prompts with shopper-visible cart line context", () => {
    const prompt = buildStorefrontChatSystemPrompt({
      shop: "test.myshopify.com",
      cart: {
        cartId: "gid://shopify/Cart/123",
        currencyCode: "USD",
        items: [
          {
            productId: "gid://shopify/Product/1",
            productTitle: "Core Training Gloves",
            variantId: "gid://shopify/ProductVariant/11",
            variantTitle: "12 oz / Black",
            quantity: 1,
          },
        ],
      },
    });

    expect(prompt).toContain("Core Training Gloves");
    expect(prompt).toContain("12 oz / Black");
    expect(prompt).toContain("safety and compatibility");
  });

  it("normalizes recommendation blocks for list rendering", () => {
    const model = getGuidanceRenderModel(makeRecommendationListBlock());

    expect(model).toMatchObject({
      kind: "recommendation_list",
      title: "Recommended add-ons",
    });
    expect(model.kind === "recommendation_list" && model.items[0].meta).toContain("$14.99");
    expect(model.kind === "recommendation_list" && model.items[0]).toMatchObject({
      action: "add",
      priorityLabel: "high",
      safetyCritical: true,
    });
  });

  it("normalizes comparison blocks for table rendering", () => {
    const model = getGuidanceRenderModel(makeComparisonTableBlock());

    expect(model).toMatchObject({
      kind: "comparison_table",
      headings: ["Option A", "Option B"],
    });
  });

  it("normalizes size summary blocks with a confidence label", () => {
    const model = getGuidanceRenderModel(makeSizeSummaryBlock());

    expect(model).toMatchObject({
      kind: "size_summary",
      confidenceLabel: "84% confidence",
    });
  });

  it("normalizes fallback blocks for simple notices", () => {
    const model = getGuidanceRenderModel(makeFallbackNoticeBlock());

    expect(model).toEqual({
      kind: "fallback_notice",
      title: "Need more context",
      summary: "Share a bit more about fit or intended use for a stronger recommendation.",
    });
  });
});