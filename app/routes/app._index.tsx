import { useEffect } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { useFetcher, useLoaderData, useRevalidator } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import {
  countProductsForShop,
  countProductVariantsForShop,
  getLatestSyncJob,
} from "../lib/db/queries";
import { runCatalogSync } from "../lib/knowledge-graph/ingestion";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  const [latestJob, productCount, variantCount] = await Promise.all([
    getLatestSyncJob(session.shop),
    countProductsForShop(session.shop),
    countProductVariantsForShop(session.shop),
  ]);

  return {
    shop: session.shop,
    productCount,
    variantCount,
    latestJob: latestJob
      ? {
          status: latestJob.status,
          syncedCount: latestJob.syncedCount,
          failedCount: latestJob.failedCount,
          startedAt: latestJob.startedAt.toISOString(),
          completedAt: latestJob.completedAt?.toISOString() ?? null,
        }
      : null,
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent !== "sync-catalog") {
    return { ok: false, error: "Unknown action" };
  }

  try {
    await runCatalogSync(admin, session.shop);
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Catalog sync failed",
    };
  }
};

export default function Index() {
  const { shop, productCount, variantCount, latestJob } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const revalidator = useRevalidator();
  const shopify = useAppBridge();

  const isSyncing =
    ["loading", "submitting"].includes(fetcher.state) &&
    fetcher.formMethod === "POST";

  useEffect(() => {
    if (fetcher.data?.ok) {
      shopify.toast.show("Catalog sync completed");
      revalidator.revalidate();
    }

    if (fetcher.data && !fetcher.data.ok && fetcher.data.error) {
      shopify.toast.show(fetcher.data.error, { isError: true });
    }
  }, [fetcher.data, revalidator, shopify]);

  const triggerSync = () => {
    fetcher.submit({ intent: "sync-catalog" }, { method: "POST" });
  };

  return (
    <s-page heading="Catalog Sync">
      <s-button
        slot="primary-action"
        onClick={triggerSync}
        {...(isSyncing ? { loading: true } : {})}
      >
        Run catalog sync
      </s-button>

      <s-section heading="Catalog overview">
        <s-stack direction="block" gap="base">
          <s-paragraph>Shop: {shop}</s-paragraph>
          <s-paragraph>Products synced: {productCount}</s-paragraph>
          <s-paragraph>Variants synced: {variantCount}</s-paragraph>
        </s-stack>
      </s-section>

      <s-section heading="Latest sync job">
        {latestJob ? (
          <s-stack direction="block" gap="base">
            <s-paragraph>Status: {latestJob.status}</s-paragraph>
            <s-paragraph>Products processed: {latestJob.syncedCount}</s-paragraph>
            <s-paragraph>Failures: {latestJob.failedCount}</s-paragraph>
            <s-paragraph>Started: {new Date(latestJob.startedAt).toLocaleString()}</s-paragraph>
            <s-paragraph>
              Completed:{" "}
              {latestJob.completedAt
                ? new Date(latestJob.completedAt).toLocaleString()
                : "In progress"}
            </s-paragraph>
          </s-stack>
        ) : (
          <s-paragraph>No sync job has run yet.</s-paragraph>
        )}
      </s-section>

      <s-section slot="aside" heading="Recovery">
        <s-paragraph>
          If the app was installed before the initial catalog sync completed,
          use the manual action to repopulate the local product tables.
        </s-paragraph>
      </s-section>
    </s-page>
  );
}

export const headers = boundary.headers;
