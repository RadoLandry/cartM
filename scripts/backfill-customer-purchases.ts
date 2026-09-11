/**
 * Backfill script: seed replenishment purchase snapshots from historical
 * Shopify order data for recognized shoppers that already have a profile.
 *
 * Usage:
 *   npx tsx scripts/backfill-customer-purchases.ts --shop=<shop-domain>
 */

import db from "../app/db.server";
import { unauthenticated } from "../app/shopify.server";
import {
  getReplenishmentActionTargets,
  upsertCustomerPurchaseSnapshot,
} from "../app/lib/db/queries";
import { fetchCustomerReplenishmentOrderHistory } from "../app/lib/shopify/graphql";

const shopArg = process.argv.find((argument) => argument.startsWith("--shop="))?.split("=")[1];
if (!shopArg) {
  console.error("Error: --shop=<shop-domain> argument is required");
  process.exit(1);
}

const shop = shopArg;

async function main() {
  console.log(`Backfilling replenishment purchase snapshots for ${shop}`);

  const { admin } = await unauthenticated.admin(shop);
  const profiles = await db.customerProfile.findMany({
    where: { shop, shopifyCustomerId: { not: null } },
    select: { shopifyCustomerId: true },
  });

  let processedOrders = 0;
  let processedSnapshots = 0;

  for (const { shopifyCustomerId } of profiles) {
    if (!shopifyCustomerId) {
      continue;
    }

    let after: string | undefined;

    while (true) {
      const { orders, hasNextPage, endCursor } = await fetchCustomerReplenishmentOrderHistory(
        admin,
        shopifyCustomerId,
        25,
        after,
      );

      const productIds = Array.from(
        new Set(
          orders.flatMap((order) =>
            order.lineItems.nodes
              .map((lineItem) => lineItem.variant?.product?.id)
              .filter((productId): productId is string => Boolean(productId)),
          ),
        ),
      );
      const targets = await getReplenishmentActionTargets(shop, productIds);

      for (const order of orders) {
        processedOrders += 1;

        for (const lineItem of order.lineItems.nodes) {
          const productId = lineItem.variant?.product?.id;
          const categoryTag = productId ? targets.get(productId)?.categoryTag : undefined;

          if (!productId || !categoryTag) {
            continue;
          }

          await upsertCustomerPurchaseSnapshot({
            shop,
            shopifyCustomerId,
            productId,
            ...(lineItem.variant?.id ? { variantId: lineItem.variant.id } : {}),
            categoryTag,
            purchasedAt: new Date(order.processedAt),
            orderId: order.id,
            quantity: lineItem.quantity,
            title: lineItem.title ?? lineItem.variant?.product?.title ?? "Item",
            ...(lineItem.variant?.title ? { variantTitle: lineItem.variant.title } : {}),
          });
          processedSnapshots += 1;
        }
      }

      if (!hasNextPage) {
        break;
      }

      after = endCursor;
    }
  }

  console.log(
    `Backfill complete. Processed ${processedOrders} orders and upserted ${processedSnapshots} purchase snapshots.`,
  );
  await db.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await db.$disconnect();
  process.exit(1);
});
