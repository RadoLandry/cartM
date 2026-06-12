import { describe, expect, it } from "vitest";

import {
  createCartToolActionRecord,
  getCartToolActionIdempotentReplay,
  transitionCartToolActionRecord,
} from "../../../app/lib/ai/storefront-chat";
import {
  assertActionStatusHistoryMonotonic,
  assertTerminalStatusReplaySafe,
} from "../../helpers/cart-action-lifecycle-assertions";

describe("cart action lifecycle", () => {
  it("does not overwrite an existing action record with the same action id", () => {
    const actionId = `action-${Date.now()}-dedupe`;
    const first = createCartToolActionRecord({
      actionId,
      shop: "test.myshopify.com",
      sessionKey: "session-1",
      cartId: "gid://shopify/Cart/1",
      payload: { actionType: "add", merchandiseId: "gid://shopify/ProductVariant/1", quantity: 1 },
    });

    const second = createCartToolActionRecord({
      actionId,
      shop: "test.myshopify.com",
      sessionKey: "session-1",
      cartId: "gid://shopify/Cart/1",
      payload: { actionType: "remove", lineId: "line-1" },
    });

    expect(second).toEqual(first);
    expect(second.payload).toEqual(first.payload);
  });

  it("supports monotonic transition flow and idempotent replay for terminal status", () => {
    const actionId = `action-${Date.now()}-flow`;

    createCartToolActionRecord({
      actionId,
      shop: "test.myshopify.com",
      sessionKey: "session-1",
      cartId: "gid://shopify/Cart/1",
      payload: { actionType: "change_quantity", lineId: "line-1", quantity: 2 },
    });

    const approved = transitionCartToolActionRecord({ actionId, nextStatus: "approved" });
    const executing = transitionCartToolActionRecord({ actionId, nextStatus: "executing" });
    const executed = transitionCartToolActionRecord({ actionId, nextStatus: "executed" });

    expect(approved.ok).toBe(true);
    expect(executing.ok).toBe(true);
    expect(executed.ok).toBe(true);

    assertActionStatusHistoryMonotonic(["proposed", "approved", "executing", "executed"]);
    assertTerminalStatusReplaySafe("executed");

    const replay = getCartToolActionIdempotentReplay(actionId);

    expect(replay).toMatchObject({
      actionId,
      status: "executed",
      idempotentReplay: true,
    });
  });

  it("rejects invalid lifecycle transitions", () => {
    const actionId = `action-${Date.now()}-invalid`;

    createCartToolActionRecord({
      actionId,
      shop: "test.myshopify.com",
      sessionKey: "session-1",
      cartId: "gid://shopify/Cart/1",
      payload: { actionType: "remove", lineId: "line-1" },
    });

    const invalid = transitionCartToolActionRecord({
      actionId,
      nextStatus: "executed",
    });

    expect(invalid.ok).toBe(false);
    if (!invalid.ok) {
      expect(invalid.code).toBe("INVALID_STATUS_TRANSITION");
    }
  });
});
