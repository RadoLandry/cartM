(() => {
  console.info("[CartMind] Extension script v1.1.0 loaded");

  const SURFACE_CONTAINER_SELECTORS = {
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
  const CART_MUTATION_PATHS = ["/cart/add.js", "/cart/change.js", "/cart/update.js", "/cart/clear.js"];
  const instances = new Map();
  let mountQueued = false;
  let fetchPatched = false;
  let xhrPatched = false;
  let observerStarted = false;
  let pollStarted = false;

  function normalizeAppBaseUrl(rawValue) {
    if (typeof rawValue !== "string") {
      return "";
    }

    const trimmed = rawValue.trim().replace(/\/$/, "");

    if (!trimmed) {
      return "";
    }

    try {
      const url = new URL(trimmed, window.location.origin);
      url.search = "";
      url.hash = "";
      url.pathname = url.pathname.replace(/\/+$/, "");
      url.pathname = url.pathname.replace(/\/api\/app-proxy$/i, "");
      return `${url.origin}${url.pathname}`;
    } catch {
      return trimmed.replace(/\/api\/app-proxy$/i, "");
    }
  }

  function normalizeBootstrapPath(rawValue) {
    if (typeof rawValue !== "string") {
      return "/apps/cartmind-chat/chat-bootstrap";
    }

    const trimmed = rawValue.trim();
    if (!trimmed) {
      return "/apps/cartmind-chat/chat-bootstrap";
    }

    const withoutLeadingSlashes = trimmed.replace(/^\/+/, "");
    return `/${withoutLeadingSlashes}`;
  }

  function normalizeAbsoluteUrl(rawValue) {
    if (typeof rawValue !== "string") {
      return "";
    }

    try {
      const url = new URL(rawValue.trim(), window.location.origin);
      if (!/^https?:$/i.test(url.protocol)) {
        return "";
      }

      if (url.pathname.indexOf("/apps/") === 0) {
        return `${url.pathname}${url.search || ""}`;
      }

      url.pathname = `/${url.pathname.replace(/^\/+/, "")}`;
      return url.toString();
    } catch {
      return "";
    }
  }

  function resolveBootstrapUrl(config) {
    const normalizedBootstrapUrl = normalizeAbsoluteUrl(config.bootstrapUrl);
    if (normalizedBootstrapUrl) {
      return normalizedBootstrapUrl;
    }

    const appBaseUrl = normalizeAppBaseUrl(config.appBaseUrl);
    const bootstrapPath = normalizeBootstrapPath(config.bootstrapPath || "/apps/cartmind-chat/chat-bootstrap");

    // Shopify app proxy endpoints should stay relative to the storefront origin.
    if (bootstrapPath.indexOf("/apps/") === 0) {
      return bootstrapPath;
    }

    if (appBaseUrl) {
      return `${appBaseUrl}${bootstrapPath}`;
    }

    return bootstrapPath;
  }

  function readConfig(element) {
    const configId = element.dataset.configId;

    if (!configId) {
      return null;
    }

    const configElement = document.getElementById(configId);

    if (!configElement || !configElement.textContent) {
      return null;
    }

    try {
      const parsed = JSON.parse(configElement.textContent);
      return {
        ...parsed,
        bootstrapUrl: resolveBootstrapUrl(parsed),
      };
    } catch {
      return null;
    }
  }

  function normalizeCartSnapshot(payload, fallback) {
    if (!payload || typeof payload !== "object" || !Array.isArray(payload.items)) {
      return fallback;
    }

    return {
      cartId: payload.token || fallback.cartId,
      currencyCode: payload.currency || fallback.currencyCode || "USD",
      items: payload.items
        .map((item) => ({
          lineId: item && item.key ? String(item.key) : undefined,
          productId: item && item.product_id ? String(item.product_id) : "",
          productTitle: item && item.product_title ? String(item.product_title) : "",
          variantId: item && item.variant_id ? String(item.variant_id) : undefined,
          variantTitle: item && item.variant_title ? String(item.variant_title) : "",
          quantity: item && Number(item.quantity || 0) > 0 ? Number(item.quantity) : 1,
        }))
        .filter((item) => item.productId.length > 0),
    };
  }

  function buildCartFingerprint(cart) {
    return [
      cart && cart.cartId ? cart.cartId : "",
      cart && cart.currencyCode ? cart.currencyCode : "",
      ...(cart && Array.isArray(cart.items)
        ? cart.items.map((item) => [item.lineId || "", item.productId || "", item.variantId || "", String(item.quantity || 0)].join("|"))
        : []),
    ].join("::");
  }

  function buildSessionStorageKey(config) {
    return `cartmind-chat:browser:${config.shop}:${config.surface}`;
  }

  function createSessionId() {
    return `cm-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }

  function getOrCreateSessionId(config) {
    const storageKey = buildSessionStorageKey(config);

    try {
      const existing = window.sessionStorage.getItem(storageKey);
      if (existing) {
        return existing;
      }

      const next = createSessionId();
      window.sessionStorage.setItem(storageKey, next);
      return next;
    } catch {
      return createSessionId();
    }
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function resolveDrawerMountAnchor(container) {
    if (!container) return { panel: null, anchor: null };

    // If the container IS the header, return it as the anchor
    if (container.classList.contains("cart-drawer-header") || container.matches(".cart-drawer-header")) {
      return { panel: container, anchor: container };
    }

    const panel = container.matches("#main-nav, .js-menu--right")
      ? container
      : container.querySelector("#main-nav") || container.closest("#main-nav") || container;

    const header = panel.querySelector(".cart-drawer-header") || container.querySelector(".cart-drawer-header");
    if (header) {
      return { panel, anchor: header };
    }

    return {
      panel,
      anchor:
        panel.querySelector(".actions-toolbar-checkout")
        || panel.querySelector(".items-in-cart")
        || panel.querySelector("form")
        || panel,
    };
  }

  function placeDiscoveredRoot(root, container, config) {
    if (config.surface !== "cart_drawer") {
      if (root.parentElement !== container) {
        container.insertAdjacentElement("beforeend", root);
      }
      return;
    }

    const { anchor } = resolveDrawerMountAnchor(container);
    if (!anchor) {
      console.warn("[CartMind] No anchor found in container. Appending to container directly.");
      if (root.parentElement !== container) {
        container.insertAdjacentElement("afterbegin", root);
      }
      return;
    }

    const headerDetail = anchor.querySelector(".header-detail");
    const subtotalElement = anchor.querySelector(".cart-subtotal");
    const titleElement = anchor.querySelector("h4");

    if (headerDetail && subtotalElement) {
      if (root.parentElement !== headerDetail || root.previousElementSibling !== subtotalElement) {
        subtotalElement.insertAdjacentElement("afterend", root);
      }
      console.log("[CartMind] Widget injected below subtotal in header-detail");
      return;
    }

    if (headerDetail && titleElement) {
      if (root.parentElement !== headerDetail || root.previousElementSibling !== titleElement) {
        titleElement.insertAdjacentElement("afterend", root);
      }
      console.log("[CartMind] Widget injected after H4 title in header-detail");
      return;
    }

    const target = headerDetail || anchor;
    if (root.parentElement !== target) {
      target.insertAdjacentElement("afterbegin", root);
    }
    console.log("[CartMind] Widget injected into fallback target");
  }

  function findSurfaceContainer(surface) {
    const selectors = SURFACE_CONTAINER_SELECTORS[surface] || [];
    console.log(`[CartMind] Searching for container among:`, selectors);

    for (let index = 0; index < selectors.length; index += 1) {
      const match = document.querySelector(selectors[index]);
      if (match) {
        console.log(`[CartMind] Found container match:`, selectors[index]);
        return match;
      }
    }

    return null;
  }

  function getOrCreateDiscoveredRoot(sourceElement, config) {
    if (sourceElement.dataset.cartmindAutodiscover !== "true") {
      return sourceElement;
    }

    const placementId = config.placementId || `${config.surface}:default`;
    const container = findSurfaceContainer(config.surface);

    if (!container) {
      return sourceElement;
    }

    let root = document.querySelector(`[data-cartmind-discovered-root="true"][data-cartmind-placement-id="${placementId}"]`);

    if (!root) {
      root = document.createElement("div");
      root.dataset.cartmindChatRoot = "true";
      root.dataset.cartmindDiscoveredRoot = "true";
      root.dataset.cartmindPlacementId = placementId;
      root.dataset.cartmindSurface = config.surface;
      root.dataset.configId = sourceElement.dataset.configId || "";
      root.className = "cartmind-chat-block cartmind-chat-block--discovered";
    }

    placeDiscoveredRoot(root, container, config);
    return root;
  }

  function isCartMutationUrl(url) {
    if (!url) {
      return false;
    }

    return CART_MUTATION_PATHS.some((path) => url === path || url.indexOf(path) >= 0 || url.endsWith(path));
  }

  function extractUrl(input) {
    if (typeof input === "string") {
      return input;
    }

    if (input instanceof URL) {
      return input.href;
    }

    if (input && typeof input.url === "string") {
      return input.url;
    }

    return "";
  }

  function buildThemeStyles() {
    return `
      :host {
        all: initial;
        display: inline-block !important;
        vertical-align: middle !important;
        width: auto !important;
        height: auto !important;
      }

      .cm-root {
        position: relative;
        color: #14213d;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        display: inline-block;
        margin: 2px 4px;
        line-height: normal;
        z-index: 10;
      }

      .cm-launcher {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 5px 12px;
        border-radius: 99px;
        background: #14213d;
        color: #ffffff;
        font-size: 13px;
        font-weight: 700;
        border: 2px solid #ffffff;
        cursor: pointer;
        box-shadow: 0 4px 10px rgba(20, 33, 61, 0.25);
        transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        white-space: nowrap;
        animation: cm-pulse 2s infinite linear;
      }

      @keyframes cm-pulse {
        0% { box-shadow: 0 0 0 0 rgba(20, 33, 61, 0.4); }
        70% { box-shadow: 0 0 0 10px rgba(20, 33, 61, 0); }
        100% { box-shadow: 0 0 0 0 rgba(20, 33, 61, 0); }
      }

      .cm-launcher:hover {
        background: #c97b2d;
        transform: scale(1.08);
        animation: none;
      }

      .cm-launcher__badge {
        background: #c97b2d;
        color: #ffffff;
        padding: 1px 5px;
        border-radius: 4px;
        font-size: 10px;
        font-weight: 800;
        text-transform: uppercase;
      }

      .cm-panel {
        position: fixed;
        top: 80px;
        right: 20px;
        width: 380px;
        height: 600px;
        max-width: calc(100vw - 40px);
        max-height: calc(100vh - 100px);
        z-index: 2147483647;
        border: none;
        border-radius: 24px;
        overflow: hidden;
        background: #ffffff;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.25);
        display: flex;
        flex-direction: column;
        animation: cm-fade-in 0.3s cubic-bezier(0.16, 1, 0.3, 1);
      }

      @keyframes cm-fade-in {
        from { transform: translateY(15px); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
      }

      .cm-panel[hidden] {
        display: none !important;
      }

      .cm-panel__header {
        padding: 20px 24px;
        background: #14213d;
        color: #ffffff;
        display: flex;
        align-items: center;
        justify-content: space-between;
        flex: none;
      }

      .cm-panel__title {
        margin: 0;
        font-size: 17px;
        font-weight: 700;
        color: #ffffff;
      }

      .cm-panel__meta {
        font-size: 12px;
        opacity: 0.8;
        margin-top: 2px;
      }

      .cm-icon-button {
        width: 32px;
        height: 32px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(255, 255, 255, 0.12);
        border: none;
        border-radius: 99px;
        color: #ffffff;
        font-size: 20px;
        cursor: pointer;
        transition: background 0.2s;
      }

      .cm-icon-button:hover {
        background: rgba(255, 255, 255, 0.22);
      }

      .cm-panel__body {
        flex: 1;
        display: flex;
        flex-direction: column;
        min-height: 0;
        background: #ffffff;
      }

      .cm-cart-summary {
        background: #f7f9fc;
        padding: 12px 24px;
        font-size: 12px;
        color: #4f5d75;
        border-bottom: 1px solid #edf1f7;
        line-height: 1.4;
      }

      .cm-messages {
        flex: 1;
        overflow-y: auto;
        padding: 24px;
        display: flex;
        flex-direction: column;
        gap: 16px;
        scroll-behavior: smooth;
      }

      .cm-message {
        max-width: 85%;
        padding: 12px 16px;
        border-radius: 18px;
        font-size: 14px;
        line-height: 1.5;
        position: relative;
        word-break: break-word;
      }

      .cm-message--assistant {
        align-self: flex-start;
        background: #f1f3f7;
        color: #1a2333;
        border-bottom-left-radius: 4px;
      }

      .cm-message--user {
        align-self: flex-end;
        background: #14213d;
        color: #ffffff;
        border-bottom-right-radius: 4px;
      }

      .cm-message__label {
        display: block;
        font-size: 10px;
        font-weight: 800;
        text-transform: uppercase;
        margin-bottom: 4px;
        opacity: 0.6;
      }

      .cm-message__content {
        white-space: pre-wrap;
      }

      .cm-guidance-list {
        display: grid;
        gap: 8px;
        margin-top: 10px;
      }

      .cm-guidance-card {
        border: 1px solid #e3e7ef;
        border-radius: 12px;
        background: #ffffff;
        padding: 10px 12px;
      }

      .cm-guidance-card strong {
        display: block;
        font-size: 12px;
        margin-bottom: 4px;
      }

      .cm-guidance-card p {
        margin: 0;
        font-size: 12px;
        color: #40516d;
      }

      .cm-action-card {
        border: 1px solid #e3e7ef;
        border-radius: 12px;
        background: #ffffff;
        padding: 10px 12px;
        margin-top: 10px;
      }

      .cm-action-card strong {
        display: block;
        font-size: 12px;
        margin-bottom: 4px;
      }

      .cm-action-card p {
        margin: 6px 0 0;
        font-size: 12px;
        color: #40516d;
      }

      .cm-action-preview {
        color: #5b6c88;
      }

      .cm-action-status {
        color: #14213d;
        font-weight: 600;
      }

      .cm-action-buttons {
        display: flex;
        gap: 8px;
        margin-top: 10px;
      }

      .cm-action-button {
        border: none;
        border-radius: 999px;
        padding: 7px 12px;
        font-size: 12px;
        font-weight: 700;
        cursor: pointer;
      }

      .cm-action-button:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }

      .cm-action-button--approve {
        background: #14213d;
        color: #ffffff;
      }

      .cm-action-button--decline {
        background: #edf1f7;
        color: #14213d;
      }

      .cm-error {
        margin: 10px 24px;
        padding: 10px 14px;
        background: #fff1f0;
        color: #cf1322;
        border-radius: 10px;
        font-size: 12px;
      }

      .cm-form {
        padding: 20px 24px;
        background: #ffffff;
        border-top: 1px solid #edf1f7;
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      .cm-form textarea {
        width: 100%;
        min-height: 80px;
        max-height: 160px;
        border: 1px solid #d8dde6;
        border-radius: 16px;
        padding: 12px 16px;
        font: inherit;
        font-size: 14px;
        line-height: 1.5;
        resize: none;
        box-sizing: border-box;
        transition: all 0.2s;
      }

      .cm-form textarea:focus {
        outline: none;
        border-color: #14213d;
        box-shadow: 0 0 0 3px rgba(20, 33, 61, 0.08);
      }

      .cm-form__actions {
        display: flex;
        align-items: center;
        justify-content: space-between;
      }

      .cm-form__hint {
        font-size: 11px;
        color: #94a3b8;
      }

      .cm-submit {
        background: #c97b2d;
        color: #ffffff;
        border: none;
        border-radius: 99px;
        padding: 8px 18px;
        font-size: 13px;
        font-weight: 700;
        cursor: pointer;
        transition: all 0.2s;
      }

      .cm-submit:hover:not(:disabled) {
        background: #b56b25;
      }

      .cm-submit:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      @media (max-width: 640px) {
        .cm-panel {
          top: 0;
          right: 0;
          width: 100vw;
          height: 100vh;
          max-width: none;
          max-height: none;
          border-radius: 0;
        }
      }
    `;
  }

  function renderGuidanceBlock(block) {
    if (!block || typeof block !== "object") {
      return "";
    }

    if (block.type === "recommendation_list") {
      const items = Array.isArray(block.items)
        ? block.items.slice(0, 4).map((item) => `<li><strong>${escapeHtml(item.title || item.productTitle || "Recommendation")}</strong> ${escapeHtml(item.reason || "")}</li>`).join("")
        : "";
      return `<div class="cm-guidance-card"><strong>${escapeHtml(block.title)}</strong><p>${escapeHtml(block.summary)}</p>${items ? `<ul>${items}</ul>` : ""}</div>`;
    }

    if (block.type === "size_summary") {
      const highlights = Array.isArray(block.highlights)
        ? block.highlights.map((item) => `<li>${escapeHtml(item)}</li>`).join("")
        : "";
      return `<div class="cm-guidance-card"><strong>${escapeHtml(block.title)}</strong><p>${escapeHtml(block.summary)}</p>${highlights ? `<ul>${highlights}</ul>` : ""}</div>`;
    }

    if (block.type === "comparison_table") {
      return `<div class="cm-guidance-card"><strong>${escapeHtml(block.title)}</strong><p>${escapeHtml(block.summary)}</p></div>`;
    }

    if (block.type === "budget_optimization") {
      return `<div class="cm-guidance-card"><strong>${escapeHtml(block.title)}</strong><p>${escapeHtml(block.summary)}</p></div>`;
    }

    if (block.type === "fallback_notice") {
      return `<div class="cm-guidance-card"><strong>${escapeHtml(block.title)}</strong><p>${escapeHtml(block.summary)}</p></div>`;
    }

    return "";
  }

  function describeCartAction(action) {
    if (!action || !action.payload) {
      return "Review this cart action before confirming.";
    }

    if (action.preview && action.preview.after) {
      return action.preview.after;
    }

    switch (action.payload.actionType) {
      case "add":
        return `Add ${action.payload.quantity || 1} item(s) to the cart.`;
      case "remove":
        return "Remove the selected item from the cart.";
      case "change_quantity":
        return `Change quantity to ${action.payload.quantity || 1}.`;
      case "swap_variant":
        return "Replace the selected variant in the cart.";
      default:
        return "Review this cart action before confirming.";
    }
  }

  function renderActionStatus(action, state) {
    const status = state.actionStatusById && action ? state.actionStatusById[action.actionId] : null;
    if (!status) {
      return "";
    }

    const summary = status.summary ? ` - ${escapeHtml(status.summary)}` : "";
    return `<p class="cm-action-status">Status: ${escapeHtml(status.status)}${summary}</p>`;
  }

  function renderActionProposal(action, state) {
    if (!action || !action.payload) {
      return "";
    }

    const isCartAction = ["add", "remove", "change_quantity", "swap_variant"].indexOf(action.payload.actionType) >= 0;
    if (!isCartAction) {
      return `
        <div class="cm-guidance-card">
          <strong>${escapeHtml(action.toolName || "Action available")}</strong>
          <p>${escapeHtml(describeCartAction(action))}</p>
        </div>
      `;
    }

    const isPending = state.pendingActionId === action.actionId;
    const status = state.actionStatusById && state.actionStatusById[action.actionId];
    const isResolved = status && ["executed", "failed", "declined", "expired"].indexOf(status.status) >= 0;

    return `
      <div class="cm-action-card">
        <strong>${escapeHtml(action.toolName || "Cart action")}</strong>
        <p>${escapeHtml(describeCartAction(action))}</p>
        ${action.preview && action.preview.before ? `<p class="cm-action-preview">Before: ${escapeHtml(action.preview.before)}</p>` : ""}
        ${action.preview && action.preview.after ? `<p class="cm-action-preview">After: ${escapeHtml(action.preview.after)}</p>` : ""}
        ${renderActionStatus(action, state)}
        ${isResolved ? "" : `
          <div class="cm-action-buttons">
            <button class="cm-action-button cm-action-button--approve" type="button" data-action="approve-cart-action" data-action-id="${escapeHtml(action.actionId)}" ${isPending ? "disabled" : ""}>${isPending ? "Applying..." : "Approve"}</button>
            <button class="cm-action-button cm-action-button--decline" type="button" data-action="decline-cart-action" data-action-id="${escapeHtml(action.actionId)}" ${isPending ? "disabled" : ""}>Decline</button>
          </div>
        `}
      </div>
    `;
  }

  function updateActionStatus(state, actionId, status, summary) {
    if (!state.actionStatusById) {
      state.actionStatusById = {};
    }

    state.actionStatusById[actionId] = {
      actionId,
      status,
      summary: summary || "",
    };
  }

  function applyUpdatedCart(state, cart) {
    if (!cart || typeof cart !== "object" || !Array.isArray(cart.items)) {
      return;
    }

    state.cart = {
      cartId: cart.cartId || state.cart.cartId,
      currencyCode: cart.currencyCode || state.cart.currencyCode || "USD",
      items: cart.items.map((item) => ({
        lineId: item.lineId,
        productId: item.productId,
        productTitle: item.productTitle || "",
        variantId: item.variantId,
        variantTitle: item.variantTitle || "",
        quantity: Number(item.quantity || 1),
      })),
    };
    state.cartFingerprint = buildCartFingerprint(state.cart);
  }

  function getConfirmationUrl() {
    return "/apps/cartmind-chat/chat-actions-confirm";
  }

  async function readCartAjaxError(response) {
    const payload = await response.json().catch(() => null);
    return (payload && (payload.description || payload.message)) || `Cart request failed with status ${response.status}.`;
  }

  function normalizeAjaxMerchandiseId(rawValue) {
    if (typeof rawValue !== "string") {
      return "";
    }

    const trimmed = rawValue.trim();
    if (!trimmed) {
      return "";
    }

    const segments = trimmed.split("/");
    return segments[segments.length - 1] || trimmed;
  }

  async function postStorefrontCartMutation(path, body) {
    const response = await window.fetch(path, {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(await readCartAjaxError(response));
    }
  }

  async function fetchLatestStorefrontCart(fallbackCart) {
    const response = await window.fetch("/cart.js", {
      method: "GET",
      credentials: "same-origin",
      headers: {
        accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(await readCartAjaxError(response));
    }

    const payload = await response.json().catch(() => null);
    return normalizeCartSnapshot(payload, fallbackCart);
  }

  function getCartItemCount(cart) {
    if (!cart || !Array.isArray(cart.items)) {
      return 0;
    }

    return cart.items.reduce((sum, item) => sum + Number(item && item.quantity ? item.quantity : 0), 0);
  }

  function updateThemeCartBadges(cart) {
    const cartCount = getCartItemCount(cart);
    const allCartCountSpans = document.querySelectorAll(".cart-count-bubble span.header-cart-item");
    const allCartCountBubbles = document.querySelectorAll(".cart-count-bubble");
    const drawerContexts = document.querySelectorAll(".js-menu__context");

    allCartCountSpans.forEach((span) => {
      span.textContent = String(cartCount);
    });

    allCartCountBubbles.forEach((bubble) => {
      if (cartCount > 0) {
        bubble.classList.remove("cart-item-zero");
        bubble.style.display = "";
      } else {
        bubble.classList.add("cart-item-zero");
        bubble.style.display = "none";
      }
    });

    drawerContexts.forEach((context) => {
      if (cartCount > 0) {
        context.classList.remove("cart-zero-opacity");
      } else {
        context.classList.add("cart-zero-opacity");
      }
    });
  }

  function replaceIfPresent(container, nextDocument, selector) {
    if (!container) {
      return;
    }

    const currentNode = container.querySelector(selector);
    const nextNode = nextDocument.querySelector(selector);

    if (currentNode && nextNode) {
      currentNode.replaceWith(nextNode);
    }
  }

  async function refreshThemeCartDrawer(cart) {
    const drawerContexts = Array.from(document.querySelectorAll(".js-menu__context"));

    updateThemeCartBadges(cart);

    if (drawerContexts.length === 0) {
      return;
    }

    const response = await window.fetch("/cart?view=sidecart", {
      method: "GET",
      credentials: "same-origin",
      headers: {
        accept: "text/html",
      },
    });

    if (!response.ok) {
      throw new Error(`Drawer refresh failed with status ${response.status}.`);
    }

    const html = await response.text();
    const nextDocument = new DOMParser().parseFromString(html, "text/html");

    drawerContexts.forEach((container) => {
      replaceIfPresent(container, nextDocument, ".cart-drawer-header");
      replaceIfPresent(container, nextDocument, ".shopping-cart-items");
      replaceIfPresent(container, nextDocument, ".cart-original-subtotal-mobile");
      replaceIfPresent(container, nextDocument, ".cart-all-discounts-mobile");
      replaceIfPresent(container, nextDocument, ".cart-total-mobile");
      replaceIfPresent(container, nextDocument, ".actions-toolbar-checkout");
      replaceIfPresent(container, nextDocument, ".free-shipping-progress-wrapper");
    });

    const maybeFreeShippingCheckTags = window.freeShippingCheckTags;
    if (typeof maybeFreeShippingCheckTags === "function") {
      maybeFreeShippingCheckTags();
    }

    const maybeResizeCartItemsSection = window.resizeCartItemsSection;
    if (typeof maybeResizeCartItemsSection === "function") {
      maybeResizeCartItemsSection();
    }

    document.dispatchEvent(new CustomEvent("Flits:AjaxCart:CartUpdated", {
      bubbles: true,
      detail: {
        source: "cartmind-chat",
        cart,
      },
    }));

    document.dispatchEvent(new CustomEvent("Flits:AjaxCart:CartRendered", {
      bubbles: true,
      detail: {
        source: "cartmind-chat",
        cart,
      },
    }));

    queueMountAll();
  }

  async function applyStorefrontCartAction(action, currentCart) {
    if (!action || !action.payload) {
      return currentCart;
    }

    switch (action.payload.actionType) {
      case "add": {
        const variantId = normalizeAjaxMerchandiseId(action.payload.merchandiseId);
        if (!variantId) {
          throw new Error("Requested variant is invalid for add-to-cart.");
        }

        await postStorefrontCartMutation("/cart/add.js", {
          id: variantId,
          quantity: action.payload.quantity,
        });
        break;
      }

      case "remove": {
        await postStorefrontCartMutation("/cart/change.js", {
          id: action.payload.lineId,
          quantity: 0,
        });
        break;
      }

      case "change_quantity": {
        await postStorefrontCartMutation("/cart/change.js", {
          id: action.payload.lineId,
          quantity: action.payload.quantity,
        });
        break;
      }

      case "swap_variant": {
        const currentLine = currentCart.items.find((item) => item.lineId === action.payload.lineId);
        if (!currentLine || !currentLine.variantId) {
          throw new Error("Swap target line is no longer available in the cart.");
        }

        const nextVariantId = normalizeAjaxMerchandiseId(action.payload.newMerchandiseId);
        const previousVariantId = normalizeAjaxMerchandiseId(currentLine.variantId);
        const nextQuantity = action.payload.quantity || currentLine.quantity || 1;

        if (!nextVariantId) {
          throw new Error("Requested swap variant is invalid.");
        }

        await postStorefrontCartMutation("/cart/change.js", {
          id: action.payload.lineId,
          quantity: 0,
        });

        try {
          await postStorefrontCartMutation("/cart/add.js", {
            id: nextVariantId,
            quantity: nextQuantity,
          });
        } catch (error) {
          if (previousVariantId) {
            await postStorefrontCartMutation("/cart/add.js", {
              id: previousVariantId,
              quantity: currentLine.quantity,
            }).catch(() => undefined);
          }

          throw error;
        }
        break;
      }

      default:
        return currentCart;
    }

    return await fetchLatestStorefrontCart(currentCart);
  }

  async function submitActionConfirmation(instance, action, decision) {
    const state = instance.state;
    state.pendingActionId = action.actionId;
    state.error = "";
    render(instance);

    try {
      await ensureBootstrap(instance);

      const response = await window.fetch(getConfirmationUrl(), {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          shop: state.config.shop,
          sessionKey: action.sessionKey,
          actionId: action.actionId,
          confirmationToken: action.confirmationToken,
          decision,
          actionType: "cart_tool",
          cart: state.cart,
        }),
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload || payload.ok !== true || !payload.result) {
        throw new Error((payload && payload.error && payload.error.message) || `Confirmation failed with status ${response.status}.`);
      }

      let nextCart = payload.result.cart;

      if (decision === "approve") {
        nextCart = await applyStorefrontCartAction(action, state.cart);
      }

      updateActionStatus(state, payload.result.actionId, payload.result.status, payload.result.summary || "");
      if (nextCart) {
        applyUpdatedCart(state, nextCart);
        await refreshThemeCartDrawer(nextCart);
      }
      state.statusMessage = payload.result.summary || (decision === "approve" ? "Action completed." : "Action declined.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to confirm this cart action.";
      updateActionStatus(state, action.actionId, "failed", message);
      state.error = message;
      state.statusMessage = "Action confirmation failed.";
    } finally {
      state.pendingActionId = "";
      render(instance);
    }
  }

  function buildMessagesPayload(messages, pendingUserMessage) {
    const payload = [];

    for (let index = 0; index < messages.length; index += 1) {
      const message = messages[index];

      if (!message || !message.content || !message.content.trim()) {
        continue;
      }

      payload.push({
        role: message.role,
        content: message.content,
      });
    }

    payload.push({
      role: "user",
      content: pendingUserMessage,
    });

    return payload;
  }

  function extractSsePayloads(buffer) {
    const frames = buffer.split("\n\n");
    const remainder = frames.pop() || "";
    const payloads = [];

    for (let index = 0; index < frames.length; index += 1) {
      const lines = frames[index].split("\n");
      for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
        const line = lines[lineIndex];
        if (line.indexOf("data: ") === 0) {
          payloads.push(line.slice(6));
        }
      }
    }

    return { payloads, remainder };
  }

  function render(instance) {
    const state = instance.state;
    const labels = state.config.labels || {};
    console.log(`[CartMind] Rendering state:`, { panelOpen: state.panelOpen, cartItems: state.cart.items.length });
    const totalItems = state.cart.items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
    const subtitle = totalItems > 0
      ? `${totalItems} item${totalItems > 1 ? "s" : ""} detected in cart`
      : "Waiting for cart items";
    const cartLines = totalItems > 0
      ? state.cart.items.slice(0, 3).map((item) => `${escapeHtml(item.productTitle || "Product")} x${escapeHtml(item.quantity)}`).join("<br>")
      : "Add at least one product to enable cart-aware answers.";
    const messagesHtml = state.messages.map((message) => `
      <article class="cm-message cm-message--${escapeHtml(message.role)}">
        <span class="cm-message__label">${message.role === "assistant" ? "CartMind" : "You"}</span>
        <div class="cm-message__content">${escapeHtml(message.content || (message.role === "assistant" && state.sending ? "Thinking..." : ""))}</div>
        ${Array.isArray(message.guidanceBlocks) && message.guidanceBlocks.length > 0
          ? `<div class="cm-guidance-list">${message.guidanceBlocks.map((block) => renderGuidanceBlock(block)).join("")}</div>`
          : ""}
        ${Array.isArray(message.actionProposals) && message.actionProposals.length > 0
          ? `<div class="cm-guidance-list">${message.actionProposals.map((action) => renderActionProposal(action, state)).join("")}</div>`
          : ""}
      </article>
    `).join("");

    instance.mountNode.innerHTML = `
      <div class="cm-root">
        ${state.config.features && state.config.features.showChatEntry === false ? "" : `
          <button class="cm-launcher" type="button" data-action="toggle-panel" aria-expanded="${state.panelOpen ? "true" : "false"}">
            <span class="cm-launcher__badge">AI</span>
            <span class="cm-launcher__title">${escapeHtml(labels.launcherLabel || "Chat")}</span>
          </button>
        `}
        <section class="cm-panel" ${state.panelOpen ? "" : "hidden"}>
          <header class="cm-panel__header">
            <div>
              <h1 class="cm-panel__title">${escapeHtml(labels.panelTitle || state.config.panelTitle || "Assistant")}</h1>
              <div class="cm-panel__meta">${escapeHtml(state.statusMessage || subtitle)}</div>
            </div>
            <button class="cm-icon-button" type="button" data-action="close-panel" aria-label="Close chat">×</button>
          </header>
          <div class="cm-panel__body">
            <div class="cm-cart-summary">${cartLines}</div>
            <div class="cm-messages">${messagesHtml}</div>
            ${state.error ? `<div class="cm-error">${escapeHtml(state.error)}</div>` : ""}
            <form class="cm-form" data-role="chat-form">
              <textarea name="message" placeholder="Ask about fit, comparisons, or what pairs well with this cart." ${state.sending || totalItems === 0 ? "disabled" : ""}>${escapeHtml(state.draft)}</textarea>
              <div class="cm-form__actions">
                <span class="cm-form__hint">${totalItems === 0 ? "Cart required" : "Cart-aware assistant"}</span>
                <button class="cm-submit" type="submit" ${state.sending || totalItems === 0 ? "disabled" : ""}>${state.sending ? "Sending..." : "Send"}</button>
              </div>
            </form>
          </div>
        </section>
      </div>
    `;

    const toggleButton = instance.mountNode.querySelector('[data-action="toggle-panel"]');
    const closeButton = instance.mountNode.querySelector('[data-action="close-panel"]');
    const form = instance.mountNode.querySelector('[data-role="chat-form"]');
    const textarea = instance.mountNode.querySelector('textarea[name="message"]');
    const messagesContainer = instance.mountNode.querySelector(".cm-messages");
    const actionButtons = instance.mountNode.querySelectorAll("[data-action-id][data-action]");

    if (toggleButton) {
      toggleButton.addEventListener("click", () => {
        state.panelOpen = !state.panelOpen;
        render(instance);
      });
    }

    if (closeButton) {
      closeButton.addEventListener("click", () => {
        state.panelOpen = false;
        render(instance);
      });
    }

    if (textarea) {
      textarea.addEventListener("input", (event) => {
        state.draft = event.target.value;
      });
    }

    if (form) {
      form.addEventListener("submit", (event) => {
        event.preventDefault();
        void submitMessage(instance);
      });
    }

    if (actionButtons && actionButtons.length > 0) {
      actionButtons.forEach((button) => {
        button.addEventListener("click", () => {
          const actionId = button.getAttribute("data-action-id") || "";
          const actionType = button.getAttribute("data-action") || "";
          const action = state.messages
            .flatMap((message) => Array.isArray(message.actionProposals) ? message.actionProposals : [])
            .find((item) => item && item.actionId === actionId);

          if (!action) {
            return;
          }

          void submitActionConfirmation(
            instance,
            action,
            actionType === "approve-cart-action" ? "approve" : "decline",
          );
        });
      });
    }

    if (messagesContainer) {
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
  }

  function bindRoot(instance, rootElement) {
    if (instance.root === rootElement && instance.shadowRoot && instance.mountNode) {
      return;
    }

    instance.root = rootElement;
    instance.shadowRoot = rootElement.shadowRoot || rootElement.attachShadow({ mode: "open" });
    const styleElement = document.createElement("style");
    const mountNode = document.createElement("div");

    styleElement.textContent = buildThemeStyles();
    instance.shadowRoot.replaceChildren(styleElement, mountNode);
    instance.mountNode = mountNode;
  }

  function createInitialState(config) {
    return {
      config,
      cart: config.cart || { cartId: undefined, currencyCode: "USD", items: [] },
      cartFingerprint: buildCartFingerprint(config.cart || { currencyCode: "USD", items: [] }),
      panelOpen: config.features && config.features.showChatEntry === false,
      sending: false,
      draft: "",
      error: "",
      statusMessage: "",
      pendingActionId: "",
      actionStatusById: {},
      sessionId: getOrCreateSessionId(config),
      sessionKey: "",
      streamToken: "",
      streamTokenExpiresAt: "",
      chatUrl: "",
      messages: [
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: (config.labels && config.labels.assistantGreeting) || config.assistantGreeting || "Ask about fit, comparisons, or what works well with the items already in your cart.",
          guidanceBlocks: [],
        },
      ],
    };
  }

  function getPlacementId(config) {
    return config.placementId || `${config.surface}:default`;
  }

  function ensureInstance(rootElement, config) {
    const placementId = getPlacementId(config);
    let instance = instances.get(placementId);

    if (!instance) {
      instance = {
        placementId,
        root: null,
        shadowRoot: null,
        mountNode: null,
        state: createInitialState(config),
        pendingCartSync: null,
      };
      instances.set(placementId, instance);
    }

    instance.state.config = config;
    bindRoot(instance, rootElement);
    return instance;
  }

  async function fetchLatestCart(instance, source) {
    try {
      const response = await window.fetch("/cart.js", {
        method: "GET",
        credentials: "same-origin",
      });

      if (!response.ok) {
        return;
      }

      const payload = await response.json().catch(() => null);
      const nextCart = normalizeCartSnapshot(payload, instance.state.cart);
      const nextFingerprint = buildCartFingerprint(nextCart);

      if (nextFingerprint === instance.state.cartFingerprint) {
        return;
      }

      instance.state.cart = nextCart;
      instance.state.cartFingerprint = nextFingerprint;
      instance.state.statusMessage = source === "mutation_observer"
        ? "Cart updated from drawer changes."
        : "Cart synced with storefront.";

      if (instance.state.cartId && nextCart.cartId && instance.state.cartId !== nextCart.cartId) {
        instance.state.sessionKey = "";
        instance.state.streamToken = "";
        instance.state.streamTokenExpiresAt = "";
        instance.state.chatUrl = "";
      }

      render(instance);
    } catch {
      instance.state.statusMessage = "Unable to refresh the cart snapshot.";
      render(instance);
    }
  }

  function queueCartSync(instance, source) {
    if (instance.pendingCartSync) {
      return;
    }

    instance.pendingCartSync = window.requestAnimationFrame(() => {
      instance.pendingCartSync = null;
      void fetchLatestCart(instance, source);
    });
  }

  async function ensureBootstrap(instance) {
    const state = instance.state;
    const now = Date.now();
    const expiresAt = state.streamTokenExpiresAt ? Date.parse(state.streamTokenExpiresAt) : 0;

    if (state.sessionKey && state.streamToken && state.chatUrl && expiresAt > now + 5_000) {
      return {
        sessionKey: state.sessionKey,
        streamToken: state.streamToken,
        chatUrl: state.chatUrl,
      };
    }

    const response = await window.fetch(state.config.bootstrapUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        shop: state.config.shop,
        cartId: state.cart.cartId,
        surface: state.config.surface,
        sessionId: state.sessionId,
        currencyCode: state.cart.currencyCode || "USD",
      }),
    });

    const payload = await response.json().catch(() => null);

    if (!response.ok || !payload || payload.ok !== true || !payload.bootstrap) {
      throw new Error((payload && payload.error && payload.error.message) || "Chat bootstrap failed.");
    }

    state.sessionKey = payload.bootstrap.sessionKey;
    state.streamToken = payload.bootstrap.streamToken;
    state.streamTokenExpiresAt = payload.bootstrap.expiresAt;
    state.chatUrl = payload.bootstrap.chatUrl;
    state.cartId = payload.bootstrap.cartId || state.cart.cartId || "";

    return {
      sessionKey: state.sessionKey,
      streamToken: state.streamToken,
      chatUrl: state.chatUrl,
    };
  }

  function appendGuidanceBlock(message, block) {
    if (!message.guidanceBlocks) {
      message.guidanceBlocks = [];
    }

    message.guidanceBlocks.push(block);
  }

  function handleStreamPart(instance, message, part) {
    if (!part || typeof part !== "object") {
      return;
    }

    if (part.type === "text-delta") {
      message.content += part.text || "";
      render(instance);
      return;
    }

    if (part.type === "guidance-block") {
      appendGuidanceBlock(message, part.block);
      render(instance);
      return;
    }

    if (part.type === "tool-action-status") {
      updateActionStatus(instance.state, part.actionId, part.status || "proposed", part.summary || "");
      if (part.cart) {
        applyUpdatedCart(instance.state, part.cart);
      }
      render(instance);
      return;
    }

    if (part.type === "comparison.result") {
      appendGuidanceBlock(message, {
        type: "comparison_table",
        title: "Product comparison",
        summary: part.comparison && part.comparison.recommendation && part.comparison.recommendation.rationale
          ? part.comparison.recommendation.rationale
          : "Comparison completed.",
      });
      render(instance);
      return;
    }

    if (part.type === "budget-optimization.result") {
      appendGuidanceBlock(message, {
        type: "budget_optimization",
        title: "Budget optimization",
        summary: part.optimization && part.optimization.summary ? part.optimization.summary : "Budget optimization completed.",
      });
      render(instance);
      return;
    }

    if (part.type === "comparison.error" || part.type === "budget-optimization.error") {
      appendGuidanceBlock(message, {
        type: "fallback_notice",
        title: "Guidance unavailable",
        summary: part.error && part.error.message ? part.error.message : "The requested guidance could not be generated.",
      });
      render(instance);
      return;
    }

    if (part.type === "tool-action-proposed") {
      if (!Array.isArray(message.actionProposals)) {
        message.actionProposals = [];
      }

      message.actionProposals.push(part.action);
      updateActionStatus(instance.state, part.action.actionId, "proposed", "Awaiting confirmation.");
      render(instance);
      return;
    }

    if (part.type === "error") {
      throw new Error(part.message || "The chat stream returned an error.");
    }
  }

  async function streamAssistantReply(instance, assistantMessage, userText) {
    const bootstrap = await ensureBootstrap(instance);
    const response = await window.fetch(bootstrap.chatUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        shop: instance.state.config.shop,
        sessionKey: bootstrap.sessionKey,
        streamToken: bootstrap.streamToken,
        cart: instance.state.cart,
        messages: buildMessagesPayload(instance.state.messages.slice(0, -2), userText),
      }),
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      throw new Error((payload && payload.error && payload.error.message) || `Chat request failed with status ${response.status}.`);
    }

    if (!response.body) {
      throw new Error("The chat stream returned no response body.");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    let streamComplete = false;

    while (!streamComplete) {
      const chunk = await reader.read();

      if (chunk.done) {
        streamComplete = true;
        break;
      }

      buffer += decoder.decode(chunk.value, { stream: true });
      const extracted = extractSsePayloads(buffer);
      buffer = extracted.remainder;

      for (let index = 0; index < extracted.payloads.length; index += 1) {
        const payload = extracted.payloads[index];
        const part = JSON.parse(payload);
        handleStreamPart(instance, assistantMessage, part);
      }
    }
  }

  async function submitMessage(instance) {
    const state = instance.state;
    const draft = state.draft.trim();

    if (!draft || state.sending || !state.cart.items.length) {
      return;
    }

    const timestamp = Date.now();
    const userMessage = {
      id: `user-${timestamp}`,
      role: "user",
      content: draft,
      guidanceBlocks: [],
    };
    const assistantMessage = {
      id: `assistant-${timestamp}`,
      role: "assistant",
      content: "",
      guidanceBlocks: [],
    };

    state.messages.push(userMessage, assistantMessage);
    state.draft = "";
    state.sending = true;
    state.panelOpen = true;
    state.error = "";
    state.statusMessage = "Contacting CartMind...";
    render(instance);

    try {
      await streamAssistantReply(instance, assistantMessage, draft);
      state.statusMessage = "Reply received.";
    } catch (error) {
      const fallbackMessage = (state.config.labels && state.config.labels.fallbackMessage) || state.config.fallbackMessage || "CartMind guidance is temporarily unavailable. Your cart still works normally.";
      assistantMessage.content = assistantMessage.content || fallbackMessage;
      state.error = error instanceof Error ? error.message : fallbackMessage;
      state.statusMessage = "Chat request failed.";
    } finally {
      state.sending = false;
      render(instance);
    }
  }

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

  function mountChatWidget(element) {
    const config = readConfig(element);

    if (!config) {
      return;
    }

    const rootElement = getOrCreateDiscoveredRoot(element, config);

    if (rootElement !== element) {
      mountChatWidget(rootElement);
      return;
    }

    const instance = ensureInstance(rootElement, config);
    render(instance);
    queueCartSync(instance, "initial_config");
  }

  function notifyCartMutation(source) {
    instances.forEach((instance) => {
      queueCartSync(instance, source);
    });
  }

  function installFetchInterceptor() {
    if (fetchPatched || typeof window.fetch !== "function") {
      return;
    }

    const originalFetch = window.fetch.bind(window);
    window.fetch = function cartmindFetchInterceptor(input, init) {
      const url = extractUrl(input);

      return originalFetch(input, init).then((response) => {
        if (response.ok && isCartMutationUrl(url)) {
          notifyCartMutation("fetch_intercept");
        }
        return response;
      });
    };
    fetchPatched = true;
  }

  function installXhrInterceptor() {
    if (xhrPatched || typeof window.XMLHttpRequest === "undefined") {
      return;
    }

    const originalOpen = window.XMLHttpRequest.prototype.open;
    const originalSend = window.XMLHttpRequest.prototype.send;

    window.XMLHttpRequest.prototype.open = function cartmindOpen(method, url) {
      this.__cartmindUrl = typeof url === "string" ? url : "";
      return originalOpen.apply(this, arguments);
    };

    window.XMLHttpRequest.prototype.send = function cartmindSend() {
      this.addEventListener("load", () => {
        if (this.status >= 200 && this.status < 300 && isCartMutationUrl(this.__cartmindUrl || "")) {
          notifyCartMutation("xhr_intercept");
        }
      });
      return originalSend.apply(this, arguments);
    };

    xhrPatched = true;
  }

  function installMutationObserver() {
    if (observerStarted || !document.body) {
      return;
    }

    const observer = new MutationObserver((mutations) => {
      let shouldMount = false;
      let shouldSyncCart = false;

      for (let index = 0; index < mutations.length; index += 1) {
        const mutation = mutations[index];

        if (mutation.type === "childList") {
          const nodes = Array.from(mutation.addedNodes).concat(Array.from(mutation.removedNodes));
          if (nodes.some((node) => node instanceof HTMLElement && (
            node.matches(".js-menu__context, #main-nav, .actions-toolbar-checkout, [data-cartmind-chat-root], cart-drawer, #CartDrawer")
            || (typeof node.querySelector === "function" && node.querySelector(".js-menu__context, #main-nav, .actions-toolbar-checkout, [data-cartmind-chat-root], cart-drawer, #CartDrawer"))
          ))) {
            shouldMount = true;
            shouldSyncCart = true;
            break;
          }
        }

        if (mutation.type === "attributes" && mutation.target instanceof HTMLElement && mutation.attributeName === "class") {
          if (mutation.target.matches(".js-menu__context, .js-menu--right, .cart-drawer, #CartDrawer")) {
            shouldMount = true;
            shouldSyncCart = true;
            break;
          }
        }
      }

      if (shouldMount) {
        queueMountAll();
      }

      if (shouldSyncCart) {
        notifyCartMutation("mutation_observer");
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class"],
    });

    observerStarted = true;
  }

  function installPolling() {
    if (pollStarted) {
      return;
    }

    window.setInterval(() => {
      instances.forEach((instance) => {
        queueCartSync(instance, "fallback_poll");
      });
    }, 5000);

    pollStarted = true;
  }

  function installObservers() {
    installFetchInterceptor();
    installXhrInterceptor();
    installMutationObserver();
    installPolling();
  }

  function mountAll() {
    const configScripts = document.querySelectorAll('script[type="application/json"][id^="cartmind-chat-config-"]');

    for (let index = 0; index < configScripts.length; index += 1) {
      const configScript = configScripts[index];
      const configId = configScript.id;
      const existingSource = document.querySelector(`[data-cartmind-chat-root][data-config-id="${configId}"]`);

      if (!existingSource) {
        const sourceRoot = document.createElement("div");
        sourceRoot.dataset.cartmindChatRoot = "true";
        sourceRoot.dataset.cartmindAutodiscover = "true";
        sourceRoot.dataset.configId = configId;
        sourceRoot.style.display = "none";
        document.body.appendChild(sourceRoot);
      }
    }

    const roots = document.querySelectorAll("[data-cartmind-chat-root]");
    for (let index = 0; index < roots.length; index += 1) {
      mountChatWidget(roots[index]);
    }
    installObservers();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mountAll, { once: true });
  } else {
    mountAll();
  }
})();
