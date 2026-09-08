/**
 * Seed script — Size & Fit Intelligence
 *
 * Populates SizeChart rows for boxing gloves (oz), apparel (S/M/L/XL), and
 * shorts waist sizing for a given shop, plus standard adult cross-size mappings.
 *
 * Usage:
 *   npx tsx scripts/seed-size-charts.ts --shop=my-shop.myshopify.com
 */

import db from "../app/db.server";
import {
  getSizeChartForCategory,
  upsertSizeChart,
  createCrossSizeMapping,
  type SizeBreakpointRow,
} from "../app/lib/db/queries";
import { SizeChartSource } from "@prisma/client";

const shopArg = process.argv.find((a) => a.startsWith("--shop="))?.split("=")[1];
if (!shopArg) {
  console.error("Error: --shop=<shop-domain> argument is required");
  process.exit(1);
}
const shop: string = shopArg;

// ---------------------------------------------------------------------------
// Boxing gloves oz chart
// ---------------------------------------------------------------------------
const glovesOzBreakpoints: SizeBreakpointRow[] = [
  { label: "8oz",  attributeType: "weightKg", min: null, max: 45,  note: "Youth / Junior (< 45 kg)" },
  { label: "10oz", attributeType: "weightKg", min: 45,   max: 65,  note: "Youth / Light adult" },
  { label: "12oz", attributeType: "weightKg", min: 65,   max: 75,  note: "Youth competition / Light amateur" },
  { label: "14oz", attributeType: "weightKg", min: 75,   max: 85,  note: "Light sparring" },
  { label: "16oz", attributeType: "weightKg", min: 85,   max: 100, note: "Standard sparring" },
  { label: "18oz", attributeType: "weightKg", min: 100,  max: null, note: "Heavy sparring / competition" },
];

// ---------------------------------------------------------------------------
// Apparel S/M/L/XL chart (chest cm)
// ---------------------------------------------------------------------------
const apparelChestBreakpoints: SizeBreakpointRow[] = [
  { label: "XS", attributeType: "chestCm", min: null, max: 88,  note: "Extra Small" },
  { label: "S",  attributeType: "chestCm", min: 88,   max: 96,  note: "Small" },
  { label: "M",  attributeType: "chestCm", min: 96,   max: 104, note: "Medium" },
  { label: "L",  attributeType: "chestCm", min: 104,  max: 112, note: "Large" },
  { label: "XL", attributeType: "chestCm", min: 112,  max: 120, note: "Extra Large" },
  { label: "XXL",attributeType: "chestCm", min: 120,  max: null, note: "Double Extra Large" },
];

// ---------------------------------------------------------------------------
// Shorts waist chart (waist inches)
// ---------------------------------------------------------------------------
const shortsWaistBreakpoints: SizeBreakpointRow[] = [
  { label: "28", attributeType: "waistCm", min: null, max: 73,  note: "28\" waist" },
  { label: "30", attributeType: "waistCm", min: 73,   max: 78,  note: "30\" waist" },
  { label: "32", attributeType: "waistCm", min: 78,   max: 83,  note: "32\" waist" },
  { label: "34", attributeType: "waistCm", min: 83,   max: 89,  note: "34\" waist" },
  { label: "36", attributeType: "waistCm", min: 89,   max: 94,  note: "36\" waist" },
  { label: "38", attributeType: "waistCm", min: 94,   max: null, note: "38\" waist" },
];

// ---------------------------------------------------------------------------
// Cross-size mappings: clothing ↔ shorts_waist (standard adult)
// ---------------------------------------------------------------------------
const clothingToShortsWaistMappings: Array<{ sourceSize: string; targetSize: string }> = [
  { sourceSize: "XS", targetSize: "28" },
  { sourceSize: "S",  targetSize: "30" },
  { sourceSize: "M",  targetSize: "32" },
  { sourceSize: "L",  targetSize: "34" },
  { sourceSize: "XL", targetSize: "36" },
  { sourceSize: "XXL",targetSize: "38" },
];

/**
 * Upsert a SizeChart's AUTO breakpoints while preserving the MERCHANT source
 * badge whenever a merchant override is already active, so a reseed never
 * makes an overridden chart look like it reverted to AUTO provenance.
 */
async function seedChart(categoryTag: string, sizeSystem: string, breakpoints: SizeBreakpointRow[]) {
  const existing = await getSizeChartForCategory(shop, categoryTag, sizeSystem);
  const hasMerchantOverride = existing?.overrideBreakpoints != null;

  await upsertSizeChart({
    shop,
    categoryTag,
    sizeSystem,
    breakpoints,
    source: hasMerchantOverride ? SizeChartSource.MERCHANT : SizeChartSource.AUTO,
  });
  console.log(`  ✓ SizeChart: ${categoryTag}${hasMerchantOverride ? " (merchant override preserved)" : ""}`);
}

async function main() {
  console.log(`Seeding size charts for shop: ${shop}`);

  await seedChart("gloves_oz", "gloves_oz", glovesOzBreakpoints);
  await seedChart("clothing", "clothing", apparelChestBreakpoints);
  await seedChart("shorts_waist", "shorts_waist", shortsWaistBreakpoints);

  // Upsert cross-size mappings (clothing → shorts_waist)
  let mappingCount = 0;
  for (const { sourceSize, targetSize } of clothingToShortsWaistMappings) {
    try {
      await createCrossSizeMapping({
        shop,
        sourceCategoryTag: "clothing",
        sourceSize,
        targetCategoryTag: "shorts_waist",
        targetSize,
      });
      mappingCount++;
    } catch (err: unknown) {
      // Ignore duplicate constraint violations on re-seed
      if (
        typeof err === "object" &&
        err !== null &&
        "code" in err &&
        (err as { code: string }).code === "P2002"
      ) {
        // already exists — skip
      } else {
        throw err;
      }
    }
  }
  console.log(`  ✓ CrossSizeMapping: clothing ↔ shorts_waist (${mappingCount} created)`);

  console.log("Seeding complete.");
  await db.$disconnect();
}

main().catch((err) => {
  console.error(err);
  db.$disconnect().finally(() => process.exit(1));
});
