# Data Model: Smart Bundle Detection

## New Prisma Models

### BundleRule

Stores one merchant-facing bundle offer and its qualification rules.

```text
BundleRule
├── id                  String   @id @default(cuid())
├── shop                String
├── key                 String   -- stable identifier, e.g. "boxing-starter-bundle"
├── label               String   -- merchant-facing offer title
├── description         String?
├── source              BundleRuleSource @default(MERCHANT)
├── status              BundleRuleStatus @default(DRAFT)
├── priority            Int      @default(100)
├── completionThreshold Float    @default(0.8)
├── discountType        BundleDiscountType
├── discountValue       Decimal  @db.Decimal(10, 2)
├── createdAt           DateTime @default(now())
├── updatedAt           DateTime @updatedAt
└── components          BundleRuleComponent[]

@@unique([shop, key])
@@index([shop, status, priority])
```

---

### BundleRuleComponent

Defines one qualifying component inside a bundle and how the matcher should determine whether the cart satisfies it.

```text
BundleRuleComponent
├── id                        String   @id @default(cuid())
├── bundleRuleId              String
├── componentKey              String   -- stable identifier, e.g. "hand-wraps"
├── label                     String
├── description               String?
├── isRequired                Boolean  @default(true)
├── sortOrder                 Int      @default(100)
├── matchMode                 BundleComponentMatchMode @default(CATEGORY_OR_PRODUCT)
├── acceptedCategoryTags      String[]
├── acceptedShopifyProductIds String[]
├── acceptedShopifyVariantIds String[]
├── minQuantity               Int      @default(1)
├── createdAt                 DateTime @default(now())
├── updatedAt                 DateTime @updatedAt
└── bundleRule                BundleRule @relation(fields: [bundleRuleId], references: [id], onDelete: Cascade)

@@unique([bundleRuleId, componentKey])
@@index([bundleRuleId, sortOrder])
```

---

## New Enums

```text
enum BundleRuleSource {
  AUTO
  MERCHANT
  HYBRID
}

enum BundleRuleStatus {
  ACTIVE
  DRAFT
  ARCHIVED
}

enum BundleDiscountType {
  PERCENTAGE
  FIXED
}

enum BundleComponentMatchMode {
  CATEGORY
  PRODUCT
  VARIANT
  CATEGORY_OR_PRODUCT
}
```

---

## Existing Model Usage and Extensions

### Product and ProductVariant (existing)

Existing catalog models continue to provide:
- title and taxonomy context for shopper-facing explanations
- `ProductVariant.inventoryQuantity` and variant identity for purchasable completion suggestions
- category and product-level evidence for component matching

### ProductRelationship (existing)

Active relationship data remains support evidence for ranking suggested completion items when a bundle component can be satisfied by more than one candidate. It is not the authoritative rule store for qualification.

### KitDefinition and KitRequirement (existing)

These remain separate from bundle rules. Kits model “what should a shopper own for a discipline,” while bundle rules model “what commercial offer should be promoted or discounted.” The persistence pattern, however, is intentionally parallel.

---

## Derived Runtime Entities

### BundleMatch

Deterministic comparison result for one cart against one active bundle rule.

```text
BundleMatch
├── bundleKey
├── status                 -- qualified | nearly_complete | partial | not_applicable
├── matchedComponents      -- satisfied components with cart evidence
├── missingComponents      -- unsatisfied components with remaining quantity
├── qualifiedItemIds       -- cart lines or products contributing to the rule
├── competitionGroupKeys   -- overlapping bundle keys using the same qualifying evidence
├── coverageRatio
├── priority
└── summaryReasons
```

### BundleOpportunityPayload

Shopper-facing representation for cart and checkout consumers.

```text
BundleOpportunityPayload
├── bundleKey
├── label
├── status                 -- qualified | nearly_complete
├── savingsSummary
├── completionProgress
├── missingActions         -- actionable completion candidates only
├── isCompetingOffer
└── explanation
```

---

## Relationships Between Models

```text
BundleRule 1────N BundleRuleComponent
BundleRuleComponent ────matches against──── Product / ProductVariant / category tags
BundleRule ────feeds──── cart-intelligence bundle matcher, shopper recommendation payload builder, and future function projection
```

---

## Query Patterns

### Active bundles for cart analysis

```text
SELECT BundleRule + BundleRuleComponent
WHERE shop = $shop
  AND status = ACTIVE
ORDER BY priority ASC, label ASC
```

### Rule component fulfillment evaluation

```text
For each BundleRuleComponent:
- match acceptedShopifyVariantIds against cart variant ids when matchMode includes VARIANT
- else match acceptedShopifyProductIds against cart product ids when matchMode includes PRODUCT
- else match acceptedCategoryTags against cart item category tags when matchMode includes CATEGORY
- sum qualifying quantities and compare against minQuantity
```

### Merchant admin list and edit

```text
SELECT BundleRule + BundleRuleComponent
WHERE shop = $shop
ORDER BY status ASC, priority ASC, label ASC
LIMIT 50
```

### Function-ready projection

```text
Load active BundleRule rows
Filter to fields required by downstream runtime consumers
Project compact component thresholds, discount metadata, and deterministic priority ordering
```