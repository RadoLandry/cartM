import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { StorefrontChatSurfaceSchema } from "../../app/lib/ai/schemas";
import { CartMindChat } from "./CartMindChat";
import type { StorefrontChatMountConfig } from "./types";
import chatCss from "./styles/chat.css?inline";

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
    const surface = StorefrontChatSurfaceSchema.safeParse(parsed.surface);

    if (!surface.success) {
      return null;
    }

    return {
      ...parsed,
      surface: surface.data,
    };
  } catch {
    return null;
  }
}

function mountChatWidget(element: HTMLElement) {
  if (element.dataset.mounted === "true") {
    return;
  }

  const config = readMountConfig(element);

  if (!config) {
    return;
  }

  const shadowRoot = element.shadowRoot || element.attachShadow({ mode: "open" });
  const styleElement = document.createElement("style");
  const mountNode = document.createElement("div");

  styleElement.textContent = chatCss;
  shadowRoot.replaceChildren(styleElement, mountNode);
  createRoot(mountNode).render(
    <StrictMode>
      <CartMindChat config={config} />
    </StrictMode>,
  );

  element.dataset.mounted = "true";
}

function mountAll() {
  document.querySelectorAll<HTMLElement>("[data-cartmind-chat-root]").forEach((element) => {
    mountChatWidget(element);
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", mountAll, { once: true });
} else {
  mountAll();
}