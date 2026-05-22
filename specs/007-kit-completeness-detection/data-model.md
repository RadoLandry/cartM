# Data Model: Kit Completeness Detection

## New Prisma Models

### KitDefinition

Stores a merchant-facing kit template for a discipline or shopping goal. One row per kit.

```text
KitDefinition
├── id                  String   @id @default(cuid())
├── shop                String
├── key                 String   -- stable identifier, e.g. "boxing-starter"
├── label               String   -- merchant-facing title
├── disciplineTag       String   -- primary discipline this kit serves
├── description         String?
├── source              KitDefinitionSource @default(AUTO)
├── status              KitDefinitionStatus @default(ACTIVE)
├── createdAt           DateTime @default(now())
├── updatedAt           DateTime @updatedAt
└── requirements        KitRequirement[]

@@unique([shop, key])
@@index([shop, disciplineTag, status])
```

---

### KitRequirement

Defines one required or optional slot inside a kit and how the scorer should consider it satisfied.

```text
KitRequirement
├── id                       String   @id @default(cuid())
├── kitDefinitionId          String
├── requirementKey           String   -- stable identifier, e.g. "hand-wraps"
├── label                    String   -- shopper/admin-facing slot label
├── description              String?
├── isRequired               Boolean  @default(true)
├── priority                 Int      @default(100)
├── safetyCritical           Boolean  @default(false)
├── matchMode                RequirementMatchMode @default(CATEGORY)
├── acceptedCategoryTags     String[]
├── acceptedShopifyProductIds String[]
├── acceptedRelationshipTypes RelationshipType[]
├── minQuantity              Int      @default(1)
├── createdAt                DateTime @default(now())
├── updatedAt                DateTime @updatedAt
└── kitDefinition            KitDefinition @relation(fields: [kitDefinitionId], references: [id], onDelete: Cascade)

@@unique([kitDefinitionId, requirementKey])
@@index([kitDefinitionId, priority])
```

**Fulfillment semantics**
- `CATEGORY`: satisfied when a cart item shares any `acceptedCategoryTags`
- `PRODUCT`: satisfied only by explicit `acceptedShopifyProductIds`
- `CATEGORY_OR_PRODUCT`: satisfied by either of the above
- `PRODUCT_OR_ALTERNATIVE`: satisfied by explicit products or an active `ALTERNATIVES` relationship from a cart item to an accepted product

---

## New Enums

```text
enum KitDefinitionSource {
  AUTO
  MERCHANT
  HYBRID
}

enum KitDefinitionStatus {
  ACTIVE
  DRAFT
  ARCHIVED
}

enum RequirementMatchMode {
  CATEGORY
  PRODUCT
  CATEGORY_OR_PRODUCT
  PRODUCT_OR_ALTERNATIVE
}
```

---

## Existing Model Usage and Extensions

### Product (existing)

The existing `Product` model continues to provide:
- `disciplineTags` as evidence for candidate kit inference
- `categoryTags` as generalized coverage for requirement matching
- `status` and variant availability checks to suppress unavailable missing-item suggestions

### ProductRelationship (existing)

The scorer reuses active relationships as evidence, especially:
- `COMPLEMENTS` to support default requirement derivation and recommendation ranking
- `ALTERNATIVES` to treat substitute products as satisfying a requirement when configured

No new relationship type is required for the first implementation slice.

### BundleRule (existing)

`BundleRule` remains a separate merchandising and discount artifact. It is not the source of truth for kit completeness because it does not encode completeness scoring, substitute coverage, or safety-critical ranking.

---

## Relationships Between Models

```text
KitDefinition 1────N KitRequirement
KitRequirement ────references──── Product / ProductRelationship evidence by category, Shopify product id, and relationship type
KitDefinition ────feeds──── cart-intelligence kit-detection scorer and merchant admin UI
```

---

## Query Patterns

### Active kits for current cart

```text
SELECT KitDefinition + KitRequirement
WHERE shop = $shop
  AND status = ACTIVE
  AND disciplineTag IN inferredDisciplineTags
ORDER BY disciplineTag, label
```

### Requirement fulfillment evaluation

```text
For each KitRequirement:
- match direct acceptedShopifyProductIds against cart product ids
- else match acceptedCategoryTags against cart item categoryTags
- else resolve acceptedRelationshipTypes using active ProductRelationship edges
- count matched items vs minQuantity
```

### Merchant admin list

```text
SELECT KitDefinition + KitRequirement
WHERE shop = $shop
ORDER BY status ASC, disciplineTag ASC, label ASC
LIMIT 50
```

### Shopper recommendation shaping

```text
Load kit assessments for inferred kits
Emit missing required items first, then optional items
Skip any candidate where product or selected variant is unavailable
```