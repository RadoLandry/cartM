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
    document.querySelectorAll("[data-cartmind-chat-root]").forEach((element) => {
      const config = readConfig(element);

      if (config) {
        loadBundle(config);
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootstrapWidgetLoad, { once: true });
  } else {
    bootstrapWidgetLoad();
  }
})();