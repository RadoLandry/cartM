(() => {
  const RUNTIME_FLAG = "__cartmindChatBlockRuntimeLoaded";
  const LOADING_FLAG = "__cartmindChatBlockRuntimeLoading";
  const SCRIPT_MARKER = "data-cartmind-chat-runtime";
  const RUNTIME_PATH = "/storefront/cartmind-chat-block-runtime.js";
  const RUNTIME_VERSION = "20260715-compatible-catalog-images-v4";

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
      return "";
    }
  }

  function resolveRuntimeBaseUrl() {
    const configScripts = document.querySelectorAll('script[type="application/json"][id^="cartmind-chat-config-"]');

    for (let index = 0; index < configScripts.length; index += 1) {
      const script = configScripts[index];

      if (!script || !script.textContent) {
        continue;
      }

      try {
        const parsed = JSON.parse(script.textContent);
        const normalized = normalizeAppBaseUrl(parsed && parsed.appBaseUrl);
        if (normalized) {
          return normalized;
        }
      } catch {
        // Ignore invalid config script and continue.
      }
    }

    return "";
  }

  function buildRuntimeUrl() {
    const appBaseUrl = resolveRuntimeBaseUrl();
    const runtimePath = `${RUNTIME_PATH}?v=${encodeURIComponent(RUNTIME_VERSION)}`;
    if (appBaseUrl) {
      return `${appBaseUrl}${runtimePath}`;
    }

    return runtimePath;
  }

  function injectRuntime(url) {
    const existing = document.querySelector(`script[${SCRIPT_MARKER}="true"]`);
    if (existing) {
      return;
    }

    const script = document.createElement("script");
    script.async = true;
    script.src = url;
    script.setAttribute(SCRIPT_MARKER, "true");
    script.onload = () => {
      window[LOADING_FLAG] = false;
      window[RUNTIME_FLAG] = true;
      console.info("[CartMind] Runtime loaded", { url });
    };
    script.onerror = () => {
      window[LOADING_FLAG] = false;
      console.error("[CartMind] Runtime failed to load", { url });
    };

    (document.head || document.body || document.documentElement).appendChild(script);
  }

  if (window[RUNTIME_FLAG] || window[LOADING_FLAG]) {
    return;
  }

  window[LOADING_FLAG] = true;
  injectRuntime(buildRuntimeUrl());
})();