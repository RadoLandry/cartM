import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  resolve: {
    // Prefer CJS/default over "module" (ESM) for packages that ship broken ESM
    // (notably @opentelemetry/api whose build/esm/* uses bare specifiers without .js)
    conditions: ["node", "require", "default"],
  },
  test: {
    environment: "node",
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "**/build/**",
      "**/.tmp/**",
      "tests/integration/storefront/cartmind-playwright-smoke.test.js",
    ],
  },
});
