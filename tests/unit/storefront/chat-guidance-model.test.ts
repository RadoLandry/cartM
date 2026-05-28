import { describe, expect, it } from "vitest";

import { getGuidanceRenderModel } from "../../../storefront-widget/src/components/guidance/getGuidanceRenderModel";
import {
  makeComparisonTableBlock,
  makeFallbackNoticeBlock,
  makeRecommendationListBlock,
  makeSizeSummaryBlock,
} from "../../helpers/storefront-chat-fixtures";

describe("storefront chat guidance render models", () => {
  it("normalizes recommendation blocks for list rendering", () => {
    const model = getGuidanceRenderModel(makeRecommendationListBlock());

    expect(model).toMatchObject({
      kind: "recommendation_list",
      title: "Recommended add-ons",
    });
    expect(model.kind === "recommendation_list" && model.items[0].meta).toContain("$14.99");
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