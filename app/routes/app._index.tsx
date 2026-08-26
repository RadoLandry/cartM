import { useEffect, useRef, useState } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { useFetcher, useLoaderData, useRevalidator } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import {
  countProductsForShop,
  countProductVariantsForShop,
  getActiveSyncJob,
  getLatestSyncJob,
  getProductsNotYetSynced,
} from "../lib/db/queries";
import { runCatalogSync } from "../lib/knowledge-graph/ingestion";
import { authenticate } from "../shopify.server";
import { SyncStatusCard } from "../components/admin/SyncStatusCard";
import { SyncFailureTable } from "../components/admin/SyncFailureTable";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  const [latestJob, productCount, variantCount, unsyncedProducts] = await Promise.all([
    getLatestSyncJob(session.shop),
    countProductsForShop(session.shop),
    countProductVariantsForShop(session.shop),
    getProductsNotYetSynced(session.shop),
  ]);

  return {
    shop: session.shop,
    productCount,
    variantCount,
    latestJob: latestJob
      ? {
          id: latestJob.id,
          status: latestJob.status,
          syncedCount: latestJob.syncedCount,
          failedCount: latestJob.failedCount,
          totalCount: latestJob.totalCount,
          startedAt: latestJob.startedAt.toISOString(),
          completedAt: latestJob.completedAt?.toISOString() ?? null,
        }
      : null,
    unsyncedProducts: unsyncedProducts.map((p) => ({
      productId: p.shopifyProductId,
      productTitle: p.title,
      failureReason: "Never synced",
    })),
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent !== "sync-catalog") {
    return { ok: false, error: "Unknown action" };
  }

  // Single-active-job guard: do not start a new sync while one is running.
  const activeJob = await getActiveSyncJob(session.shop);
  if (activeJob) {
    return { ok: false, error: "A catalog sync is already in progress." };
  }

  try {
    void runCatalogSync(admin, session.shop).catch((error) => {
      console.error(`[CatalogSync] Background sync failed for ${session.shop}:`, error);
    });

    return { ok: true, started: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Catalog sync failed",
    };
  }
};

export default function Index() {
  const { shop, productCount, variantCount, latestJob, unsyncedProducts } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const revalidator = useRevalidator();
  const shopify = useAppBridge();
  const [syncRequested, setSyncRequested] = useState(false);
  const hasShownStartedToast = useRef(false);
  const lastCompletionToastJobId = useRef<string | null>(null);
  const lastErrorToast = useRef<string | null>(null);

  const isSubmittingSync =
    ["loading", "submitting"].includes(fetcher.state) &&
    fetcher.formMethod === "POST";
  const isBackgroundSyncing = latestJob?.status === "IN_PROGRESS" || latestJob?.status === "PENDING";
  const isSyncing = isSubmittingSync || isBackgroundSyncing || syncRequested;

  useEffect(() => {
    if (fetcher.data?.ok && fetcher.data.started && !hasShownStartedToast.current) {
      hasShownStartedToast.current = true;
      setSyncRequested(true);
      shopify.toast.show("Catalog sync started");
      revalidator.revalidate();
    }

    if (fetcher.data && !fetcher.data.ok && fetcher.data.error) {
      if (lastErrorToast.current !== fetcher.data.error) {
        lastErrorToast.current = fetcher.data.error;
        shopify.toast.show(fetcher.data.error, { isError: true });
      }
    }
  }, [fetcher.data, revalidator, shopify]);

  useEffect(() => {
    if (!isSyncing) {
      return;
    }

    if (latestJob?.status === "COMPLETED" || latestJob?.status === "FAILED") {
      setSyncRequested(false);
      return;
    }

    const intervalId = window.setInterval(() => {
      revalidator.revalidate();
    }, 1500);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [isSyncing, latestJob?.status, revalidator]);

  useEffect(() => {
    if (!latestJob) {
      return;
    }

    if (latestJob.status === "COMPLETED" && lastCompletionToastJobId.current !== latestJob.id) {
      lastCompletionToastJobId.current = latestJob.id;
      setSyncRequested(false);
      shopify.toast.show("Catalog sync completed");
      return;
    }

    if (latestJob.status === "FAILED" && lastCompletionToastJobId.current !== latestJob.id) {
      lastCompletionToastJobId.current = latestJob.id;
      setSyncRequested(false);
      shopify.toast.show("Catalog sync failed", { isError: true });
    }
  }, [latestJob, shopify]);

  const triggerSync = () => {
    hasShownStartedToast.current = false;
    setSyncRequested(true);
    fetcher.submit({ intent: "sync-catalog" }, { method: "POST" });
  };

  return (
    <s-page heading="Catalog Sync">
      <s-button
        slot="primary-action"
        onClick={triggerSync}
        {...(isSubmittingSync ? { loading: true } : {})}
        {...(isSyncing ? { disabled: true } : {})}
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
        <SyncStatusCard
          job={latestJob ? {
            id: latestJob.id,
            status: latestJob.status as "PENDING" | "IN_PROGRESS" | "COMPLETED" | "FAILED",
            syncedCount: latestJob.syncedCount,
            failedCount: latestJob.failedCount,
            totalCount: latestJob.totalCount,
            startedAt: latestJob.startedAt,
            completedAt: latestJob.completedAt,
          } : null}
        />
      </s-section>

      {(latestJob?.failedCount ?? 0) > 0 && (
        <s-section heading="Sync failures">
          <SyncFailureTable
            rows={unsyncedProducts}
            failedCount={latestJob?.failedCount ?? 0}
          />
        </s-section>
      )}

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
