import { useState } from "react";

import type { StorefrontChatMountConfig } from "./types";
import { ChatPanel } from "./components/ChatPanel";
import {
  createBrowserSessionId,
  useChatSessionState,
} from "./hooks/useChatSessionState";
import { useStorefrontChat } from "./hooks/useStorefrontChat";

function getOrCreateBrowserSessionKey(shop: string, surface: StorefrontChatMountConfig["surface"]) {
  const storageKey = `cartmind-chat:browser:${shop}:${surface}`;

  if (typeof window === "undefined") {
    return createBrowserSessionId();
  }

  const existingSessionId = window.sessionStorage.getItem(storageKey);

  if (existingSessionId) {
    return existingSessionId;
  }

  const nextSessionId = createBrowserSessionId();
  window.sessionStorage.setItem(storageKey, nextSessionId);
  return nextSessionId;
}

interface CartMindChatProps {
  config: StorefrontChatMountConfig;
}

async function readLatestStorefrontCart(config: StorefrontChatMountConfig) {
  if (typeof window === "undefined") {
    return config.cart;
  }

  const response = await window.fetch("/cart.js", {
    method: "GET",
    credentials: "same-origin",
  }).catch(() => null);

  if (!response?.ok) {
    return config.cart;
  }

  const payload = await response.json().catch(() => null);

  if (!payload || !Array.isArray(payload.items)) {
    return config.cart;
  }

  return {
    cartId: payload.token || config.cart.cartId,
    currencyCode: payload.currency || config.cart.currencyCode,
    items: payload.items.map((item: {
      product_id?: number | string;
      product_title?: string;
      variant_id?: number | string;
      variant_title?: string;
      quantity?: number;
    }) => ({
      productId: String(item.product_id || ""),
      productTitle: item.product_title,
      variantId: item.variant_id ? String(item.variant_id) : undefined,
      variantTitle: item.variant_title,
      quantity: Number(item.quantity || 1),
    })).filter((item: { productId: string }) => item.productId.length > 0),
  };
}

export function CartMindChat({ config }: CartMindChatProps) {
  const [sessionId] = useState(() => getOrCreateBrowserSessionKey(config.shop, config.surface));
  const { state, dispatch } = useChatSessionState({
    shop: config.shop,
    surface: config.surface,
    sessionId,
    cartId: config.cart.cartId,
    currencyCode: config.cart.currencyCode,
  });
  const { submitMessage, retryLastMessage } = useStorefrontChat({
    config,
    state,
    dispatch,
    resolveCartSnapshot: async () => await readLatestStorefrontCart(config),
  });

  return (
    <ChatPanel
      state={state}
      launcherLabel={config.launcherLabel || "Ask CartMind"}
      panelTitle={config.panelTitle || "CartMind chat"}
      assistantGreeting={config.assistantGreeting || "Ask about fit, comparisons, or what works well with the items in your cart."}
      onOpen={() => dispatch({ type: "panel_opened" })}
      onClose={() => dispatch({ type: "panel_closed" })}
      onCollapse={() => dispatch({ type: "panel_collapsed" })}
      onExpand={() => dispatch({ type: "panel_expanded" })}
      onDraftChange={(draft) => dispatch({ type: "draft_changed", draft })}
      onSubmit={() => {
        void submitMessage(state.draft);
      }}
      onRetry={() => {
        void retryLastMessage();
      }}
    />
  );
}