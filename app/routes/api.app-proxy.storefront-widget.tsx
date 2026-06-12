import { readFile } from "node:fs/promises";
import path from "node:path";

import type { LoaderFunctionArgs } from "react-router";

import { authenticate } from "../shopify.server";

const STOREFRONT_WIDGET_PATH = path.join(process.cwd(), "public", "storefront", "cartmind-chat-app.js");

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.public.appProxy(request);

  const bundle = await readFile(STOREFRONT_WIDGET_PATH, "utf8");

  return new Response(bundle, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
};