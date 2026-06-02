import { describe, expect, it } from "vitest";

import { buildPreviewCacheKey, clearPreviewCache, composeKitPreview } from "../../../app/lib/visual/compositor";
import { resolveLayoutProfile } from "../../../app/lib/visual/templates";
import {
  makeEmptyKitPreviewFixture,
  makeKitPreviewCartFixture,
  makeKitPreviewFixtureWithMissingImage,
} from "../../helpers/kit-preview-fixtures";
import { normalizeStorefrontCartForPreview } from "../../../app/lib/shopify/storefront-cart";

describe("kit preview compositor", () => {
  it("creates deterministic cache keys for same signature and template input", () => {
    const keyA = buildPreviewCacheKey({
      snapshotSignature: "sig-a",
      layoutId: "boxing-default",
      templateVersion: "v1",
      outputFormat: "webp",
    });
    const keyB = buildPreviewCacheKey({
      snapshotSignature: "sig-a",
      layoutId: "boxing-default",
      templateVersion: "v1",
      outputFormat: "webp",
    });

    expect(keyA).toBe(keyB);
  });

  it("composes eligible cart snapshots and reports partial when omissions exist", () => {
    clearPreviewCache();
    const cart = makeKitPreviewFixtureWithMissingImage();
    const snapshot = normalizeStorefrontCartForPreview({
      cartId: cart.cartId,
      currencyCode: cart.currencyCode,
      items: cart.items,
    });
    const layout = resolveLayoutProfile(snapshot.inferredDiscipline, snapshot.items.length);

    const result = composeKitPreview({
      snapshot,
      layoutProfile: layout,
    });

    expect(result.status).toBe("partial");
    expect(result.preview.assetUrl).toContain("/api/ai/kit-preview/assets/");
    expect(result.omissions.length).toBeGreaterThan(0);
  });

  it("returns fallback for empty snapshots", () => {
    clearPreviewCache();
    const cart = makeEmptyKitPreviewFixture();
    const snapshot = normalizeStorefrontCartForPreview({
      cartId: cart.cartId,
      currencyCode: cart.currencyCode,
      items: cart.items,
    });
    const layout = resolveLayoutProfile(snapshot.inferredDiscipline, snapshot.items.length);

    const result = composeKitPreview({
      snapshot,
      layoutProfile: layout,
    });

    expect(result.status).toBe("fallback");
    expect(result.preview.assetUrl).toBeNull();
  });

  it("reuses composed preview for unchanged snapshots", () => {
    clearPreviewCache();
    const cart = makeKitPreviewCartFixture();
    const snapshot = normalizeStorefrontCartForPreview({
      cartId: cart.cartId,
      currencyCode: cart.currencyCode,
      items: cart.items,
    });
    const layout = resolveLayoutProfile(snapshot.inferredDiscipline, snapshot.items.length);

    const first = composeKitPreview({
      snapshot,
      layoutProfile: layout,
    });
    const second = composeKitPreview({
      snapshot,
      layoutProfile: layout,
    });

    expect(first.preview.reused).toBe(false);
    expect(second.preview.reused).toBe(true);
  });
});
