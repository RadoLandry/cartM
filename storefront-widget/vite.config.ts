import path from "node:path";

import { defineConfig } from "vite";

export default defineConfig({
  publicDir: false,
  build: {
    emptyOutDir: false,
    lib: {
      entry: path.resolve(__dirname, "src/index.tsx"),
      formats: ["iife"],
      fileName: () => "cartmind-chat-app.js",
      name: "CartMindChatApp",
    },
    outDir: path.resolve(__dirname, "../public/storefront"),
    rollupOptions: {
      output: {
        assetFileNames: "cartmind-chat-app.[ext]",
      },
    },
  },
});