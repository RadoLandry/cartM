import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { StorefrontWidgetMountConfigSchema } from "../../app/lib/ai/schemas";
import { CartMindChat } from "./CartMindChat";
import type { StorefrontChatMountConfig } from "./types";
import chatCss from "./styles/chat.css?inline";

const SURFACE_CONTAINER_SELECTORS: Record<StorefrontChatMountConfig["surface"], string[]> = {
  cart_drawer: ["cart-drawer", "#CartDrawer", "[data-cart-drawer]", ".cart-drawer", ".drawer--cart", ".js-menu__context"],
  cart_page: ["main-cart-items", "#main-cart-items", "form[action='/cart']", "form[action='/cart/']", "[data-cart-items]"],
};

function resolveBootstrapUrl(config: StorefrontChatMountConfig) {
  if (config.bootstrapUrl && /^https?:\/\//.test(config.bootstrapUrl)) {
    return config.bootstrapUrl;
  }

  const appBaseUrl = config.appBaseUrl?.replace(/\/$/, "");
  const bootstrapPath = config.bootstrapPath || config.bootstrapUrl || "/apps/cartmind-chat/chat-bootstrap";

  if (appBaseUrl) {
    return `${appBaseUrl}${bootstrapPath.startsWith("/") ? bootstrapPath : `/${bootstrapPath}`}`;
  }

  return bootstrapPath;
}

function readMountConfig(element: HTMLElement): StorefrontChatMountConfig | null {
  const configId = element.dataset.configId;

  if (!configId) {
    return null;
  }

  const configElement = document.getElementById(configId);

  if (!configElement?.textContent) {
    return null;
  }

  try {
    const parsed = JSON.parse(configElement.textContent) as StorefrontChatMountConfig;
    const normalized = {
      ...parsed,
      bootstrapUrl: resolveBootstrapUrl(parsed),
      labels: {
        launcherLabel: parsed.labels?.launcherLabel || parsed.launcherLabel,
        panelTitle: parsed.labels?.panelTitle || parsed.panelTitle,
        assistantGreeting: parsed.labels?.assistantGreeting || parsed.assistantGreeting,
        fallbackMessage: parsed.labels?.fallbackMessage,
      },
    };
    const config = StorefrontWidgetMountConfigSchema.safeParse(normalized);

    if (!config.success) {
      return null;
    }

    return config.data as StorefrontChatMountConfig;
  } catch {
    return null;
  }
}

function findSurfaceContainer(surface: StorefrontChatMountConfig["surface"]) {
  console.log("[CartMind widget] findSurfaceContainer for surface:", surface);
  console.log("[CartMind widget] selectors to try:", SURFACE_CONTAINER_SELECTORS[surface]);
  for (const selector of SURFACE_CONTAINER_SELECTORS[surface]) {
    const match = document.querySelector<HTMLElement>(selector);
    console.log("[CartMind widget] selector", selector, "→", match ? "FOUND" : "not found");

    if (match) {
      return match;
    }
  }

  console.warn("[CartMind widget] No surface container found for:", surface);
  return null;
}

function getOrCreateDiscoveredRoot(sourceElement: HTMLElement, config: StorefrontChatMountConfig) {
  if (sourceElement.dataset.cartmindAutodiscover !== "true") {
    return sourceElement;
  }

  const placementId = config.placementId || `${config.surface}:default`;
  const existing = document.querySelector<HTMLElement>(`[data-cartmind-discovered-root="true"][data-cartmind-placement-id="${placementId}"]`);

  if (existing) {
    return existing;
  }

  const container = findSurfaceContainer(config.surface);

  if (!container) {
    return sourceElement;
  }

  const root = document.createElement("div");
  root.dataset.cartmindChatRoot = "true";
  root.dataset.cartmindDiscoveredRoot = "true";
  root.dataset.cartmindPlacementId = placementId;
  root.dataset.configId = sourceElement.dataset.configId;
  root.className = "cartmind-chat-block cartmind-chat-block--discovered";

  if (config.surface === "cart_drawer") {
    container.insertAdjacentElement("afterend", root);
  } else {
    container.insertAdjacentElement("beforeend", root);
  }

  return root;
}

function mountChatWidget(element: HTMLElement) {
  if (element.dataset.mounted === "true") {
    return;
  }

  const config = readMountConfig(element);

  if (!config) {
    return;
  }

  const rootElement = getOrCreateDiscoveredRoot(element, config);

  if (rootElement !== element) {
    mountChatWidget(rootElement);
    return;
  }

  const shadowRoot = rootElement.shadowRoot || rootElement.attachShadow({ mode: "open" });
  const styleElement = document.createElement("style");
  const mountNode = document.createElement("div");

  styleElement.textContent = chatCss;
  shadowRoot.replaceChildren(styleElement, mountNode);
  createRoot(mountNode).render(
    <StrictMode>
      <CartMindChat config={config} />
    </StrictMode>,
  );

  rootElement.dataset.mounted = "true";
  rootElement.dataset.cartmindPlacementId = config.placementId || `${config.surface}:default`;
}

function mountAll() {
  const roots = document.querySelectorAll<HTMLElement>("[data-cartmind-chat-root]");
  console.log("[CartMind widget] mountAll fired, roots:", roots.length);
  roots.forEach((element) => {
    mountChatWidget(element);
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", mountAll, { once: true });
} else {
  mountAll();
}