import { PRODUCT_BY_ID_QUERY, PRODUCTS_QUERY } from "../shopify/graphql";
import { normalizeProduct, ShopifyProductNode } from "./normalization";
import { upsertProduct, createSyncJob, getActiveSyncJob, deleteProduct, updateProductClassification, updateProductEmbedding } from "../db/queries";
import { SyncTracker } from "./sync-status";
import { generateProductEmbeddingWithRetry } from "./embeddings";
import { extractDominantColors } from "./colorways";
import { classifyProduct } from "./llm-classifier";

type AdminGraphqlClient = {
  graphql: (
    query: string,
    options: { variables: Record<string, unknown> }
  ) => Promise<{ json: () => Promise<unknown>, headers?: Headers }>;
};

type WebhookProductPayload = {
  id?: string | number;
  admin_graphql_api_id?: string;
};

interface GraphQLProductsResponse {
  data: {
    products: {
      nodes: ShopifyProductNode[];
      pageInfo: {
        hasNextPage: boolean;
        endCursor: string | null;
      };
    };
  };
}

interface GraphQLProductByIdResponse {
  data?: {
    product: ShopifyProductNode | null;
  };
}

async function syncProductRecord(shop: string, shopifyProduct: ShopifyProductNode) {
  const normalized = normalizeProduct(shopifyProduct);
  if (!normalized) {
    return false;
  }

  const primaryImage = shopifyProduct.images?.nodes?.[0]?.url || shopifyProduct.variants?.nodes?.[0]?.image?.url || null;
  normalized.dominantColors = await extractDominantColors(primaryImage);

  await upsertProduct(shop, normalized);

  const embedText = `${normalized.title} ${normalized.description || ''} ${normalized.tags.join(' ')}`.trim();
  if (embedText.length > 0) {
    try {
      const embedding = await generateProductEmbeddingWithRetry(embedText, 3);
      await updateProductEmbedding(normalized.shopifyProductId, embedding);
    } catch {
      console.warn(`[Ingestion] Could not generate embeddings for ${shopifyProduct.id}. Continuing...`);
    }
  }

  // Classify discipline & category via LLM (non-blocking for bulk sync)
  try {
    const classification = await classifyProduct({
      title: normalized.title,
      description: normalized.description ?? undefined,
      tags: normalized.tags,
      productType: normalized.productType ?? undefined,
      vendor: normalized.vendor ?? undefined,
      metafields: normalized.metafields,
    });
    await updateProductClassification(
      normalized.shopifyProductId,
      classification.disciplineTags,
      classification.categoryTags,
      classification.classificationConfidence,
    );
  } catch (classifyError) {
    console.warn(`[Ingestion] Classification failed for ${shopifyProduct.id}:`, (classifyError as Error).message);
  }

  return true;
}

function toShopifyProductGid(payload: WebhookProductPayload) {
  if (typeof payload.admin_graphql_api_id === "string" && payload.admin_graphql_api_id.length > 0) {
    return payload.admin_graphql_api_id;
  }

  if (typeof payload.id === "string" && payload.id.startsWith("gid://shopify/Product/")) {
    return payload.id;
  }

  if (typeof payload.id === "string" || typeof payload.id === "number") {
    return `gid://shopify/Product/${payload.id}`;
  }

  return null;
}

export async function runCatalogSync(admin: AdminGraphqlClient, shop: string): Promise<void> {
  // 1. Vérifier si un job est déjà en cours
  const activeJob = await getActiveSyncJob(shop);
  if (activeJob) {
    console.log(`[Ingestion] Sync already in progress for ${shop}. Skipping.`);
    return;
  }

  // 2. Créer un nouveau job
  const job = await createSyncJob(shop);
  const tracker = new SyncTracker(job.id);

  console.log(`[Ingestion] Starting full catalog sync for ${shop} (Job: ${job.id})`);

  try {
    let hasNextPage = true;
    let after: string | null = null;
    const batchSize = 50;
    let retryCount = 0;
    const MAX_RETRIES = 5;

    while (hasNextPage) {
      try {
        const response = await admin.graphql(PRODUCTS_QUERY, {
          variables: { first: batchSize, after },
        });

        // Parse rate limits if needed via headers
        if (response.headers) {
          const retryAfter = response.headers.get("Retry-After");
          if (retryAfter) {
            const delay = parseFloat(retryAfter) * 1000;
            console.log(`[Ingestion] Rate limited. Sleeping for ${delay}ms`);
            await new Promise(r => setTimeout(r, delay));
          }
        }

        const data = (await response.json()) as GraphQLProductsResponse;
        
        // Handling 429 or other API error objects explicitly
        if (!data || !data.data || !data.data.products) {
           throw new Error("Unexpected GraphQL response structure: " + JSON.stringify(data));
        }

        const products = data.data.products.nodes;
        const pageInfo = data.data.products.pageInfo;

        for (const shopifyProduct of products) {
          try {
            const synced = await syncProductRecord(shop, shopifyProduct);
            if (synced) {
              await tracker.incrementSynced();
            } else {
              // Produit ignoré (ex: non actif)
              await tracker.incrementSynced(0); 
            }
          } catch (error) {
            console.error(`[Ingestion] Failed to upsert product ${shopifyProduct.id}:`, error);
            await tracker.incrementFailed();
          }
        }

        hasNextPage = pageInfo.hasNextPage;
        after = pageInfo.endCursor;
        retryCount = 0; // Reset retries on success

        console.log(`[Ingestion] Job ${job.id}: Synced ${tracker.getSummary().syncedCount} products...`);
      } catch (reqError: unknown) {
        if (retryCount >= MAX_RETRIES) {
           throw new Error(`Max retries reached during catalog sync for ${shop}: ${((reqError as Error).message || String(reqError))}`);
        }
        retryCount++;
        const backoff = Math.pow(2, retryCount) * 1000;
        console.warn(`[Ingestion] GraphQL request failed. Retrying in ${backoff}ms...`, ((reqError as Error).message || String(reqError)));
        await new Promise(r => setTimeout(r, backoff));
      }
    }

    await tracker.complete();
    console.log(`[Ingestion] Finished sync for ${shop}. Job ID: ${job.id}`);

  } catch (error) {
    console.error(`[Ingestion] Fatal error during sync for ${shop}:`, error);
    await tracker.fail();
    throw error;
  }
}

export async function handleProductWebhook(
  shop: string,
  payload: WebhookProductPayload,
  topic: string,
  admin: AdminGraphqlClient,
) {
  console.log(`[Ingestion] Handling webhook ${topic} for ${shop}`);
  const productGid = toShopifyProductGid(payload);
  
  if (topic === "products/delete" || topic === "PRODUCTS_DELETE") {
    if (!productGid) {
      console.warn(`[Ingestion] Could not resolve deleted product ID for ${shop}`);
      return;
    }

    await deleteProduct(productGid);
    return;
  }

  if (!productGid) {
    console.warn(`[Ingestion] Could not resolve product ID for webhook ${topic} on ${shop}`);
    return;
  }

  const response = await admin.graphql(PRODUCT_BY_ID_QUERY, {
    variables: { id: productGid },
  });

  const data = (await response.json()) as GraphQLProductByIdResponse;
  const product = data.data?.product;

  if (!product) {
    try {
      await deleteProduct(productGid);
    } catch {
      // Ignore if the product was never synced locally.
    }
    return;
  }

  const synced = await syncProductRecord(shop, product);
  if (!synced) {
    try {
      await deleteProduct(product.id);
    } catch {
      // Ignorer l'erreur s'il n'existait pas
    }
  } else {
    console.log(`[Ingestion] Synced webhook product ${product.id} for ${shop}`);
  }
}


