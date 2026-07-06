import { beforeEach, describe, expect, it } from "vitest";

import {
  buildBudgetOptimizationToolRequest,
  getBudgetOptimizationValidationError,
} from "../../../app/lib/ai/tools";
import { makeStorefrontChatRequest } from "../../helpers/storefront-chat-fixtures";

describe("budget optimization intent parsing", () => {
  beforeEach(() => {
    process.env.STOREFRONT_CHAT_SIGNING_SECRET = "test-signing-secret";
  });

  it("parses euro suffix amount and does not return validation error", () => {
    const request = makeStorefrontChatRequest({
      messages: [{ role: "user", content: "optimize my cart to budget 40€" }],
    });

    const validationError = getBudgetOptimizationValidationError(request);
    const toolRequest = buildBudgetOptimizationToolRequest(request);

    expect(validationError).toBeNull();
    expect(toolRequest?.targetBudgetAmount).toBe(40);
  });

  it("parses optimize spelling with s and spaced euro amount", () => {
    const request = makeStorefrontChatRequest({
      messages: [{ role: "user", content: "optimise my cart for 40 €" }],
    });

    const validationError = getBudgetOptimizationValidationError(request);
    const toolRequest = buildBudgetOptimizationToolRequest(request);

    expect(validationError).toBeNull();
    expect(toolRequest?.targetBudgetAmount).toBe(40);
  });

  it("parses localized decimal and currency code formats", () => {
    const request = makeStorefrontChatRequest({
      messages: [{ role: "user", content: "budget target: 40,50 eur" }],
    });

    const validationError = getBudgetOptimizationValidationError(request);
    const toolRequest = buildBudgetOptimizationToolRequest(request);

    expect(validationError).toBeNull();
    expect(toolRequest?.targetBudgetAmount).toBe(40.5);
  });

  it("prioritizes number near budget keywords over unrelated product numbers", () => {
    const request = makeStorefrontChatRequest({
      messages: [{ role: "user", content: "optimize budget 40 for Venum Attack 90" }],
    });

    const toolRequest = buildBudgetOptimizationToolRequest(request);

    expect(toolRequest?.targetBudgetAmount).toBe(40);
  });
});
