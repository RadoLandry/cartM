# Contract: Replenishment Purchase Ingestion

## Purpose

Defines the normalized ingestion shape used by authenticated order webhooks and optional background backfill to maintain local replenishment purchase snapshots.

## Input Shape

```ts
interface ReplenishmentPurchaseIngestionCommand {
  shop: string;
  shopifyCustomerId: string;
  orderId: string;
  processedAt: string;
  currencyCode?: string;
  lineItems: Array<{
    productId: string;
    variantId?: string;
    quantity: number;
    title: string;
    variantTitle?: string;
    categoryTags: string[];
    unitPrice?: number;
  }>;
}
```

## Processing Rules

- The command must target a recognized shopper; anonymous sessions are not eligible for persisted replenishment snapshots.
- Only line items whose categories match active lifecycle-backed categories are eligible for snapshot upserts.
- Repeated ingestion of the same normalized order must be idempotent for `orderCount` and `totalQuantity` updates.
- Snapshot writes update shopper-level `CustomerProfile.purchaseSummary` only with aggregate replenishment metadata, not raw order payloads.

## Persistence Guarantees

- Item-level purchase history remains local and queryable without future Admin API reads on the shopper path.
- Order webhook ingestion and historical backfill converge on the same snapshot format.
- A newly ingested qualifying purchase suppresses prior due reminders for that same item or category on the next evaluation cycle.

## Error Semantics

- Invalid or incomplete commands fail validation before any persistence occurs.
- Unknown products or line items with no eligible category mapping are skipped or recorded as non-replenishment purchases without failing the whole command.
- Partial write failures must not create duplicate snapshots for the same shopper/product/order normalization key.