import { useEffect, useMemo, useState } from "react";

import type { StorefrontChatMountConfig } from "../types";

export interface CartMindSurfaceRecord {
  surface: StorefrontChatMountConfig["surface"];
  placementId: string;
  mountStatus: "not_mounted" | "mounting" | "mounted" | "hidden" | "failed";
}

export interface CartMindMountFailure {
  mountStatus: "failed";
  reason: "invalid_config" | "shadow_root_unavailable" | "render_error" | "surface_unavailable";
  recoverable: true;
}

const THIRD_PARTY_SELECTOR_PREFIXES = [".fs-", ".flits-", ".kiwi-"];

export function buildCartMindSurfaceHostId(surface: StorefrontChatMountConfig["surface"], placementId: string) {
  return `cartmind-${surface}-${placementId}`.replace(/[^a-z0-9_-]/gi, "-").toLowerCase();
}

export function hasMountedSurface(
  records: CartMindSurfaceRecord[],
  surface: StorefrontChatMountConfig["surface"],
  placementId: string,
) {
  return records.some((record) => (
    record.surface === surface
    && record.placementId === placementId
    && record.mountStatus === "mounted"
  ));
}

export function shouldCreateSurfaceHost(
  records: CartMindSurfaceRecord[],
  surface: StorefrontChatMountConfig["surface"],
  placementId: string,
) {
  return !records.some((record) => record.surface === surface && record.placementId === placementId);
}

export function isThirdPartyOwnedSelector(selector: string) {
  return THIRD_PARTY_SELECTOR_PREFIXES.some((prefix) => selector.startsWith(prefix));
}

export function toGracefulMountFailure(reason: CartMindMountFailure["reason"]): CartMindMountFailure {
  return {
    mountStatus: "failed",
    reason,
    recoverable: true,
  };
}

export function useCartSurfaceLifecycle(config: StorefrontChatMountConfig) {
  const placementId = config.placementId ?? `${config.surface}:default`;
  const hostId = useMemo(
    () => buildCartMindSurfaceHostId(config.surface, placementId),
    [config.surface, placementId],
  );
  const [mountStatus, setMountStatus] = useState<CartMindSurfaceRecord["mountStatus"]>("mounting");

  useEffect(() => {
    setMountStatus("mounted");

    return () => {
      setMountStatus("hidden");
    };
  }, [hostId]);

  return {
    hostId,
    placementId,
    mountStatus,
  };
}