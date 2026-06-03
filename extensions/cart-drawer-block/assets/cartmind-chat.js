(() => {
  const APP_ASSET_PATH = "/storefront/cartmind-chat-app.js";

  function loadBundle(config) {
    const appBaseUrl = typeof config?.appBaseUrl === "string"
      ? config.appBaseUrl.replace(/\/$/, "")
      : "";

    if (!appBaseUrl) {
      console.warn("CartMind chat requires an app base URL to load the storefront widget bundle.");
      return;
    }

    const scriptId = `cartmind-chat-app-${appBaseUrl}`;

    if (document.getElementById(scriptId)) {
      return;
    }

    const script = document.createElement("script");
    script.id = scriptId;
    script.async = true;
    script.src = `${appBaseUrl}${APP_ASSET_PATH}`;
    document.head.appendChild(script);
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
      return JSON.parse(configElement.textContent);
    } catch {
      return null;
    }
  }

  function bootstrapWidgetLoad() {
    const roots = document.querySelectorAll("[data-cartmind-chat-root]");
    console.log("[CartMind] bootstrapWidgetLoad fired, readyState:", document.readyState, "roots found:", roots.length);

    roots.forEach((element) => {
      const configId = element.dataset.configId;
      console.log("[CartMind] element found, configId:", configId);

      const configElement = document.getElementById(configId);
      console.log("[CartMind] config element:", configElement ? "found" : "NOT FOUND");

      if (configElement) {
        try {
          const parsed = JSON.parse(configElement.textContent);
          console.log("[CartMind] parsed config appBaseUrl:", parsed.appBaseUrl);
        } catch (e) {
          console.error("[CartMind] JSON parse error:", e);
        }
      }

      const config = readConfig(element);

      if (config) {
        console.log("[CartMind] Loading bundle from:", config.appBaseUrl + APP_ASSET_PATH);
        loadBundle(config);
      } else {
        console.warn("[CartMind] readConfig returned null for element:", element);
      }
    });

    if (roots.length === 0) {
      console.warn("[CartMind] No [data-cartmind-chat-root] elements found in DOM");
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootstrapWidgetLoad, { once: true });
  } else {
    bootstrapWidgetLoad();
  }
})();