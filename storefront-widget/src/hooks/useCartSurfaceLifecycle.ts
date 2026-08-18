import type { StorefrontChatSurface } from "../types";

export type CartMindSurfaceMountStatus = "mounted" | "failed";

export interface CartMindSurfaceMountRecord {
  surface: StorefrontChatSurface;
  placementId: string;
  mountStatus: CartMindSurfaceMountStatus;
}

export function buildCartMindSurfaceHostId(surface: StorefrontChatSurface, placementId: string) {
  const safePlacement = placementId.trim().replace(/[^a-z0-9_-]+/gi, "-").replace(/^-+|-+$/g, "");
  return `cartmind-${surface}-${safePlacement || "default"}`;
}

export function hasMountedSurface(
  records: CartMindSurfaceMountRecord[],
  surface: StorefrontChatSurface,
  placementId: string,
) {
  return records.some((record) => (
    record.surface === surface
    && record.placementId === placementId
    && record.mountStatus === "mounted"
  ));
}

export function shouldCreateSurfaceHost(
  records: CartMindSurfaceMountRecord[],
  surface: StorefrontChatSurface,
  placementId: string,
) {
  return !hasMountedSurface(records, surface, placementId);
}

export function toGracefulMountFailure(reason: string) {
  return {
    mountStatus: "failed" as const,
    reason,
    recoverable: true,
  };
}

export function isThirdPartyOwnedSelector(selector: string) {
  return [
    ".fs-upsell-widget",
    ".flits-loyalty-panel",
    ".kiwi-sizing-chart",
  ].some((knownSelector) => selector.includes(knownSelector));
}