import { describe, expect, it } from "vitest";

import {
  isThirdPartyOwnedSelector,
  shouldCreateSurfaceHost,
} from "../../../storefront-widget/src/hooks/useCartSurfaceLifecycle";

describe("CartMind theme compatibility", () => {
  it("treats known third-party drawer selectors as out of bounds", () => {
    expect(isThirdPartyOwnedSelector(".fs-upsell-widget")).toBe(true);
    expect(isThirdPartyOwnedSelector(".flits-loyalty-panel")).toBe(true);
    expect(isThirdPartyOwnedSelector(".kiwi-sizing-chart")).toBe(true);
    expect(isThirdPartyOwnedSelector("[data-cartmind-surface-root]")).toBe(false);
  });

  it("allows adjacent CartMind hosts without wrapping third-party sections", () => {
    const existingHosts = [
      { surface: "cart_drawer" as const, placementId: "cartmind-drawer", mountStatus: "mounted" as const },
    ];

    expect(shouldCreateSurfaceHost(existingHosts, "cart_drawer", "cartmind-drawer")).toBe(false);
    expect(shouldCreateSurfaceHost(existingHosts, "cart_page", "cartmind-cart-page")).toBe(true);
  });
});