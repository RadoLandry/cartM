/**
 * Backfill script: generate and persist embeddings for products that have none.
 *
 * Usage:
 *   npx tsx scripts/backfill-embeddings.ts
 *
 * Optional env vars:
 *   BACKFILL_BATCH_SIZE  – products per batch (default: 50)
 *   BACKFILL_DRY_RUN     – set to "1" to log without writing
 */

import { PrismaClient, Prisma } from "@prisma/client";
import { generateProductEmbeddingWithRetry } from "../app/lib/knowledge-graph/embeddings";
import { updateProductEmbedding } from "../app/lib/db/queries";

const db = new PrismaClient();
const BATCH_SIZE = parseInt(process.env.BACKFILL_BATCH_SIZE ?? "50", 10);
const DRY_RUN = process.env.BACKFILL_DRY_RUN === "1";

async function backfill() {
  console.log(`[Backfill] Starting embedding backfill (batchSize=${BATCH_SIZE}, dryRun=${DRY_RUN})`);

  let cursor: string | undefined;
  let totalProcessed = 0;
  let totalSkipped = 0;
  let totalFailed = 0;

  while (true) {
    // Fetch products whose embedding IS NULL using raw SQL
    // (Prisma cannot filter on Unsupported("vector") columns)
    const cursorClause = cursor
      ? Prisma.sql`AND "shopifyProductId" > ${cursor}`
      : Prisma.empty;

    const rows = await db.$queryRaw<{ shopifyProductId: string; title: string; description: string | null; tags: string[] }[]>`
      SELECT "shopifyProductId", title, description, tags
      FROM "Product"
      WHERE embedding IS NULL
      ${cursorClause}
      ORDER BY "shopifyProductId"
      LIMIT ${BATCH_SIZE}
    `;

    if (rows.length === 0) break;

    console.log(`[Backfill] Processing batch of ${rows.length} products (after cursor: ${cursor ?? "start"})`);

    for (const row of rows) {
      const embedText = `${row.title} ${row.description ?? ""} ${row.tags.join(" ")}`.trim();

      if (!embedText) {
        console.warn(`[Backfill] Skipping ${row.shopifyProductId} — empty embed text`);
        totalSkipped++;
        cursor = row.shopifyProductId;
        continue;
      }

      try {
        const embedding = await generateProductEmbeddingWithRetry(embedText, 3);

        if (DRY_RUN) {
          console.log(`[Backfill] DRY RUN — would write ${embedding.length}-dim vector for ${row.shopifyProductId}`);
        } else {
          await updateProductEmbedding(row.shopifyProductId, embedding);
          console.log(`[Backfill] ✓ ${row.shopifyProductId}`);
        }

        totalProcessed++;
      } catch (err) {
        console.error(`[Backfill] ✗ ${row.shopifyProductId}:`, (err as Error).message);
        totalFailed++;
      }

      cursor = row.shopifyProductId;
    }

    // If the batch was smaller than BATCH_SIZE we've reached the end
    if (rows.length < BATCH_SIZE) break;
  }

  console.log(`[Backfill] Done. processed=${totalProcessed} skipped=${totalSkipped} failed=${totalFailed}`);
}

backfill()
  .catch((err) => {
    console.error("[Backfill] Fatal error:", err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
