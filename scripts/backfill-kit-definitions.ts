import { KitDefinitionSource } from "@prisma/client";
import db from "../app/db.server";
import {
  listKitDefinitionsForShop,
  upsertKitDefinition,
  upsertKitRequirement,
} from "../app/lib/db/queries";
import { buildDefaultKitTemplates } from "../app/lib/knowledge-graph/kits";

const shopArg = process.argv.find((argument) => argument.startsWith("--shop="))?.split("=")[1];
if (!shopArg) {
  console.error("Error: --shop=<shop-domain> argument is required");
  process.exit(1);
}

const reseed = process.argv.includes("--reseed");
const shop = shopArg;

async function main() {
  console.log(`Seeding kit definitions for ${shop}${reseed ? " (reseed enabled)" : ""}`);

  const templates = buildDefaultKitTemplates();
  const existingKits = await listKitDefinitionsForShop(shop, 200);
  const existingByKey = new Map(existingKits.map((kit) => [kit.key, kit]));

  let seededCount = 0;
  let skippedCount = 0;

  for (const template of templates) {
    const existing = existingByKey.get(template.key);
    if (
      existing &&
      !reseed &&
      (existing.source === KitDefinitionSource.MERCHANT || existing.source === KitDefinitionSource.HYBRID)
    ) {
      skippedCount += 1;
      console.log(`  Skipped merchant-managed kit: ${template.key}`);
      continue;
    }

    const kit = await upsertKitDefinition({
      id: existing?.id,
      shop,
      key: template.key,
      label: template.label,
      disciplineTag: template.disciplineTag,
      description: template.description,
      source: existing?.source === KitDefinitionSource.MERCHANT ? KitDefinitionSource.HYBRID : KitDefinitionSource.AUTO,
      status: existing?.status,
    });

    for (const requirement of template.requirements) {
      const existingRequirement = existing?.requirements.find(
        (candidate) => candidate.requirementKey === requirement.requirementKey,
      );

      await upsertKitRequirement({
        id: existingRequirement?.id,
        kitDefinitionId: kit.id,
        requirementKey: requirement.requirementKey,
        label: requirement.label,
        isRequired: requirement.isRequired,
        priority: requirement.priority,
        safetyCritical: requirement.safetyCritical,
        matchMode: requirement.matchMode,
        acceptedCategoryTags: requirement.acceptedCategoryTags,
        acceptedShopifyProductIds: requirement.acceptedShopifyProductIds,
        acceptedRelationshipTypes: requirement.acceptedRelationshipTypes,
        minQuantity: requirement.minQuantity,
      });
    }

    seededCount += 1;
    console.log(`  Seeded ${template.key}`);
  }

  console.log(`Kit seeding complete. ${seededCount} kit(s) seeded, ${skippedCount} merchant-managed kit(s) skipped.`);
  await db.$disconnect();
}

main().catch((error) => {
  console.error(error);
  db.$disconnect().finally(() => process.exit(1));
});