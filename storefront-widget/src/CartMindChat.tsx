import { useCallback, useRef, useState } from "react";

import { StorefrontGuidanceResponseSchema } from "../../app/lib/ai/schemas";
import type { StorefrontGuidancePayload } from "../../app/lib/ai/schemas";
import type { StorefrontChatMountConfig } from "./types";
import type { StorefrontCartSnapshot } from "./types";
import { CartMindSurface } from "./components/integration/CartMindSurface";
import { ChatPanel } from "./components/ChatPanel";
import {
  createBrowserSessionId,
  useChatSessionState,
} from "./hooks/useChatSessionState";
import { useStorefrontChat } from "./hooks/useStorefrontChat";
import { useCartStateSync } from "./hooks/useCartStateSync";
import { useCartSurfaceLifecycle } from "./hooks/useCartSurfaceLifecycle";

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
      key?: string;
      product_id?: number | string;
      product_title?: string;
      variant_id?: number | string;
      variant_title?: string;
      quantity?: number;
    }) => ({
      lineId: item.key ? String(item.key) : undefined,
      productId: String(item.product_id || ""),
      productTitle: item.product_title,
      variantId: item.variant_id ? String(item.variant_id) : undefined,
      variantTitle: item.variant_title,
      quantity: Number(item.quantity || 1),
    })).filter((item: { productId: string }) => item.productId.length > 0),
  };
}

async function fetchStorefrontGuidance(
  cart: StorefrontCartSnapshot,
  config: StorefrontChatMountConfig,
  sessionId: string,
): Promise<StorefrontGuidancePayload | null> {
  if (typeof window === "undefined") return null;

  const recommendationsPath = config.recommendationsPath ?? "/api/ai/recommendations";
  const url = config.appBaseUrl
    ? `${config.appBaseUrl.replace(/\/$/, "")}${recommendationsPath.startsWith("/") ? recommendationsPath : `/${recommendationsPath}`}`
    : recommendationsPath;

  try {
    const response = await window.fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({
        shop: config.shop,
        surface: config.surface,
        placementId: config.placementId ?? `${config.surface}:default`,
        sessionId,
        cart,
        syncSource: "cart_js",
        requestedAt: new Date().toISOString(),
      }),
    });

    if (!response.ok) return null;

    const raw = await response.json().catch(() => null);
    const parsed = StorefrontGuidanceResponseSchema.safeParse(raw);

    if (!parsed.success || !parsed.data.ok) return null;

    return parsed.data.payload;
  } catch {
    return null;
  }
}

export function CartMindChat({ config }: CartMindChatProps) {
  const [sessionId] = useState(() => getOrCreateBrowserSessionKey(config.shop, config.surface));
  const [latestGuidance, setLatestGuidance] = useState<StorefrontGuidancePayload | undefined>(
    config.guidance,
  );
  const latestCartRef = useRef<StorefrontCartSnapshot>(config.cart);
  const sessionIdRef = useRef(sessionId);
  sessionIdRef.current = sessionId;

  const refreshGuidance = useCallback(async (cart: StorefrontCartSnapshot) => {
    const payload = await fetchStorefrontGuidance(cart, config, sessionIdRef.current);
    if (payload) {
      setLatestGuidance(payload);
    }
  }, [config]);

  const { syncFromMutation } = useCartStateSync({
    initialCart: config.cart,
    surface: config.surface,
    active: true,
    onCartChanged: (snapshot) => {
      latestCartRef.current = snapshot;
      void refreshGuidance(snapshot);
    },
  });

  useCartSurfaceLifecycle(config, {
    onStructuralChange: syncFromMutation,
  });

  const { state, dispatch } = useChatSessionState({
    shop: config.shop,
    surface: config.surface,
    sessionId,
    cartId: config.cart.cartId,
    currencyCode: config.cart.currencyCode,
  });
  const { submitMessage, retryLastMessage, submitActionConfirmation } = useStorefrontChat({
    config,
    state,
    dispatch,
    onActionCartUpdated: (cart) => {
      latestCartRef.current = cart;
      void refreshGuidance(cart);
    },
    resolveCartSnapshot: async () => latestCartRef.current.items.length > 0
      ? latestCartRef.current
      : await readLatestStorefrontCart(config),
  });

  const configWithLatestGuidance = latestGuidance !== config.guidance
    ? { ...config, guidance: latestGuidance }
    : config;

  return (
    <CartMindSurface config={configWithLatestGuidance}>
      <ChatPanel
        state={state}
        launcherLabel={config.labels?.launcherLabel || config.launcherLabel || "Ask CartMind"}
        panelTitle={config.labels?.panelTitle || config.panelTitle || "CartMind chat"}
        assistantGreeting={config.labels?.assistantGreeting || config.assistantGreeting || "Ask about fit, comparisons, or what works well with the items in your cart."}
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
        onDismissComparisonContext={(comparisonContextId) => {
          dispatch({ type: "comparison_context_dismissed", comparisonContextId });
        }}
        onApproveAction={(action) => {
          void submitActionConfirmation(action, "approve");
        }}
        onApproveActionSelection={(action, selection) => {
          void submitActionConfirmation(action, "approve", selection);
        }}
        onDeclineAction={(action) => {
          void submitActionConfirmation(action, "decline");
        }}
      />
    </CartMindSurface>
  );
}