import db from "../app/db.server";
import { getProductsForVisualBackfill, upsertProductVisualProfile } from "../app/lib/db/queries";
import { mapProductToVisualProfile } from "../app/lib/knowledge-graph/colorways";

const shopArg = process.argv.find((argument) => argument.startsWith("--shop="))?.split("=")[1];
if (!shopArg) {
  console.error("Error: --shop=<shop-domain> argument is required");
  process.exit(1);
}

const shop = shopArg;

async function main() {
  console.log(`Backfilling colorway profiles for ${shop}`);

  let cursor: string | undefined;
  let processedCount = 0;

  while (true) {
    const products = await getProductsForVisualBackfill(shop, 100, cursor);
    if (products.length === 0) {
      break;
    }

    for (const product of products) {
      const profile = mapProductToVisualProfile(
        {
          ...product,
          metafields: (product.metafields as Record<string, string> | null) ?? {},
          collectionSummaries: product.collectionIds.map((collectionId) => ({
            shopifyCollectionId: collectionId,
            title: collectionId,
            handle: collectionId,
          })),
        },
        {
          overrideColorwayKeys: product.visualProfile?.overrideColorwayKeys,
          overrideCollections:
            (product.visualProfile?.overrideCollections as {
              shopifyCollectionId: string;
              title: string;
              handle: string;
            }[] | null | undefined) ?? null,
        },
      );

      await upsertProductVisualProfile({
        productId: product.id,
        shop,
        dominantColors: profile.dominantColors,
        detectedColorwayKeys: profile.detectedColorwayKeys,
        overrideColorwayKeys: profile.overrideColorwayKeys,
        detectedCollections: profile.detectedCollections,
        overrideCollections: profile.overrideCollections,
        visualConfidence: profile.visualConfidence,
        reviewStatus: profile.reviewStatus,
        source: profile.source,
        extractionSummary: profile.extractionSummary as unknown as Record<string, unknown>,
      });

      processedCount += 1;
    }

    cursor = products[products.length - 1]?.id;
    console.log(`  Processed ${processedCount} products`);
  }

  console.log(`Backfill complete. ${processedCount} profiles refreshed.`);
  await db.$disconnect();
}

main().catch((error) => {
  console.error(error);
  db.$disconnect().finally(() => process.exit(1));
});