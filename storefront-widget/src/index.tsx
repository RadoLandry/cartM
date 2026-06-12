import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { StorefrontWidgetMountConfigSchema } from "../../app/lib/ai/schemas";
import { CartMindChat } from "./CartMindChat";
import type { StorefrontChatMountConfig } from "./types";
import chatCss from "./styles/chat.css?inline";

const SURFACE_CONTAINER_SELECTORS: Record<StorefrontChatMountConfig["surface"], string[]> = {
  cart_drawer: [
    ".cart-drawer-header",
    "#main-nav",
    ".js-menu__context",
    "cart-drawer",
    "#CartDrawer",
    "[data-cart-drawer]",
    ".cart-drawer",
    ".drawer--cart",
  ],
  cart_page: ["main-cart-items", "#main-cart-items", "form[action='/cart']", "form[action='/cart/']", "[data-cart-items]"],
};

function resolveDrawerMountAnchor(container: HTMLElement) {
  const panel = container.matches("#main-nav, .js-menu--right")
    ? container
    : container.querySelector<HTMLElement>("#main-nav")
      ?? container.closest<HTMLElement>("#main-nav")
      ?? container;

  return {
    panel,
    anchor: panel.querySelector<HTMLElement>(".actions-toolbar-checkout")
      ?? panel.querySelector<HTMLElement>(".items-in-cart")
      ?? panel.querySelector<HTMLElement>("form")
      ?? panel,
  };
}

function placeDiscoveredRoot(root: HTMLElement, container: HTMLElement, config: StorefrontChatMountConfig) {
  if (config.surface !== "cart_drawer") {
    if (root.parentElement !== container) {
      container.insertAdjacentElement("beforeend", root);
    }
    return;
  }

  const { anchor } = resolveDrawerMountAnchor(container);
  const headerDetail = anchor.querySelector<HTMLElement>(".header-detail");
  const subtotalElement = anchor.querySelector<HTMLElement>(".cart-subtotal");
  const titleElement = anchor.querySelector<HTMLElement>("h4");

  if (headerDetail && subtotalElement) {
    if (root.parentElement !== headerDetail || root.previousElementSibling !== subtotalElement) {
      subtotalElement.insertAdjacentElement("afterend", root);
    }
    return;
  }

  if (headerDetail && titleElement) {
    if (root.parentElement !== headerDetail || root.previousElementSibling !== titleElement) {
      titleElement.insertAdjacentElement("afterend", root);
    }
    return;
  }

  const target = headerDetail ?? anchor;
  if (root.parentElement !== target) {
    target.insertAdjacentElement("afterbegin", root);
  }
}

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

  const container = findSurfaceContainer(config.surface);

  if (!container) {
    return sourceElement;
  }

  const root = existing ?? document.createElement("div");
  root.dataset.cartmindChatRoot = "true";
  root.dataset.cartmindDiscoveredRoot = "true";
  root.dataset.cartmindPlacementId = placementId;
  root.dataset.cartmindSurface = config.surface;
  root.dataset.configId = sourceElement.dataset.configId;
  root.className = "cartmind-chat-block cartmind-chat-block--discovered";

  placeDiscoveredRoot(root, container, config);

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
  const configScripts = document.querySelectorAll<HTMLScriptElement>('script[type="application/json"][id^="cartmind-chat-config-"]');
  configScripts.forEach((configScript) => {
    const configId = configScript.id;
    const existingSource = document.querySelector<HTMLElement>(`[data-cartmind-chat-root][data-config-id="${configId}"]`);

    if (!existingSource) {
      const sourceRoot = document.createElement("div");
      sourceRoot.dataset.cartmindChatRoot = "true";
      sourceRoot.dataset.cartmindAutodiscover = "true";
      sourceRoot.dataset.configId = configId;
      sourceRoot.style.display = "none";
      document.body.appendChild(sourceRoot);
    }
  });

  const roots = document.querySelectorAll<HTMLElement>("[data-cartmind-chat-root]");
  console.log("[CartMind widget] mountAll fired, roots:", roots.length);
  roots.forEach((element) => {
    mountChatWidget(element);
  });
}

let mountQueued = false;

function queueMountAll() {
  if (mountQueued) {
    return;
  }

  mountQueued = true;
  window.requestAnimationFrame(() => {
    mountQueued = false;
    mountAll();
  });
}

function observeThemeCartMutations() {
  if (typeof window === "undefined") {
    return;
  }

  const observer = new MutationObserver((mutations) => {
    let shouldRemount = false;

    for (const mutation of mutations) {
      if (mutation.type === "childList") {
        const changedNodes = [...Array.from(mutation.addedNodes), ...Array.from(mutation.removedNodes)];
        if (changedNodes.some((node) => node instanceof HTMLElement && (
          node.matches(".js-menu__context, #main-nav, .actions-toolbar-checkout, [data-cartmind-chat-root]")
          || node.querySelector?.(".js-menu__context, #main-nav, .actions-toolbar-checkout, [data-cartmind-chat-root]")
        ))) {
          shouldRemount = true;
          break;
        }
      }

      if (
        mutation.type === "attributes"
        && mutation.target instanceof HTMLElement
        && mutation.attributeName === "class"
        && mutation.target.matches(".js-menu__context, .js-menu--right")
      ) {
        shouldRemount = true;
        break;
      }
    }

    if (shouldRemount) {
      queueMountAll();
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["class"],
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    mountAll();
    observeThemeCartMutations();
  }, { once: true });
} else {
  mountAll();
  observeThemeCartMutations();
}