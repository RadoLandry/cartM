import {
  createKitReason,
  fulfillKitRequirement,
  groupItemsByDiscipline,
  sortRequirementCoverage,
  type CartKitItem,
  type KitAssessment,
  type KitDefinitionRecord,
  type RelationshipSupportEdge,
} from "../knowledge-graph/kits";

export interface DetectKitCompletenessInput {
  shop: string;
  items: CartKitItem[];
  kitDefinitions: KitDefinitionRecord[];
  relationships: RelationshipSupportEdge[];
  acceptedInternalProductIdsByShopifyId?: Record<string, string[]>;
}

function round(value: number): number {
  return Number(value.toFixed(2));
}

function calculateAssessmentConfidence(
  matchedCount: number,
  totalRequirements: number,
  disciplineEvidenceCount: number,
): number {
  if (totalRequirements === 0 || disciplineEvidenceCount === 0) {
    return 0;
  }

  const ratio = matchedCount / totalRequirements;
  const evidenceBoost = Math.min(0.15, disciplineEvidenceCount * 0.05);
  return round(Math.min(0.98, 0.45 + ratio * 0.4 + evidenceBoost));
}

export async function detectKitCompleteness(
  input: DetectKitCompletenessInput,
): Promise<KitAssessment[]> {
  const { items, kitDefinitions, relationships, acceptedInternalProductIdsByShopifyId } = input;

  if (!items || items.length === 0 || !kitDefinitions || kitDefinitions.length === 0) {
    return [];
  }

  const itemsByDiscipline = groupItemsByDiscipline(items);
  if (itemsByDiscipline.size === 0) {
    return [];
  }

  const assessments: KitAssessment[] = [];

  for (const [disciplineTag, disciplineItems] of itemsByDiscipline.entries()) {
    const matchingKits = kitDefinitions.filter((kit) => kit.disciplineTag === disciplineTag);
    if (matchingKits.length === 0) {
      continue;
    }

    for (const kit of matchingKits) {
      const requirementCoverage = sortRequirementCoverage(
        kit.requirements.map((requirement) =>
          fulfillKitRequirement(requirement, disciplineItems, relationships, {
            acceptedInternalProductIdsByShopifyId,
          }),
        ),
      );

      const matchedRequirements = requirementCoverage.filter((coverage) => coverage.status === "matched");
      const missingRequirements = requirementCoverage.filter((coverage) => coverage.status === "missing");

      if (matchedRequirements.length === 0) {
        continue;
      }

      const completenessScore = round(matchedRequirements.length / Math.max(1, requirementCoverage.length));
      const confidence = calculateAssessmentConfidence(
        matchedRequirements.length,
        requirementCoverage.length,
        disciplineItems.length,
      );

      const reasons = [
        createKitReason(
          "discipline_match",
          confidence,
          kit.source,
          `${kit.label} was inferred from ${disciplineItems.length} cart item(s) tagged for ${disciplineTag}.`,
          {
            disciplineTag,
            matchedProductIds: disciplineItems.map((item) => item.productId),
          },
        ),
      ];

      if (missingRequirements.length > 0) {
        reasons.push(
          createKitReason(
            missingRequirements.some((coverage) => coverage.isRequired)
              ? "required_missing"
              : "optional_missing",
            missingRequirements.some((coverage) => coverage.isRequired) ? 0.9 : 0.65,
            kit.source,
            `${missingRequirements.length} kit requirement(s) are still missing.`,
            {
              missingRequirementKeys: missingRequirements.map((coverage) => coverage.requirementKey),
            },
          ),
        );
      }

      assessments.push({
        kitKey: kit.key,
        label: kit.label,
        disciplineTag,
        confidence,
        completenessScore,
        status: missingRequirements.length === 0 ? "complete" : "partial",
        matchedRequirements,
        missingRequirements,
        reasons,
      });
    }
  }

  return assessments.sort((left, right) => {
    if (right.confidence !== left.confidence) {
      return right.confidence - left.confidence;
    }

    return left.label.localeCompare(right.label);
  });
}