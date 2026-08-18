(() => {
  console.info("[CartMind] Extension script v1.1.3-compatible-image-fallback loaded");

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
  const TYPEWRITER_INTERVAL_MS = 14;
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
          imageUrl: normalizeStorefrontImageUrl(item && (item.image || (item.featured_image && (item.featured_image.url || item.featured_image.src)))) || undefined,
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

    function shouldRunProactiveAnalysis(config) {
      const features = config && config.features ? config.features : {};
      return features.showRecommendations !== false
        || features.showKitCompleteness !== false
        || features.showSizeWarnings !== false;
    }

    function buildProactivePrompt(config) {
      const features = config && config.features ? config.features : {};
      const checks = [];

      if (features.showKitCompleteness !== false) {
        checks.push("les articles manquants pour completer le kit");
      }

      if (features.showSizeWarnings !== false) {
        checks.push("les risques de taille ou de fit");
      }

      if (features.showRecommendations !== false) {
        checks.push("les recommandations utiles pour ce panier");
      }

      return checks.length > 0
        ? `Analyse proactive apres ajout au panier: verifie ${checks.join(", ")}. Reponds brievement et uniquement si une action utile existe.`
        : "Analyse proactive apres ajout au panier.";
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

  function renderInlineText(value) {
    return escapeHtml(value).replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
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

      .cm-message__content strong {
        font-weight: 800;
      }

      .cm-typing-cursor {
        display: inline-block;
        width: 7px;
        margin-left: 1px;
        color: #c97b2d;
        animation: cm-cursor-blink 0.9s steps(2, start) infinite;
      }

      @keyframes cm-cursor-blink {
        0%, 45% { opacity: 1; }
        46%, 100% { opacity: 0; }
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

      .cm-recommendation-block {
        padding: 12px;
      }

      .cm-recommendation-block__header {
        margin-bottom: 10px;
      }

      .cm-recommendation-slider-shell {
        display: grid;
        grid-template-columns: 32px minmax(0, 1fr) 32px;
        gap: 8px;
        align-items: stretch;
      }

      .cm-recommendation-slider,
      .cm-recommendation-grid {
        display: grid;
        gap: 12px;
      }

      .cm-recommendation-slider {
        grid-auto-flow: column;
        grid-auto-columns: minmax(230px, 88%);
        overflow-x: auto;
        overscroll-behavior-x: contain;
        scroll-snap-type: x mandatory;
        scrollbar-width: none;
        min-width: 0;
      }

      .cm-recommendation-slider::-webkit-scrollbar {
        display: none;
      }

      .cm-recommendation-card {
        border: 1px solid #e3e7ef;
        border-radius: 12px;
        background: #ffffff;
        overflow: hidden;
        display: flex;
        flex-direction: column;
        min-height: 100%;
        scroll-snap-align: start;
      }

      .cm-recommendation-media {
        aspect-ratio: 4 / 3;
        background: #f7f9fc;
        border-bottom: 1px solid #edf1f7;
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
      }

      .cm-recommendation-media__img {
        display: block;
        width: 100%;
        height: 100%;
        object-fit: contain;
      }

      .cm-recommendation-media--empty {
        color: #94a3b8;
        font-size: 11px;
        font-weight: 700;
        text-transform: uppercase;
      }

      .cm-recommendation-card__body {
        padding: 10px;
        display: flex;
        flex-direction: column;
        gap: 6px;
        flex: 1;
      }

      .cm-recommendation-title {
        font-size: 12px;
        font-weight: 800;
        color: #14213d;
        line-height: 1.35;
      }

      .cm-recommendation-meta,
      .cm-recommendation-reason,
      .cm-recommendation-outcome,
      .cm-recommendation-status {
        font-size: 11px;
        line-height: 1.45;
        color: #40516d;
      }

      .cm-recommendation-meta {
        color: #6b7c95;
        font-weight: 700;
      }

      .cm-recommendation-status {
        color: #14213d;
        font-weight: 700;
      }

      .cm-reason-chips {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 6px;
        margin-top: 6px;
        margin-bottom: 6px;
      }

      .cm-reason-chips__label {
        font-size: 11px;
        color: #5b6c88;
        font-weight: 700;
      }

      .cm-reason-chip {
        display: inline-flex;
        align-items: center;
        border: 1px solid #c9d6e8;
        border-radius: 999px;
        background: #eef4fb;
        color: #20466e;
        padding: 2px 8px;
        font-size: 10px;
        font-weight: 700;
        text-transform: uppercase;
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

      .cm-action-media {
        margin: 8px 0 6px;
        border-radius: 10px;
        background: #f7f9fc;
        border: 1px solid #edf1f7;
        overflow: hidden;
        text-align: center;
      }

      .cm-action-media__img {
        display: block;
        width: 100%;
        max-height: 180px;
        object-fit: contain;
      }

      .cm-action-preview {
        color: #5b6c88;
      }

      .cm-kit-preview {
        margin: 8px 0 4px;
        border-radius: 10px;
        overflow: hidden;
        background: #f7f9fc;
        text-align: center;
      }

      .cm-kit-preview--loading {
        padding: 10px 12px;
        font-size: 11px;
        color: #94a3b8;
        font-style: italic;
      }

      .cm-kit-preview__img {
        max-width: 100%;
        max-height: 180px;
        object-fit: contain;
        display: block;
        margin: 0 auto;
      }

      .cm-kit-preview--pair {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        padding: 6px;
      }

      .cm-kit-preview--pair .cm-kit-preview__img {
        max-width: 44%;
        max-height: 120px;
      }

      .cm-kit-preview__arrow {
        font-size: 18px;
        color: #94a3b8;
        flex: none;
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

      .cm-compatible-slider-shell {
        display: grid;
        grid-template-columns: 32px minmax(0, 1fr) 32px;
        gap: 8px;
        align-items: center;
      }

      .cm-compatible-slider {
        display: grid;
        grid-auto-flow: column;
        grid-auto-columns: minmax(220px, 82%);
        gap: 12px;
        overflow-x: auto;
        overscroll-behavior-x: contain;
        scroll-snap-type: x mandatory;
        scrollbar-width: none;
        padding: 2px;
        min-width: 263px;
      }

      .cm-compatible-slider::-webkit-scrollbar {
        display: none;
      }

      .cm-compatible-slider .cm-action-card {
        scroll-snap-align: start;
        height: 100%;
      }

      .cm-slider-nav {
        width: 32px;
        height: 32px;
        border: 1px solid #d8dde6;
        border-radius: 999px;
        background: #ffffff;
        color: #14213d;
        cursor: pointer;
        font-size: 20px;
        line-height: 1;
        display: inline-flex;
        align-items: center;
        justify-content: center;
      }

      .cm-slider-nav:hover {
        background: #edf1f7;
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

  function toReasonLabel(tag) {
    switch (String(tag || "").toLowerCase()) {
      case "profile": return "Profil";
      case "history": return "Historique";
      case "size": return "Taille";
      case "kit": return "Kit";
      case "threshold": return "Seuil";
      case "availability": return "Disponibilite";
      case "compatibility": return "Compatibilite";
      case "safety": return "Securite";
      case "fallback": return "Contexte";
      default: return "Signal";
    }
  }

  function renderReasonTags(item, config) {
    const features = config && config.features ? config.features : {};
    const enabled = features.showReasonTags !== false;
    const tags = item && Array.isArray(item.evidenceTags) ? item.evidenceTags : [];

    if (!enabled || tags.length === 0) {
      return "";
    }

    const chips = tags
      .slice(0, 5)
      .map((tag) => `<span class="cm-reason-chip">${escapeHtml(toReasonLabel(tag))}</span>`)
      .join("");

    if (!chips) {
      return "";
    }

    return `<div class="cm-reason-chips"><span class="cm-reason-chips__label">Pourquoi:</span>${chips}</div>`;
  }

  function buildRecommendationItemKey(item, index) {
    return [
      item && item.variantId ? item.variantId : "",
      item && item.productId ? item.productId : "",
      item && (item.title || item.productTitle) ? (item.title || item.productTitle) : "",
      String(index),
    ].join("::");
  }

  function isAddableRecommendation(item) {
    return item
      && item.action === "add"
      && typeof item.variantId === "string"
      && item.variantId.trim().length > 0;
  }

  function renderRecommendationProductImage(item) {
    const imageUrl = normalizeStorefrontImageUrl(item && item.imageUrl);
    if (imageUrl) {
      return `<div class="cm-recommendation-media"><img class="cm-recommendation-media__img" src="${escapeHtml(imageUrl)}" alt="${escapeHtml(item.title || item.productTitle || "Produit recommandé")}" loading="lazy"></div>`;
    }

    return `<div class="cm-recommendation-media cm-recommendation-media--empty">Image produit</div>`;
  }

  function renderRecommendationItem(item, index, state, config) {
    const title = escapeHtml(item.title || item.productTitle || "Recommendation");
    const variant = item.variantTitle ? `<div class="cm-recommendation-meta">${escapeHtml(item.variantTitle)}</div>` : "";
    const price = item.priceLabel ? `<div class="cm-recommendation-meta">${escapeHtml(item.priceLabel)}</div>` : "";
    const reason = item.reason ? `<div class="cm-recommendation-reason">${renderInlineText(item.reason)}</div>` : "";
    const outcome = item.shopperOutcome ? `<div class="cm-recommendation-outcome">${renderInlineText(item.shopperOutcome)}</div>` : "";
    const reasons = renderReasonTags(item, config);
    const key = buildRecommendationItemKey(item, index);
    const status = state && state.recommendationStatusByKey ? state.recommendationStatusByKey[key] : null;
    const isPending = state && state.pendingRecommendationKey === key;
    const addable = isAddableRecommendation(item);
    const added = status && status.status === "added";
    const failed = status && status.status === "failed";
    const statusHtml = status && status.summary
      ? `<div class="cm-recommendation-status">${escapeHtml(status.summary)}</div>`
      : "";
    const buttonHtml = addable
      ? `<button class="cm-action-button cm-action-button--approve" type="button" data-action="add-recommendation-item" data-recommendation-key="${escapeHtml(key)}" data-variant-id="${escapeHtml(item.variantId)}" data-quantity="1" data-title="${title}" ${isPending || added ? "disabled" : ""}>${isPending ? "Ajout..." : added ? "Ajouté" : failed ? "Réessayer" : "Ajouter au panier"}</button>`
      : "";

    return `
      <article class="cm-recommendation-card">
        ${renderRecommendationProductImage(item)}
        <div class="cm-recommendation-card__body">
          <div class="cm-recommendation-title">${title}</div>
          ${variant}
          ${price}
          ${reasons}
          ${reason}
          ${outcome}
          ${statusHtml}
          ${buttonHtml ? `<div class="cm-action-buttons">${buttonHtml}</div>` : ""}
        </div>
      </article>
    `;
  }

  function renderGuidanceBlock(block, config, state) {
    if (!block || typeof block !== "object") {
      return "";
    }

    if (block.type === "recommendation_list") {
      // skip "keep" cards and "add" cards without a resolvable variant to avoid "IMAGE PRODUIT" placeholders
      const items = (Array.isArray(block.items) ? block.items : [])
        .filter((item) => item.action !== "keep" && (item.action !== "add" || (typeof item.variantId === "string" && item.variantId.trim().length > 0)))
        .slice(0, 8);
      const cards = items.map((item, index) => renderRecommendationItem(item, index, state, config)).join("");

      if (!cards) {
        return `<div class="cm-guidance-card"><strong>${escapeHtml(block.title)}</strong><p>${escapeHtml(block.summary)}</p></div>`;
      }

      const body = items.length > 1
        ? `
          <div class="cm-recommendation-slider-shell">
            <button class="cm-slider-nav" type="button" data-action="recommendation-slider-prev" aria-label="Produit recommandé précédent">&lsaquo;</button>
            <div class="cm-recommendation-slider" data-role="recommendation-slider">${cards}</div>
            <button class="cm-slider-nav" type="button" data-action="recommendation-slider-next" aria-label="Produit recommandé suivant">&rsaquo;</button>
          </div>
        `
        : `<div class="cm-recommendation-grid">${cards}</div>`;

      return `<div class="cm-guidance-card cm-recommendation-block"><div class="cm-recommendation-block__header"><strong>${escapeHtml(block.title)}</strong><p>${escapeHtml(block.summary)}</p></div>${body}</div>`;
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

  function normalizeStorefrontImageUrl(rawValue) {
    if (typeof rawValue !== "string" || !rawValue.trim()) {
      return "";
    }

    const trimmed = rawValue.trim();
    if (trimmed.indexOf("//") === 0) {
      return `${window.location.protocol}${trimmed}`;
    }

    return trimmed;
  }

  function pickProductJsonImage(payload, action) {
    if (!payload || typeof payload !== "object") {
      return "";
    }

    const variantId = action && action.payload && action.payload.merchandiseId
      ? String(action.payload.merchandiseId).split("/").pop()
      : "";
    const variants = Array.isArray(payload.variants) ? payload.variants : [];
    const matchedVariant = variants.find((variant) => variant && String(variant.id) === variantId);
    const variantImage = matchedVariant && matchedVariant.featured_image
      ? matchedVariant.featured_image.src || matchedVariant.featured_image.url
      : "";

    if (variantImage) {
      return normalizeStorefrontImageUrl(variantImage);
    }

    if (payload.featured_image) {
      return normalizeStorefrontImageUrl(payload.featured_image);
    }

    const images = Array.isArray(payload.images) ? payload.images : [];
    return normalizeStorefrontImageUrl(images[0] || "");
  }

  async function fetchActionProductImage(instance, action) {
    if (!action || !action.preview || action.preview.imageUrl || !action.preview.productHandle) {
      return;
    }

    try {
      const handle = encodeURIComponent(action.preview.productHandle);
      const response = await window.fetch(`/products/${handle}.js`, {
        method: "GET",
        credentials: "same-origin",
        headers: { accept: "application/json" },
      });

      if (!response.ok) {
        return;
      }

      const payload = await response.json().catch(() => null);
      const imageUrl = pickProductJsonImage(payload, action);
      if (!imageUrl) {
        return;
      }

      action.preview.imageUrl = imageUrl;
      if (action.payload && action.payload.actionType === "add") {
        instance.state.actionPreviewById[action.actionId] = { loading: true, comparisonAssetUrl: null, currentAssetUrl: null, proposedAssetUrl: null };
        void fetchKitPreview(instance, action);
      }
      render(instance);
    } catch {
      // Image preview is optional; leave the action usable if lookup fails.
    }
  }

  async function fetchRecommendationProductImage(instance, item) {
    if (!item || item.imageUrl || item._cartmindImageLookupStarted || !item.productHandle) {
      return;
    }

    item._cartmindImageLookupStarted = true;

    try {
      const handle = encodeURIComponent(item.productHandle);
      const response = await window.fetch(`/products/${handle}.js`, {
        method: "GET",
        credentials: "same-origin",
        headers: { accept: "application/json" },
      });

      if (!response.ok) {
        return;
      }

      const payload = await response.json().catch(() => null);
      const imageUrl = pickProductJsonImage(payload, {
        payload: { merchandiseId: item.variantId || "" },
      });
      if (!imageUrl) {
        return;
      }

      item.imageUrl = imageUrl;
      render(instance);
    } catch {
      // Recommendation images are progressive enhancement only.
    }
  }

  function queueRecommendationImageLookups(instance, block) {
    if (!block || block.type !== "recommendation_list" || !Array.isArray(block.items)) {
      return;
    }

    block.items.forEach((item) => {
      if (item && item.productHandle && !item.imageUrl) {
        void fetchRecommendationProductImage(instance, item);
      }
    });
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
    const imageHtml = action.preview && action.preview.imageUrl
      ? `<div class="cm-action-media"><img class="cm-action-media__img" src="${escapeHtml(action.preview.imageUrl)}" alt="${escapeHtml(action.preview.after || action.toolName || "Recommended product")}" loading="lazy"></div>`
      : "";
    const preview = state.actionPreviewById && state.actionPreviewById[action.actionId];
    const previewHtml = preview
      ? preview.loading
        ? `<div class="cm-kit-preview cm-kit-preview--loading">Loading visual preview…</div>`
        : preview.comparisonAssetUrl
          ? `<div class="cm-kit-preview"><img class="cm-kit-preview__img" src="${escapeHtml(preview.comparisonAssetUrl)}" alt="Cart visual comparison" loading="lazy"></div>`
          : (preview.currentAssetUrl || preview.proposedAssetUrl)
            ? `<div class="cm-kit-preview cm-kit-preview--pair">${preview.currentAssetUrl ? `<img class="cm-kit-preview__img" src="${escapeHtml(preview.currentAssetUrl)}" alt="Current" loading="lazy">` : ""}<span class="cm-kit-preview__arrow">→</span>${preview.proposedAssetUrl ? `<img class="cm-kit-preview__img" src="${escapeHtml(preview.proposedAssetUrl)}" alt="After swap" loading="lazy">` : ""}</div>`
            : ""
      : "";

    return `
      <div class="cm-action-card">
        <strong>${escapeHtml(action.toolName || "Cart action")}</strong>
        <p>${escapeHtml(describeCartAction(action))}</p>
        ${imageHtml}
        ${action.preview && action.preview.before ? `<p class="cm-action-preview">Before: ${escapeHtml(action.preview.before)}</p>` : ""}
        ${action.preview && action.preview.after ? `<p class="cm-action-preview">After: ${escapeHtml(action.preview.after)}</p>` : ""}
        ${previewHtml}
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

  function isCompatibleAddProposal(action) {
    return action
      && action.toolName === "addToCart"
      && action.payload
      && action.payload.actionType === "add"
      && action.preview
      && (action.preview.productHandle || action.preview.imageUrl);
  }

  function renderActionProposals(actions, state) {
    if (!Array.isArray(actions) || actions.length === 0) {
      return "";
    }

    const allCompatibleAdds = actions.length > 1 && actions.every(isCompatibleAddProposal);
    if (allCompatibleAdds) {
      return `
        <div class="cm-guidance-list cm-compatible-slider-shell">
          <button class="cm-slider-nav" type="button" data-action="compatible-slider-prev" aria-label="Previous compatible product">&lsaquo;</button>
          <div class="cm-compatible-slider" data-role="compatible-slider">${actions.map((action) => renderActionProposal(action, state)).join("")}</div>
          <button class="cm-slider-nav" type="button" data-action="compatible-slider-next" aria-label="Next compatible product">&rsaquo;</button>
        </div>
      `;
    }

    return `<div class="cm-guidance-list">${actions.map((action) => renderActionProposal(action, state)).join("")}</div>`;
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
        imageUrl: item.imageUrl || "",
        discipline: item.discipline || "",
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
        const changes = Array.isArray(action.payload.changes) && action.payload.changes.length > 0
          ? action.payload.changes
          : [{ lineId: action.payload.lineId, quantity: action.payload.quantity }];

        for (const change of changes) {
          await postStorefrontCartMutation("/cart/change.js", {
            id: change.lineId,
            quantity: change.quantity,
          });
        }
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

  async function addRecommendationItemToCart(instance, input) {
    const state = instance.state;
    const key = input.key || "";
    const variantId = normalizeAjaxMerchandiseId(input.variantId || "");
    const quantity = Number(input.quantity || 1) > 0 ? Number(input.quantity || 1) : 1;

    if (!variantId) {
      return;
    }

    if (!state.recommendationStatusByKey) {
      state.recommendationStatusByKey = {};
    }

    state.pendingRecommendationKey = key;
    state.error = "";
    state.recommendationStatusByKey[key] = {
      status: "pending",
      summary: "Ajout au panier en cours...",
    };
    render(instance);

    try {
      await postStorefrontCartMutation("/cart/add.js", {
        id: variantId,
        quantity,
      });

      const nextCart = await fetchLatestStorefrontCart(state.cart);
      applyUpdatedCart(state, nextCart);
      await refreshThemeCartDrawer(nextCart);
      state.recommendationStatusByKey[key] = {
        status: "added",
        summary: `${input.title || "Produit"} ajouté au panier.`,
      };
      state.statusMessage = "Produit recommandé ajouté au panier.";
    } catch (error) {
      const message = error instanceof Error ? error.message : "Impossible d'ajouter ce produit au panier.";
      state.recommendationStatusByKey[key] = {
        status: "failed",
        summary: message,
      };
      state.error = message;
      state.statusMessage = "Ajout au panier impossible.";
    } finally {
      state.pendingRecommendationKey = "";
      render(instance);
    }
  }

  async function fetchKitPreview(instance, action) {
    const state = instance.state;
    if (!state.kitPreviewUrl || !action || !action.payload) {
      return;
    }

    const canPreviewSwap = action.payload.actionType === "swap_variant";
    const canPreviewAdd = action.payload.actionType === "add" && action.preview && action.preview.imageUrl;

    if (!canPreviewSwap && !canPreviewAdd) {
      return;
    }

    try {
      const cartItems = state.cart.items.map((item) => ({
        lineId: item.lineId,
        productId: item.productId,
        variantId: item.variantId,
        productTitle: item.productTitle,
        variantTitle: item.variantTitle,
        imageUrl: item.imageUrl,
        discipline: item.discipline,
        quantity: item.quantity,
      }));

      if (canPreviewAdd) {
        cartItems.push({
          lineId: `proposal-${action.actionId}`,
          productId: action.payload.merchandiseId,
          variantId: action.payload.merchandiseId,
          productTitle: action.preview.after || action.toolName || "Recommended product",
          variantTitle: "",
          imageUrl: action.preview.imageUrl,
          discipline: "",
          quantity: Number(action.payload.quantity || 1),
        });
      }

      const response = await window.fetch(state.kitPreviewUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          shop: state.config.shop,
          sessionId: state.sessionId,
          cartId: state.cart.cartId || "",
          ...(canPreviewSwap ? { selectedLineId: action.payload.lineId, proposedVariantId: action.payload.newMerchandiseId } : {}),
          currencyCode: state.cart.currencyCode || "USD",
          surface: state.config.surface || "cart_drawer",
          cart: {
            items: cartItems,
          },
        }),
      });

      const payload = await response.json().catch(() => null);
      if (payload && payload.ok && payload.comparison) {
        state.actionPreviewById[action.actionId] = {
          loading: false,
          comparisonAssetUrl: payload.comparison.comparisonAssetUrl || null,
          currentAssetUrl: payload.comparison.currentAssetUrl || null,
          proposedAssetUrl: payload.comparison.proposedAssetUrl || null,
        };
      } else if (payload && payload.ok && payload.preview) {
        state.actionPreviewById[action.actionId] = {
          loading: false,
          comparisonAssetUrl: null,
          currentAssetUrl: null,
          proposedAssetUrl: payload.preview.assetUrl || null,
        };
      } else {
        state.actionPreviewById[action.actionId] = { loading: false, comparisonAssetUrl: null, currentAssetUrl: null, proposedAssetUrl: null };
      }
    } catch {
      state.actionPreviewById[action.actionId] = { loading: false, comparisonAssetUrl: null, currentAssetUrl: null, proposedAssetUrl: null };
    }

    render(instance);
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

  function isAssistantTyping(message) {
    return Boolean(message && message.role === "assistant" && message._cartmindTypingActive);
  }

  function renderMessageContent(message, state) {
    const fallback = message.role === "assistant" && state.sending ? "Thinking..." : "";
    const content = renderInlineText(message.content || fallback);
    return `${content}${isAssistantTyping(message) ? '<span class="cm-typing-cursor" aria-hidden="true">|</span>' : ""}`;
  }

  function updateMessageContentDom(instance, message) {
    if (!instance || !instance.mountNode || !message || !message.id) {
      return false;
    }

    const selector = `[data-message-id="${String(message.id).replace(/"/g, "\\\"")}"] .cm-message__content`;
    const contentElement = instance.mountNode.querySelector(selector);
    if (!contentElement) {
      return false;
    }

    contentElement.innerHTML = renderMessageContent(message, instance.state);

    const messagesContainer = instance.mountNode.querySelector(".cm-messages");
    if (messagesContainer) {
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    return true;
  }

  function resolveTypingWaiters(message) {
    if (!message || !Array.isArray(message._cartmindTypingResolvers)) {
      return;
    }

    const resolvers = message._cartmindTypingResolvers.splice(0);
    resolvers.forEach((resolve) => resolve());
  }

  function scheduleTypewriterTick(instance, message) {
    if (!message || message._cartmindTypingTimer) {
      return;
    }

    message._cartmindTypingActive = true;
    message._cartmindTypingTimer = window.setTimeout(() => {
      message._cartmindTypingTimer = null;
      const fullContent = message._cartmindFullContent || "";
      const visibleContent = message.content || "";

      if (visibleContent.length < fullContent.length) {
        message.content = fullContent.slice(0, visibleContent.length + 1);
        updateMessageContentDom(instance, message);
        scheduleTypewriterTick(instance, message);
        return;
      }

      if (message._cartmindStreamComplete) {
        message._cartmindTypingActive = false;
        updateMessageContentDom(instance, message);
        resolveTypingWaiters(message);
      }
    }, TYPEWRITER_INTERVAL_MS);
  }

  function appendAnimatedTextDelta(instance, message, text) {
    if (!text) {
      return;
    }

    message._cartmindFullContent = `${message._cartmindFullContent || message.content || ""}${text}`;
    scheduleTypewriterTick(instance, message);
  }

  function completeAnimatedMessage(instance, message) {
    if (!message) {
      return;
    }

    message._cartmindStreamComplete = true;
    if ((message.content || "").length >= (message._cartmindFullContent || "").length) {
      message._cartmindTypingActive = false;
      updateMessageContentDom(instance, message);
      resolveTypingWaiters(message);
      return;
    }

    scheduleTypewriterTick(instance, message);
  }

  function waitForAnimatedMessage(message) {
    if (!message || !message._cartmindTypingActive) {
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      if (!Array.isArray(message._cartmindTypingResolvers)) {
        message._cartmindTypingResolvers = [];
      }

      message._cartmindTypingResolvers.push(resolve);
    });
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
      <article class="cm-message cm-message--${escapeHtml(message.role)}" data-message-id="${escapeHtml(message.id || "")}">
        <span class="cm-message__label">${message.role === "assistant" ? "CartMind" : "You"}</span>
        <div class="cm-message__content">${renderMessageContent(message, state)}</div>
        ${Array.isArray(message.guidanceBlocks) && message.guidanceBlocks.length > 0
          ? `<div class="cm-guidance-list">${message.guidanceBlocks.map((block) => renderGuidanceBlock(block, state.config, state)).join("")}</div>`
          : ""}
        ${Array.isArray(message.actionProposals) && message.actionProposals.length > 0
          ? renderActionProposals(message.actionProposals, state)
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
              <textarea name="message" placeholder="Posez une question sur la taille, les comparaisons ou ce qui va bien avec ce panier." ${state.sending || totalItems === 0 ? "disabled" : ""}>${escapeHtml(state.draft)}</textarea>
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
    const recommendationButtons = instance.mountNode.querySelectorAll('[data-action="add-recommendation-item"]');
    const sliderButtons = instance.mountNode.querySelectorAll('[data-action="compatible-slider-prev"], [data-action="compatible-slider-next"], [data-action="recommendation-slider-prev"], [data-action="recommendation-slider-next"]');

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

    if (recommendationButtons && recommendationButtons.length > 0) {
      recommendationButtons.forEach((button) => {
        button.addEventListener("click", () => {
          void addRecommendationItemToCart(instance, {
            key: button.getAttribute("data-recommendation-key") || "",
            variantId: button.getAttribute("data-variant-id") || "",
            quantity: button.getAttribute("data-quantity") || "1",
            title: button.getAttribute("data-title") || "Produit recommandé",
          });
        });
      });
    }

    if (sliderButtons && sliderButtons.length > 0) {
      sliderButtons.forEach((button) => {
        button.addEventListener("click", () => {
          const shell = button.closest(".cm-compatible-slider-shell") || button.closest(".cm-recommendation-slider-shell");
          const slider = shell ? shell.querySelector('[data-role="compatible-slider"], [data-role="recommendation-slider"]') : null;
          if (!slider) {
            return;
          }

          const action = button.getAttribute("data-action") || "";
          const direction = action.indexOf("-prev") > 0 ? -1 : 1;
          const firstCard = slider.querySelector(".cm-action-card") || slider.querySelector(".cm-recommendation-card");
          const step = firstCard ? firstCard.getBoundingClientRect().width + 12 : slider.clientWidth;
          slider.scrollBy({ left: direction * step, behavior: "smooth" });
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
      pendingRecommendationKey: "",
      actionStatusById: {},
      recommendationStatusByKey: {},
      actionPreviewById: {},
      kitPreviewUrl: "",
      proactiveAnalysisFingerprint: "",
      proactiveAnalysisPending: false,
      sessionId: getOrCreateSessionId(config),
      sessionKey: "",
      streamToken: "",
      streamTokenExpiresAt: "",
      chatUrl: "",
      messages: [
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: (config.labels && config.labels.assistantGreeting) || config.assistantGreeting || "Posez une question sur la taille, les comparaisons ou ce qui va bien avec les articles déjà dans votre panier.",
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
      queueProactiveAnalysis(instance, source, nextFingerprint);
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
    state.kitPreviewUrl = payload.bootstrap.kitPreviewUrl || "";
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
      appendAnimatedTextDelta(instance, message, part.text || "");
      return;
    }

    if (part.type === "guidance-block") {
      appendGuidanceBlock(message, part.block);
      queueRecommendationImageLookups(instance, part.block);
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

      if (part.action.payload && (part.action.payload.actionType === "swap_variant" || (part.action.payload.actionType === "add" && part.action.preview && part.action.preview.imageUrl))) {
        instance.state.actionPreviewById[part.action.actionId] = { loading: true, comparisonAssetUrl: null, currentAssetUrl: null, proposedAssetUrl: null };
        void fetchKitPreview(instance, part.action);
      }

      if (part.action.preview && part.action.preview.productHandle && !part.action.preview.imageUrl) {
        void fetchActionProductImage(instance, part.action);
      }

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
        features: instance.state.config.features || {},
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

    completeAnimatedMessage(instance, assistantMessage);
    await waitForAnimatedMessage(assistantMessage);
  }

  function isCartMutationSyncSource(source) {
    return source === "fetch_intercept" || source === "xhr_intercept" || source === "cart_action";
  }

  function queueProactiveAnalysis(instance, source, fingerprint) {
    const state = instance.state;

    if (!isCartMutationSyncSource(source)
      || !shouldRunProactiveAnalysis(state.config)
      || !state.cart.items.length
      || state.sending
      || state.proactiveAnalysisPending
      || state.proactiveAnalysisFingerprint === fingerprint) {
      return;
    }

    state.proactiveAnalysisFingerprint = fingerprint;
    state.proactiveAnalysisPending = true;
    window.setTimeout(() => {
      void submitProactiveAnalysis(instance);
    }, 250);
  }

  async function submitProactiveAnalysis(instance) {
    const state = instance.state;

    if (state.sending || !state.cart.items.length || !shouldRunProactiveAnalysis(state.config)) {
      state.proactiveAnalysisPending = false;
      return;
    }

    const timestamp = Date.now();
    const prompt = buildProactivePrompt(state.config);
    const assistantMessage = {
      id: `assistant-proactive-${timestamp}`,
      role: "assistant",
      content: "",
      guidanceBlocks: [],
    };

    state.messages.push(assistantMessage);
    state.sending = true;
    state.panelOpen = true;
    state.error = "";
    state.statusMessage = "Analyzing updated cart...";
    render(instance);

    try {
      await streamAssistantReply(instance, assistantMessage, prompt);
      state.statusMessage = "Cart analysis updated.";
    } catch (error) {
      state.messages = state.messages.filter((message) => message.id !== assistantMessage.id);
      state.error = error instanceof Error ? error.message : "Unable to analyze the updated cart.";
      state.statusMessage = "Cart analysis failed.";
    } finally {
      state.sending = false;
      state.proactiveAnalysisPending = false;
      render(instance);
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
