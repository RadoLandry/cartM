import { describe, expect, it, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock @shopify/ui-extensions-react/checkout before any imports
// ---------------------------------------------------------------------------

vi.mock("@shopify/ui-extensions-react/checkout", () => {
  const React = require("react");

  return {
    reactExtension: vi.fn((_, fn) => fn),
    useSettings: vi.fn(() => ({})),
    useAppMetafields: vi.fn(() => []),
    BlockStack: ({ children }: { children: React.ReactNode }) => React.createElement("div", { "data-testid": "block-stack" }, children),
    Banner: ({ children, title, status }: { children: React.ReactNode; title: string; status: string }) =>
      React.createElement("div", { "data-testid": "banner", "data-status": status, "data-title": title }, children),
    Text: ({ children }: { children: React.ReactNode }) => React.createElement("span", null, children),
    Link: ({ children, to }: { children: React.ReactNode; to: string }) =>
      React.createElement("a", { href: to }, children),
    Divider: () => React.createElement("hr"),
  };
});

import React from "react";
import { render, screen } from "@testing-library/react";
import { useSettings, useAppMetafields } from "@shopify/ui-extensions-react/checkout";

// Import the component factory after the mock is set up.
// We directly import the component for testing rather than the default export.
const { default: extensionFactory } = await import("./Checkout");

// The factory is the component itself (reactExtension returns the second arg in our mock)
const CartMindCheckoutGuidance = extensionFactory as unknown as React.ComponentType;

function makeGuidanceFeed(items: unknown[] = [], overrides = {}) {
  return JSON.stringify({
    shop: "test.myshopify.com",
    guidanceId: "feed-1",
    projectionVersion: 1,
    placement: "purchase.checkout.block.render",
    items,
    ...overrides,
  });
}

function makeSizeWarningItem(overrides = {}) {
  return {
    guidanceId: "sw-1",
    type: "size_warning",
    severity: "warning",
    priority: 0,
    title: "Check size compatibility",
    message: "Glove size 12 oz pairs with hand wrap M, but L is selected.",
    relatedLineIds: [],
    ...overrides,
  };
}

function makeBundleOfferItem(overrides = {}) {
  return {
    guidanceId: "bo-1",
    type: "bundle_offer",
    severity: "info",
    priority: 1,
    title: "Complete your boxing kit",
    message: "Add a mouthguard for 15% off.",
    relatedLineIds: [],
    ...overrides,
  };
}

function setupMetafields(value: string | null) {
  (useAppMetafields as ReturnType<typeof vi.fn>).mockReturnValue(
    value !== null
      ? [{ metafield: { namespace: "cartmind", key: "checkout_guidance", value } }]
      : [],
  );
}

describe("CartMind checkout extension: no-render empty state (T041)", () => {
  beforeEach(() => {
    (useSettings as ReturnType<typeof vi.fn>).mockReturnValue({});
  });

  it("renders nothing when there are no metafields", () => {
    setupMetafields(null);
    const { container } = render(React.createElement(CartMindCheckoutGuidance));
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when the guidance feed has an empty items array", () => {
    setupMetafields(makeGuidanceFeed([]));
    const { container } = render(React.createElement(CartMindCheckoutGuidance));
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when the metafield value is invalid JSON", () => {
    setupMetafields("not-valid-json");
    const { container } = render(React.createElement(CartMindCheckoutGuidance));
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when all items are expired", () => {
    const pastDate = new Date(Date.now() - 5_000).toISOString();
    setupMetafields(makeGuidanceFeed([makeSizeWarningItem({ expiresAt: pastDate })]));
    const { container } = render(React.createElement(CartMindCheckoutGuidance));
    expect(container.firstChild).toBeNull();
  });
});

describe("CartMind checkout extension: size warning rendering (T040)", () => {
  beforeEach(() => {
    (useSettings as ReturnType<typeof vi.fn>).mockReturnValue({});
  });

  it("renders a Banner for a size warning item", () => {
    setupMetafields(makeGuidanceFeed([makeSizeWarningItem()]));
    render(React.createElement(CartMindCheckoutGuidance));
    const banner = screen.getByTestId("banner");
    expect(banner).toBeTruthy();
    expect(banner.getAttribute("data-title")).toBe("Check size compatibility");
    expect(banner.getAttribute("data-status")).toBe("warning");
  });

  it("displays the warning message text", () => {
    setupMetafields(makeGuidanceFeed([makeSizeWarningItem()]));
    render(React.createElement(CartMindCheckoutGuidance));
    expect(screen.getByText("Glove size 12 oz pairs with hand wrap M, but L is selected.")).toBeTruthy();
  });
});

describe("CartMind checkout extension: bundle offer rendering (T040)", () => {
  beforeEach(() => {
    (useSettings as ReturnType<typeof vi.fn>).mockReturnValue({});
  });

  it("renders an info Banner for a bundle offer item", () => {
    setupMetafields(makeGuidanceFeed([makeBundleOfferItem()]));
    render(React.createElement(CartMindCheckoutGuidance));
    const banner = screen.getByTestId("banner");
    expect(banner.getAttribute("data-status")).toBe("info");
    expect(banner.getAttribute("data-title")).toBe("Complete your boxing kit");
  });

  it("renders a link when the item has an action with a target", () => {
    setupMetafields(
      makeGuidanceFeed([
        makeBundleOfferItem({
          action: { type: "add_item", label: "Add mouthguard", target: "/products/mouthguard" },
        }),
      ]),
    );
    render(React.createElement(CartMindCheckoutGuidance));
    const link = screen.getByRole("link");
    expect(link).toBeTruthy();
    expect(link.getAttribute("href")).toBe("/products/mouthguard");
  });
});

describe("CartMind checkout extension: placement adaptation (T041)", () => {
  it("renders guidance when cartmind_guidance_path matches a supported placement", () => {
    (useSettings as ReturnType<typeof vi.fn>).mockReturnValue({
      cartmind_guidance_path: "purchase.checkout.block.render",
    });
    setupMetafields(makeGuidanceFeed([makeSizeWarningItem()]));
    render(React.createElement(CartMindCheckoutGuidance));
    expect(screen.getByTestId("banner")).toBeTruthy();
  });

  it("renders nothing when cartmind_guidance_path is an unsupported placement", () => {
    (useSettings as ReturnType<typeof vi.fn>).mockReturnValue({
      cartmind_guidance_path: "unsupported.placement.target",
    });
    setupMetafields(makeGuidanceFeed([makeSizeWarningItem()]));
    const { container } = render(React.createElement(CartMindCheckoutGuidance));
    expect(container.firstChild).toBeNull();
  });
});

describe("CartMind checkout extension: ordering", () => {
  beforeEach(() => {
    (useSettings as ReturnType<typeof vi.fn>).mockReturnValue({});
  });

  it("renders critical items before info items", () => {
    const criticalWarning = makeSizeWarningItem({ severity: "critical", guidanceId: "sw-crit", title: "Critical Size Issue" });
    const infoOffer = makeBundleOfferItem({ severity: "info", guidanceId: "bo-info", title: "Bundle Info" });

    setupMetafields(makeGuidanceFeed([infoOffer, criticalWarning]));
    render(React.createElement(CartMindCheckoutGuidance));

    const banners = screen.getAllByTestId("banner");
    expect(banners[0].getAttribute("data-title")).toBe("Critical Size Issue");
    expect(banners[1].getAttribute("data-title")).toBe("Bundle Info");
  });
});
