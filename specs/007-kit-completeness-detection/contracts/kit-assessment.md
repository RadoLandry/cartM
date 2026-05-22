# Contract: Kit Assessment

## Purpose

Define the deterministic input and output contract for cart-level kit completeness analysis.

## Input

```ts
type CartKitItem = {
  productId: string;
  shopifyProductId: string;
  title: string;
  quantity: number;
  availableForSale: boolean;
  disciplineTags: string[];
  categoryTags: string[];
};

type KitRequirementDefinition = {
  id: string;
  requirementKey: string;
  label: string;
  isRequired: boolean;
  priority: number;
  safetyCritical: boolean;
  matchMode: "CATEGORY" | "PRODUCT" | "CATEGORY_OR_PRODUCT" | "PRODUCT_OR_ALTERNATIVE";
  acceptedCategoryTags: string[];
  acceptedShopifyProductIds: string[];
  acceptedRelationshipTypes: Array<"COMPLEMENTS" | "ALTERNATIVES">;
  minQuantity: number;
};

type KitDefinitionInput = {
  id: string;
  key: string;
  label: string;
  disciplineTag: string;
  requirements: KitRequirementDefinition[];
};

type KitAssessmentInput = {
  shop: string;
  items: CartKitItem[];
  kitDefinitions: KitDefinitionInput[];
  relationships: Array<{
    sourceProductId: string;
    targetProductId: string;
    relationshipType: "COMPLEMENTS" | "ALTERNATIVES";
    strength: number;
  }>;
};
```

## Output

```ts
type KitAssessmentReason = {
  reasonType:
    | "discipline_match"
    | "relationship_support"
    | "merchant_override"
    | "required_missing"
    | "optional_missing"
    | "substitute_match";
  confidence: number;
  source: "AUTO" | "MERCHANT" | "HYBRID";
  message: string;
  metadata?: Record<string, unknown>;
};

type RequirementCoverage = {
  requirementKey: string;
  label: string;
  isRequired: boolean;
  priority: number;
  safetyCritical: boolean;
  status: "matched" | "missing";
  matchedProductIds: string[];
  reasons: KitAssessmentReason[];
};

type KitAssessment = {
  kitKey: string;
  label: string;
  disciplineTag: string;
  confidence: number;
  completenessScore: number;
  status: "none" | "partial" | "complete";
  matchedRequirements: RequirementCoverage[];
  missingRequirements: RequirementCoverage[];
  reasons: KitAssessmentReason[];
};
```

## Rules

- The scorer must return one `KitAssessment` per inferred kit; multi-discipline carts must not be collapsed into a single synthetic kit.
- `completenessScore` must be normalized between `0` and `1`.
- Missing required slots must sort ahead of missing optional slots, with lower `priority` values treated as more urgent.
- A requirement satisfied through an accepted alternative must include a `substitute_match` reason.
- Empty carts must return an empty assessment list rather than a fabricated low-confidence kit.