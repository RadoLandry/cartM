import type {
  CustomerProfileRecord,
  CustomerPurchaseSnapshotRecord,
  ReplenishmentLifecycleRuleRecord,
} from "../db/queries";

export type ReplenishmentDueState = "not_due" | "approaching" | "due" | "suppressed";
export type ReplenishmentActionType = "reorder" | "upgrade";

export interface ReplenishmentActionTarget {
  productId: string;
  variantId?: string;
  available: boolean;
}

export interface ReplenishmentCandidate {
  candidateKey: string;
  productId: string;
  variantId?: string;
  categoryTag: string;
  title: string;
  dueState: ReplenishmentDueState;
  expectedReplacementAt: string;
  confidence: number;
  urgencyScore: number;
  preferredAction: ReplenishmentActionType;
  reorderTarget?: ReplenishmentActionTarget;
  upgradeTarget?: ReplenishmentActionTarget;
  reasons: string[];
}

export interface ReplenishmentActionTargetHydration {
  productId: string;
  variantId?: string;
  available: boolean;
}

export interface ReplenishmentEvaluationInput {
  shop: string;
  shopifyCustomerId: string;
  profile?: Pick<CustomerProfileRecord, "confidenceSummary" | "lastActiveAt" | "purchaseSummary"> | null;
  purchaseSnapshots: CustomerPurchaseSnapshotRecord[];
  lifecycleRules: ReplenishmentLifecycleRuleRecord[];
  asOf?: Date;
  /** Reorder-target availability keyed by the purchased productId. */
  reorderTargets?: Map<string, ReplenishmentActionTargetHydration>;
  /** Upgrade-target availability keyed by the purchased productId. */
  upgradeTargets?: Map<string, ReplenishmentActionTargetHydration>;
}

const DAY_IN_MS = 1000 * 60 * 60 * 24;
const SPARSE_HISTORY_CONFIDENCE_FLOOR = 0.4;
const QUANTITY_CADENCE_STEP = 0.15;
const QUANTITY_CADENCE_MAX_STEPS = 3;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_IN_MS);
}

function resolveProfileConfidence(
  profile?: Pick<CustomerProfileRecord, "confidenceSummary" | "lastActiveAt"> | null,
): number {
  const overall = typeof profile?.confidenceSummary?.overall === "number"
    ? profile.confidenceSummary.overall
    : 0.72;

  if (!profile?.lastActiveAt) {
    return clamp(overall - 0.08, 0.35, 0.95);
  }

  const daysSinceActive = Math.max(0, Math.floor((Date.now() - profile.lastActiveAt.getTime()) / DAY_IN_MS));

  if (daysSinceActive <= 30) {
    return clamp(overall, 0.35, 0.95);
  }

  if (daysSinceActive <= 90) {
    return clamp(overall - 0.07, 0.35, 0.95);
  }

  return clamp(overall - 0.15, 0.35, 0.95);
}

function resolveDueState(daysSincePurchase: number, rule: ReplenishmentLifecycleRuleRecord): ReplenishmentDueState {
  if (daysSincePurchase >= rule.windowMaxDays) {
    return "due";
  }

  if (daysSincePurchase >= rule.windowMinDays) {
    return "approaching";
  }

  return "not_due";
}

function resolveUrgencyScore(
  dueState: ReplenishmentDueState,
  daysSincePurchase: number,
  rule: ReplenishmentLifecycleRuleRecord,
): number {
  const priorityWeight = Math.max(0, 1 - Math.min(rule.priority, 100) / 100);

  if (dueState === "due") {
    return Number((1 + priorityWeight + Math.min(daysSincePurchase - rule.windowMaxDays, 30) / 30).toFixed(2));
  }

  if (dueState === "approaching") {
    const windowSpan = Math.max(rule.windowMaxDays - rule.windowMinDays, 1);
    const progress = (daysSincePurchase - rule.windowMinDays) / windowSpan;

    return Number((0.45 + priorityWeight * 0.35 + clamp(progress, 0, 1) * 0.2).toFixed(2));
  }

  return Number((priorityWeight * 0.25).toFixed(2));
}

export function compareReplenishmentCandidates(
  left: ReplenishmentCandidate,
  right: ReplenishmentCandidate,
): number {
  if (right.urgencyScore !== left.urgencyScore) {
    return right.urgencyScore - left.urgencyScore;
  }

  if (right.confidence !== left.confidence) {
    return right.confidence - left.confidence;
  }

  return left.categoryTag.localeCompare(right.categoryTag);
}

function resolveQuantityAdjustedCadence(cadenceDays: number, totalQuantity: number): number {
  if (totalQuantity <= 1) {
    return cadenceDays;
  }

  const steps = Math.min(totalQuantity - 1, QUANTITY_CADENCE_MAX_STEPS);

  return Math.round(cadenceDays * (1 + steps * QUANTITY_CADENCE_STEP));
}

function isSparseHistory(snapshot: CustomerPurchaseSnapshotRecord): boolean {
  return snapshot.orderCount < 2 && !snapshot.inferredCadenceDays;
}

function downgradeDueState(dueState: ReplenishmentDueState): ReplenishmentDueState {
  if (dueState === "due") {
    return "approaching";
  }

  if (dueState === "approaching") {
    return "not_due";
  }

  return dueState;
}

export function evaluateReplenishmentCandidates(
  input: ReplenishmentEvaluationInput,
): ReplenishmentCandidate[] {
  const rulesByCategory = new Map(
    input.lifecycleRules.map((rule) => [rule.categoryTag, rule] as const),
  );
  const asOf = input.asOf ?? new Date();
  const profileConfidence = resolveProfileConfidence(input.profile);

  return input.purchaseSnapshots
    .map((snapshot) => {
      const rule = rulesByCategory.get(snapshot.categoryTag);

      if (!rule) {
        return null;
      }

      const daysSincePurchase = Math.max(
        0,
        Math.floor((asOf.getTime() - snapshot.lastPurchasedAt.getTime()) / DAY_IN_MS),
      );
      const baseCadenceDays = snapshot.inferredCadenceDays ?? rule.windowMaxDays;
      const cadenceDays = resolveQuantityAdjustedCadence(baseCadenceDays, snapshot.totalQuantity);
      const sparseHistory = isSparseHistory(snapshot);
      const confidence = clamp(
        profileConfidence
          + (snapshot.orderCount >= 2 ? 0.08 : 0)
          + (snapshot.inferredCadenceDays ? 0.05 : 0)
          - (sparseHistory ? 0.15 : 0),
        0.35,
        0.99,
      );
      let dueState = resolveDueState(daysSincePurchase, rule);

      if (sparseHistory && confidence < SPARSE_HISTORY_CONFIDENCE_FLOOR) {
        dueState = downgradeDueState(dueState);
      }

      const reorderTarget = input.reorderTargets?.get(snapshot.productId);
      const upgradeTarget = input.upgradeTargets?.get(snapshot.productId) ?? reorderTarget;

      return {
        candidateKey: `${input.shop}:${input.shopifyCustomerId}:${snapshot.productId}:${snapshot.categoryTag}`,
        productId: snapshot.productId,
        ...(snapshot.variantId ? { variantId: snapshot.variantId } : {}),
        categoryTag: snapshot.categoryTag,
        title: snapshot.latestTitle,
        dueState,
        expectedReplacementAt: addDays(snapshot.lastPurchasedAt, cadenceDays).toISOString(),
        confidence: Number(confidence.toFixed(2)),
        urgencyScore: resolveUrgencyScore(dueState, daysSincePurchase, rule),
        preferredAction: snapshot.preferredAction,
        ...(reorderTarget ? { reorderTarget } : {}),
        ...(upgradeTarget ? { upgradeTarget } : {}),
        reasons: [
          sparseHistory && dueState !== "due"
            ? `${rule.label} history is limited, so the reminder is softened until more purchases are confirmed.`
            : dueState === "due"
              ? `${rule.label} looks due for replacement based on prior purchase timing.`
              : dueState === "approaching"
                ? `${rule.label} is approaching its expected replacement window.`
                : `${rule.label} is not due for replacement yet.`,
        ],
      } satisfies ReplenishmentCandidate;
    })
    .filter((candidate): candidate is ReplenishmentCandidate => candidate !== null)
    .sort(compareReplenishmentCandidates);
}