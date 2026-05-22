/**
 * Batch script — Size Chart Return-Data Adjustment
 *
 * For each SizeChart row belonging to the given shop, runs
 * `adjustSizeChartFromReturns()` to detect and apply statistical
 * corrections when sufficient return data exists.
 *
 * Usage:
 *   npx tsx scripts/run-size-chart-adjustment.ts --shop=my-shop.myshopify.com [--min-samples=10]
 */

import db from "../app/db.server";
import { adjustSizeChartFromReturns } from "../app/lib/knowledge-graph/sizing";

const shopArg = process.argv.find((a) => a.startsWith("--shop="))?.split("=")[1];
if (!shopArg) {
  console.error("Error: --shop=<shop-domain> argument is required");
  process.exit(1);
}
const shop: string = shopArg;

const minSamplesArg = process.argv.find((a) => a.startsWith("--min-samples="))?.split("=")[1];
const minSamples = minSamplesArg ? parseInt(minSamplesArg, 10) : 10;

async function main() {
  console.log(`Running size chart adjustment for shop: ${shop} (minSamples=${minSamples})`);

  const charts = await db.sizeChart.findMany({
    where: { shop },
    select: { categoryTag: true, sizeSystem: true },
    distinct: ["categoryTag", "sizeSystem"],
  });

  if (charts.length === 0) {
    console.log("No size charts found for this shop.");
    await db.$disconnect();
    return;
  }

  let adjustedCount = 0;
  let skippedCount = 0;

  for (const { categoryTag, sizeSystem } of charts) {
    const result = await adjustSizeChartFromReturns(shop, categoryTag, sizeSystem, minSamples);
    if (result.adjusted) {
      console.log(`  ✓ Adjusted: ${categoryTag}/${sizeSystem} — ${result.reason} (${result.processedRecordIds.length} records)`);
      adjustedCount++;
    } else {
      console.log(`  – Skipped: ${categoryTag}/${sizeSystem} — ${result.reason}`);
      skippedCount++;
    }
  }

  console.log(`\nDone: ${adjustedCount} adjusted, ${skippedCount} skipped.`);
  await db.$disconnect();
}

main().catch((err) => {
  console.error(err);
  db.$disconnect().finally(() => process.exit(1));
});
