import { describe, expect, it } from "vitest";

import {
  buildCartMindSurfaceHostId,
  hasMountedSurface,
  shouldCreateSurfaceHost,
  toGracefulMountFailure,
} from "../../../storefront-widget/src/hooks/useCartSurfaceLifecycle";

describe("cart surface lifecycle", () => {
  it("creates stable host ids for cart drawer and cart page placements", () => {
    expect(buildCartMindSurfaceHostId("cart_drawer", "drawer:main")).toBe("cartmind-cart_drawer-drawer-main");
    expect(buildCartMindSurfaceHostId("cart_page", "main-cart-footer")).toBe("cartmind-cart_page-main-cart-footer");
  });

  it("prevents duplicate mounted hosts for the same surface and placement", () => {
    const records = [{ surface: "cart_drawer" as const, placementId: "drawer", mountStatus: "mounted" as const }];

    expect(hasMountedSurface(records, "cart_drawer", "drawer")).toBe(true);
    expect(shouldCreateSurfaceHost(records, "cart_drawer", "drawer")).toBe(false);
    expect(shouldCreateSurfaceHost(records, "cart_page", "drawer")).toBe(true);
  });

  it("models failed mounts as recoverable no-op states", () => {
    expect(toGracefulMountFailure("render_error")).toEqual({
      mountStatus: "failed",
      reason: "render_error",
      recoverable: true,
    });
  });
});