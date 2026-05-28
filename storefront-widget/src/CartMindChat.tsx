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