import "@shopify/shopify-app-react-router/adapters/node";
import {
  ApiVersion,
  AppDistribution,
  shopifyApp,
} from "@shopify/shopify-app-react-router/server";
import { PrismaSessionStorage } from "@shopify/shopify-app-session-storage-prisma";
import prisma from "./db.server";
import { runCatalogSync } from "./lib/knowledge-graph/ingestion";

type ShopifyAppConfig = Parameters<typeof shopifyApp>[0];

const prismaSessionStorage =
  new PrismaSessionStorage(prisma) as ShopifyAppConfig["sessionStorage"];

const shopify = shopifyApp({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET || "",
  apiVersion: ApiVersion.April25,
  scopes: process.env.SCOPES?.split(","),
  appUrl: process.env.SHOPIFY_APP_URL || "",
  authPathPrefix: "/auth",
  sessionStorage: prismaSessionStorage,
  distribution: AppDistribution.AppStore,
  hooks: {
    afterAuth: async ({ session, admin }) => {
      // Trigger the sync job asynchronously from the background
      runCatalogSync(admin, session.shop).catch(error => {
        console.error(`[AfterAuth] Failed to run sync for ${session.shop}:`, error);
      });
      await shopify.registerWebhooks({ session });
    },
  },
  future: {
    expiringOfflineAccessTokens: true,
  },
  ...(process.env.SHOP_CUSTOM_DOMAIN
    ? { customShopDomains: [process.env.SHOP_CUSTOM_DOMAIN] }
    : {}),
});

export default shopify;
export const apiVersion = ApiVersion.April25;
export const addDocumentResponseHeaders = shopify.addDocumentResponseHeaders;
export const authenticate = shopify.authenticate;
export const unauthenticated = shopify.unauthenticated;
export const login = shopify.login;
export const registerWebhooks = shopify.registerWebhooks;
export const sessionStorage = shopify.sessionStorage;
