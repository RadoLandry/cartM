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

// Class names that indicate the cart drawer is open
const DRAWER_OPEN_CLASS_PATTERNS = [
  "js-menu__expanded",
  "is-open",
  "is-active",
  "cart-open",
  "drawer--open",
  "drawer--is-open",
];
const DRAWER_OPEN_SELECTORS = [
  ".js-menu__context.js-menu__expanded",
  ".js-menu--right.js-menu__expanded",
];

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

export function useCartSurfaceLifecycle(
  config: StorefrontChatMountConfig,
  options?: {
    /** Called when the MutationObserver detects an AJAX drawer replacement or open/close change */
    onStructuralChange?: () => void;
  },
) {
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

  // ---- MutationObserver for AJAX drawer replacement and open/close --------
  useEffect(() => {
    if (typeof window === "undefined" || !options?.onStructuralChange) return;

    const target = document.body;
    let lastOpenState: boolean | null = null;

    function resolveDrawerOpenState(): boolean {
      if (DRAWER_OPEN_SELECTORS.some((selector) => document.querySelector(selector))) {
        return true;
      }

      return DRAWER_OPEN_CLASS_PATTERNS.some((cls) =>
        Array.from(document.querySelectorAll("[class]")).some((el) => el.classList.contains(cls)),
      );
    }

    const observer = new MutationObserver((mutations) => {
      let triggerSync = false;

      for (const mutation of mutations) {
        // AJAX drawer replacement: child nodes were added/removed inside a known surface container
        if (mutation.type === "childList" && mutation.addedNodes.length > 0) {
          for (const node of Array.from(mutation.addedNodes)) {
            if (node instanceof HTMLElement) {
              const tag = node.tagName?.toLowerCase();
              if (
                tag === "cart-drawer"
                || node.id === "CartDrawer"
                || node.classList.contains("cart-drawer")
                || node.classList.contains("js-menu__context")
                || node.classList.contains("js-menu--right")
                || Boolean(node.querySelector(".js-menu__context, .js-menu--right"))
              ) {
                triggerSync = true;
                break;
              }
            }
          }
        }

        // Drawer open/close: class change on a drawer element
        if (mutation.type === "attributes" && mutation.attributeName === "class") {
          const currentOpenState = resolveDrawerOpenState();
          if (currentOpenState !== lastOpenState) {
            lastOpenState = currentOpenState;
            if (currentOpenState) {
              triggerSync = true;
            }
          }
        }
      }

      if (triggerSync) {
        options.onStructuralChange?.();
      }
    });

    observer.observe(target, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => {
      observer.disconnect();
    };
  }, [options]);

  return {
    hostId,
    placementId,
    mountStatus,
  };
}