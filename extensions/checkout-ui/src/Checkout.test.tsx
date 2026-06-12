import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@shopify/ui-extensions/preact", () => ({}));

vi.mock("preact", () => {
  let lastRenderedTree: any = undefined;

  return {
    render: vi.fn((vnode: any) => {
      if (vnode && typeof vnode.type === "function") {
        lastRenderedTree = vnode.type(vnode.props ?? {});
      } else {
        lastRenderedTree = vnode;
      }
    }),
    __getLastRenderedTree: () => lastRenderedTree,
  };
});

const { default: extension } = await import("./Checkout");
const { render, __getLastRenderedTree } = await import("preact");

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

function setupShopify({ guidanceValue, settings }: { guidanceValue: string | null; settings?: Record<string, unknown> }) {
  (globalThis as any).shopify = {
    settings: { value: settings ?? {} },
    appMetafields: {
      value:
        guidanceValue == null
          ? []
          : [{ metafield: { namespace: "cartmind", key: "checkout_guidance", value: guidanceValue } }],
    },
  };
}

function collectByType(node: any, type: string): any[] {
  if (!node) return [];
  if (Array.isArray(node)) {
    return node.flatMap((child) => collectByType(child, type));
  }

  const children = node.props?.children;
  const childList = Array.isArray(children) ? children : children != null ? [children] : [];
  const nested = childList.flatMap((child) => collectByType(child, type));

  return node.type === type ? [node, ...nested] : nested;
}

describe("CartMind checkout extension (preact)", () => {
  beforeEach(() => {
    (globalThis as any).document = { body: {} };
    setupShopify({ guidanceValue: null });
  });

  it("calls preact render", () => {
    extension();
    expect(render).toHaveBeenCalledTimes(1);
  });

  it("renders nothing when there are no metafields", () => {
    setupShopify({ guidanceValue: null });
    extension();
    expect(__getLastRenderedTree()).toBeNull();
  });

  it("renders nothing when metafield JSON is invalid", () => {
    setupShopify({ guidanceValue: "not-valid-json" });
    extension();
    expect(__getLastRenderedTree()).toBeNull();
  });

  it("renders nothing when all items are expired", () => {
    const pastDate = new Date(Date.now() - 5_000).toISOString();
    setupShopify({ guidanceValue: makeGuidanceFeed([makeSizeWarningItem({ expiresAt: pastDate })]) });
    extension();
    expect(__getLastRenderedTree()).toBeNull();
  });

  it("renders warning and info banners", () => {
    setupShopify({ guidanceValue: makeGuidanceFeed([makeSizeWarningItem(), makeBundleOfferItem()]) });
    extension();

    const tree = __getLastRenderedTree();
    const banners = collectByType(tree, "s-banner");
    expect(banners.length).toBe(2);
    expect(banners[0].props.tone).toBe("warning");
    expect(banners[0].props.heading).toBe("Check size compatibility");
    expect(banners[1].props.tone).toBe("info");
  });

  it("renders link when action target exists", () => {
    setupShopify({
      guidanceValue: makeGuidanceFeed([
        makeBundleOfferItem({
          action: { type: "add_item", label: "Add mouthguard", target: "/products/mouthguard" },
        }),
      ]),
    });

    extension();
    const tree = __getLastRenderedTree();
    const links = collectByType(tree, "s-link");

    expect(links.length).toBe(1);
    expect(links[0].props.href).toBe("/products/mouthguard");
  });

  it("renders nothing when placement setting is unsupported", () => {
    setupShopify({
      guidanceValue: makeGuidanceFeed([makeSizeWarningItem()]),
      settings: { cartmind_guidance_path: "unsupported.placement.target" },
    });

    extension();
    expect(__getLastRenderedTree()).toBeNull();
  });

  it("orders critical severity before info severity", () => {
    const criticalWarning = makeSizeWarningItem({ severity: "critical", guidanceId: "sw-crit", title: "Critical Size Issue" });
    const infoOffer = makeBundleOfferItem({ severity: "info", guidanceId: "bo-info", title: "Bundle Info" });

    setupShopify({ guidanceValue: makeGuidanceFeed([infoOffer, criticalWarning]) });

    extension();
    const tree = __getLastRenderedTree();
    const banners = collectByType(tree, "s-banner");

    expect(banners.length).toBe(2);
    expect(banners[0].props.heading).toBe("Critical Size Issue");
    expect(banners[1].props.heading).toBe("Bundle Info");
  });
});
