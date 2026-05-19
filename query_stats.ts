import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
  const shopsQueryResult = await prisma.$queryRaw<any[]>(`SELECT DISTINCT shop FROM "Session" UNION SELECT DISTINCT shop FROM "Product" UNION SELECT DISTINCT shop FROM "SyncJob" UNION SELECT DISTINCT shop FROM "WebhookEvent"`);
  const shopList = Array.from(new Set(shopsQueryResult.map((s: any) => s.shop)));
  console.log("--- Database Stats per Shop ---");
  for (const shop of shopList) {
    const productCount = await prisma.product.count({ where: { shop } });
    const sessionCount = await prisma.session.count({ where: { shop } });
    const syncJobCount = await prisma.syncJob.count({ where: { shop } });
    const webhookCount = await prisma.webhookEvent.count({ where: { shop } });
    console.log(`Shop: ${shop}`);
    console.log(`  Products: ${productCount}`);
    console.log(`  Sessions: ${sessionCount}`);
    console.log(`  SyncJobs: ${syncJobCount}`);
    console.log(`  WebhookEvents: ${webhookCount}`);
    if (shop === "landry-randrianandrasana.myshopify.com") {
      const lastSyncJobs = await prisma.syncJob.findMany({ where: { shop }, orderBy: { createdAt: "desc" }, take: 3 });
      console.log(`  Last 3 SyncJobs for ${shop}:`);
      lastSyncJobs.forEach(job => { console.log(`    - ID: ${job.id}, Status: ${job.status}, CreatedAt: ${job.createdAt}`); });
    }
  }
}
main().catch(e => console.error(e)).finally(async () => await prisma.$disconnect());
